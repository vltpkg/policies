import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseQueryLine, parseQueries, parseSingleQuery, validateQuery } from '../src/parser';

describe('parseQueryLine', () => {
  it('should parse simple selector', () => {
    const result = parseQueryLine(':malware');
    assert.deepStrictEqual(result, {
      selector: ':malware',
      flags: [],
    });
  });

  it('should parse selector with flags', () => {
    const result = parseQueryLine(':malware --expect-results=0 --view=json');
    assert.deepStrictEqual(result, {
      selector: ':malware',
      flags: ['--expect-results=0', '--view=json'],
      expectResults: '0',
      view: 'json',
    });
  });

  it('should parse complex selector with quoted arguments', () => {
    const result = parseQueryLine('*:license(copyleft) --scope=":root > *" --expect-results=0');
    assert.deepStrictEqual(result, {
      selector: '*:license(copyleft)',
      flags: ['--scope=":root > *"', '--expect-results=0'],
      scope: '":root > *"',
      expectResults: '0',
    });
  });

  it('should skip empty lines', () => {
    assert.strictEqual(parseQueryLine(''), null);
    assert.strictEqual(parseQueryLine('   '), null);
  });

  it('should skip comment lines', () => {
    assert.strictEqual(parseQueryLine('# This is a comment'), null);
    assert.strictEqual(parseQueryLine('  # Another comment'), null);
  });

  it('should extract target flag', () => {
    const result = parseQueryLine(':base --target=:outdated --view=count');
    assert.deepStrictEqual(result, {
      selector: ':base',
      flags: ['--target=:outdated', '--view=count'],
      target: ':outdated',
      view: 'count',
    });
  });
});

describe('parseQueries', () => {
  it('should parse multi-line queries', () => {
    const input = `
      :malware --expect-results=0
      :outdated --view=json
      # This is a comment
      
      *:license(copyleft) --expect-results=0
    `;

    const result = parseQueries(input);
    assert.strictEqual(result.length, 3);
    assert.strictEqual(result[0].selector, ':malware');
    assert.strictEqual(result[1].selector, ':outdated');
    assert.strictEqual(result[2].selector, '*:license(copyleft)');
  });

  it('should handle empty input', () => {
    assert.deepStrictEqual(parseQueries(''), []);
    assert.deepStrictEqual(parseQueries('   \n\n   '), []);
  });

  it('should skip comments and empty lines', () => {
    const input = `
      # Check for malware
      :malware --expect-results=0
      
      # Check outdated deps
      :outdated --view=json
      
      # End of queries
    `;

    const result = parseQueries(input);
    assert.strictEqual(result.length, 2);
  });
});

describe('parseSingleQuery', () => {
  it('should parse query with all parameters', () => {
    const result = parseSingleQuery(
      ':malware',
      '0',
      'json',
      ':root > *',
      undefined
    );

    assert.deepStrictEqual(result, {
      selector: ':malware',
      flags: ['--expect-results=0', '--view=json', '--scope=:root > *'],
      expectResults: '0',
      view: 'json',
      scope: ':root > *',
    });
  });

  it('should use target over query if provided', () => {
    const result = parseSingleQuery(
      ':malware',
      undefined,
      undefined,
      undefined,
      ':outdated'
    );

    assert.deepStrictEqual(result, {
      selector: ':outdated',
      flags: [],
    });
  });

  it('should handle minimal input', () => {
    const result = parseSingleQuery(':malware');
    assert.deepStrictEqual(result, {
      selector: ':malware',
      flags: [],
    });
  });
});

describe('validateQuery', () => {
  it('should accept valid query', () => {
    const query = {
      selector: ':malware',
      flags: ['--expect-results=0'],
      expectResults: '0',
    };

    const errors = validateQuery(query);
    assert.deepStrictEqual(errors, []);
  });

  it('should reject empty selector', () => {
    const query = {
      selector: '',
      flags: [],
    };

    const errors = validateQuery(query);
    assert.ok(errors.includes('Query selector cannot be empty'));
  });

  it('should reject invalid view', () => {
    const query = {
      selector: ':malware',
      flags: ['--view=invalid'],
      view: 'invalid',
    };

    const errors = validateQuery(query);
    assert.ok(errors.includes('Invalid view format: invalid. Must be one of: human, json, mermaid, count'));
  });
});
