#!/usr/bin/env bash
set -euo pipefail

# --- helpers ----------------------------------------------------------------

red()   { printf '\033[1;31m%s\033[0m\n' "$*"; }
green() { printf '\033[1;32m%s\033[0m\n' "$*"; }
dim()   { printf '\033[2m%s\033[0m\n' "$*"; }
bold()  { printf '\033[1m%s\033[0m\n' "$*"; }

die() { red "error: $*" >&2; exit 1; }

confirm() {
  printf '\033[1;33m%s [y/N] \033[0m' "$1"
  read -r ans
  [[ "$ans" =~ ^[Yy]$ ]] || { dim "aborted."; exit 0; }
}

# --- flags ------------------------------------------------------------------

FORCE=false
for arg in "$@"; do
  case "$arg" in
    -f|--force) FORCE=true ;;
    -h|--help)
      echo "usage: release.sh [--force]"
      echo "  -f, --force   replace an existing tag/release instead of failing"
      exit 0
      ;;
    *) die "unknown flag: $arg" ;;
  esac
done

# --- preflight checks -------------------------------------------------------

command -v gh  >/dev/null 2>&1 || die "gh cli is required (https://cli.github.com)"
command -v git >/dev/null 2>&1 || die "git is required"
command -v jq  >/dev/null 2>&1 || die "jq is required"

gh auth status >/dev/null 2>&1 || die "gh is not authenticated — run 'gh auth login'"

[[ -z "$(git status --porcelain)" ]] || die "working tree is dirty — commit or stash first"

BRANCH=$(git rev-parse --abbrev-ref HEAD)
[[ "$BRANCH" == "main" || "$BRANCH" == "master" ]] || die "must be on main/master (currently on '$BRANCH')"

git fetch origin --tags --quiet
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH" 2>/dev/null || echo "")
[[ "$LOCAL" == "$REMOTE" ]] || die "local HEAD does not match origin/$BRANCH — push or pull first"

# --- resolve version --------------------------------------------------------

VERSION=$(jq -r '.version' package.json)
[[ -n "$VERSION" && "$VERSION" != "null" ]] || die "could not read version from package.json"

TAG="v${VERSION}"
MAJOR="v$(echo "$VERSION" | cut -d. -f1)"

if git rev-parse "$TAG" >/dev/null 2>&1; then
  if [[ "$FORCE" == true ]]; then
    bold "tag '$TAG' exists — will be replaced (--force)"
  else
    die "tag '$TAG' already exists (use --force to replace)"
  fi
fi

# --- build ------------------------------------------------------------------

bold "building dist..."
npm run build
if [[ -n "$(git status --porcelain dist/)" ]]; then
  die "build produced uncommitted changes in dist/ — commit them first"
fi

# --- summary & confirm ------------------------------------------------------

echo ""
bold "release summary"
echo "  version : $VERSION"
echo "  tag     : $TAG"
echo "  major   : $MAJOR (will be force-updated)"
echo "  branch  : $BRANCH"
echo "  commit  : $(git log -1 --format='%h %s')"
echo ""

PREV_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [[ -n "$PREV_TAG" ]]; then
  dim "changes since $PREV_TAG:"
  git log --oneline "$PREV_TAG"..HEAD | sed 's/^/  /'
  echo ""
fi

confirm "create release $TAG?"

# --- tag & release ----------------------------------------------------------

if [[ "$FORCE" == true ]] && git rev-parse "$TAG" >/dev/null 2>&1; then
  bold "deleting existing release & tag $TAG..."
  gh release delete "$TAG" --yes --cleanup-tag 2>/dev/null || true
  git tag -d "$TAG" 2>/dev/null || true
  git push origin ":refs/tags/$TAG" 2>/dev/null || true
fi

bold "creating tag $TAG..."
git tag -a "$TAG" -m "Release $VERSION"

bold "updating major tag $MAJOR -> $TAG..."
git tag -f "$MAJOR" "$TAG"

bold "pushing tags..."
git push origin "$TAG"
git push origin "$MAJOR" --force

bold "creating github release..."
NOTES=""
if [[ -n "$PREV_TAG" ]]; then
  NOTES=$(git log --oneline "$PREV_TAG"..HEAD | sed 's/^/- /')
fi

gh release create "$TAG" \
  --title "$TAG" \
  --notes "${NOTES:-"Release $VERSION"}" \
  --latest

echo ""
green "released $TAG"
