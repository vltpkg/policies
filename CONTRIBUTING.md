# Contributing

## Prerequisites

- [Node.js](https://nodejs.org/) >= 22.9.0
- [vlt](https://vlt.sh/) package manager
- [GitHub CLI (`gh`)](https://cli.github.com/) — required for releases

## Setup

```sh
vlt install
```

## Development

```sh
vlr build:dev   # build with sourcemaps
vlr test        # run tests
vlr lint        # lint
vlr format      # format with prettier
```

The `dist/` directory is checked in so the action can run directly from the repo. CI will fail if it's out of date.

## Releasing

Bump the `version` in `package.json`, commit, then run:

```sh
vlr release
```

The script handles the rest — preflight checks, building, tagging, pushing, and creating the GitHub release.
