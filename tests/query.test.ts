import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { generateSummaryTable, setOutputs } from '../src/query';
import { QueryResult } from '../src/query';

const core = require('@actions/core');

describe('generateSummaryTable', () => {
  it('should generate summary for successful queries', () => {
    const results: QueryResult[] = [
      {
        query: ':malware --expect-results=0',
        selector: ':malware',
        flags: ['--expect-results=0'],
        output: '',
        stderr: '',
        exitCode: 0,
        success: true,
        passed: true,
        expectedResults: '0',
        actualResultCount: 0,
        duration: 150,
      },
      {
        query: ':outdated --view=json',
        selector: ':outdated',
        flags: ['--view=json'],
        output: '[]',
        stderr: '',
        exitCode: 0,
        success: true,
        passed: true,
        duration: 200,
      },
    ];

    const summary = generateSummaryTable(results);

    assert.ok(summary.includes('## Policies Results'));
    assert.ok(summary.includes('✅'));
    assert.ok(summary.includes('malware'));
    assert.ok(summary.includes('150ms'));
    assert.ok(summary.includes('200ms'));
  });

  it('should generate summary for failed queries', () => {
    const results: QueryResult[] = [
      {
        query: ':malware --expect-results=0',
        selector: ':malware',
        flags: ['--expect-results=0'],
        output: 'found malware package: evil-package',
        stderr: '',
        exitCode: 0,
        success: true,
        passed: false,
        error: 'Expected 0 results, but got 1',
        expectedResults: '0',
        actualResultCount: 1,
        duration: 150,
      },
    ];

    const summary = generateSummaryTable(results);

    assert.ok(summary.includes('❌'));
    assert.ok(summary.includes('### Failed Queries'));
    assert.ok(summary.includes('Expected 0 results, but got 1'));
  });

  it('should include query output in failed queries section (default show-results=failed)', () => {
    const results: QueryResult[] = [
      {
        query: '*:license(copyleft) --expect-results=0',
        selector: '*:license(copyleft)',
        flags: ['--expect-results=0'],
        output: 'gpl-pkg@1.0.0\nlgpl-lib@2.3.4\nagpl-service@0.1.0',
        stderr: '',
        exitCode: 0,
        success: true,
        passed: false,
        error: 'Expected 0 results, but got 3',
        expectedResults: '0',
        actualResultCount: 3,
        duration: 120,
      },
    ];

    const summary = generateSummaryTable(results);

    assert.ok(summary.includes('### Failed Queries'));
    assert.ok(summary.includes('Expected 0 results, but got 3'));
    assert.ok(summary.includes('Output:'));
    assert.ok(summary.includes('gpl-pkg@1.0.0'));
    assert.ok(summary.includes('lgpl-lib@2.3.4'));
    assert.ok(summary.includes('agpl-service@0.1.0'));
  });

  it('should show stderr in failed queries section for CLI errors', () => {
    const results: QueryResult[] = [
      {
        query: ':diff() --expect-results=0',
        selector: ':diff()',
        flags: ['--expect-results=0'],
        output: '',
        stderr: 'Error: unsupported selector :diff()',
        exitCode: 1,
        success: false,
        passed: false,
        error: 'Error: unsupported selector :diff()',
        duration: 50,
      },
    ];

    const summary = generateSummaryTable(results);

    assert.ok(summary.includes('### Failed Queries'));
    assert.ok(summary.includes('unsupported selector'));
    assert.ok(summary.includes('stderr'));
  });

  it('should show both stdout and stderr for CLI errors with partial output', () => {
    const results: QueryResult[] = [
      {
        query: ':some-selector',
        selector: ':some-selector',
        flags: [],
        output: 'partial-result@1.0.0',
        stderr: 'Warning: query terminated early\nError: connection reset',
        exitCode: 1,
        success: false,
        passed: false,
        error: 'Warning: query terminated early\nError: connection reset',
        duration: 300,
      },
    ];

    const summary = generateSummaryTable(results);

    assert.ok(summary.includes('### Failed Queries'));
    assert.ok(summary.includes('connection reset'));
    assert.ok(summary.includes('Output:'));
    assert.ok(summary.includes('partial-result@1.0.0'));
  });

  it('should not show output for failed queries when show-results=never', () => {
    const results: QueryResult[] = [
      {
        query: '*:license(copyleft) --expect-results=0',
        selector: '*:license(copyleft)',
        flags: ['--expect-results=0'],
        output: 'gpl-pkg@1.0.0\nlgpl-lib@2.3.4',
        stderr: '',
        exitCode: 0,
        success: true,
        passed: false,
        error: 'Expected 0 results, but got 2',
        expectedResults: '0',
        actualResultCount: 2,
        duration: 120,
      },
    ];

    const summary = generateSummaryTable(results, 'never');

    assert.ok(summary.includes('### Failed Queries'));
    assert.ok(summary.includes('Expected 0 results, but got 2'));
    assert.ok(!summary.includes('gpl-pkg@1.0.0'));
    assert.ok(!summary.includes('Output:'));
  });

  it('should show output for successful queries when show-results=always', () => {
    const results: QueryResult[] = [
      {
        query: ':outdated --view=json',
        selector: ':outdated',
        flags: ['--view=json'],
        output: '[\n  {\n    "name": "lodash",\n    "current": "4.17.20",\n    "wanted": "4.17.21"\n  }\n]',
        stderr: '',
        exitCode: 0,
        success: true,
        passed: true,
        duration: 200,
      },
    ];

    const summary = generateSummaryTable(results, 'always');

    assert.ok(summary.includes('### Query Outputs'));
    assert.ok(summary.includes('```'));
    assert.ok(summary.includes('"name": "lodash"'));
  });

  it('should not show successful query outputs with default show-results=failed', () => {
    const results: QueryResult[] = [
      {
        query: ':outdated --view=json',
        selector: ':outdated',
        flags: ['--view=json'],
        output: '[\n  {\n    "name": "lodash",\n    "current": "4.17.20",\n    "wanted": "4.17.21"\n  }\n]',
        stderr: '',
        exitCode: 0,
        success: true,
        passed: true,
        duration: 200,
      },
    ];

    const summary = generateSummaryTable(results, 'failed');

    assert.ok(!summary.includes('### Query Outputs'));
    assert.ok(!summary.includes('"name": "lodash"'));
  });

  it('should include query outputs for successful queries (legacy default behavior)', () => {
    const results: QueryResult[] = [
      {
        query: ':outdated --view=json',
        selector: ':outdated',
        flags: ['--view=json'],
        output: '[\n  {\n    "name": "lodash",\n    "current": "4.17.20",\n    "wanted": "4.17.21"\n  }\n]',
        stderr: '',
        exitCode: 0,
        success: true,
        passed: true,
        duration: 200,
      },
    ];

    const summary = generateSummaryTable(results, 'always');

    assert.ok(summary.includes('### Query Outputs'));
    assert.ok(summary.includes('```'));
    assert.ok(summary.includes('"name": "lodash"'));
  });
});

describe('setOutputs', () => {
  const calls: [string, string][] = [];

  beforeEach(() => {
    calls.length = 0;
    core.setOutput = (name: string, value: string) => { calls.push([name, value]); };
  });

  it('should set outputs for successful results', () => {
    const results: QueryResult[] = [
      {
        query: ':malware --expect-results=0',
        selector: ':malware',
        flags: ['--expect-results=0'],
        output: '',
        stderr: '',
        exitCode: 0,
        success: true,
        passed: true,
        expectedResults: '0',
        actualResultCount: 0,
        duration: 150,
      },
    ];

    setOutputs(results);

    assert.ok(calls.some(([k, v]) => k === 'results' && v === JSON.stringify(results)));
    assert.ok(calls.some(([k, v]) => k === 'passed' && v === 'true'));
    assert.ok(calls.some(([k, v]) => k === 'result-0' && v === JSON.stringify(results[0])));
  });

  it('should set outputs for failed results', () => {
    const results: QueryResult[] = [
      {
        query: ':malware --expect-results=0',
        selector: ':malware',
        flags: ['--expect-results=0'],
        output: 'found malware',
        stderr: '',
        exitCode: 0,
        success: true,
        passed: false,
        error: 'Expected 0 results, but got 1',
        expectedResults: '0',
        actualResultCount: 1,
        duration: 150,
      },
    ];

    setOutputs(results);

    assert.ok(calls.some(([k, v]) => k === 'passed' && v === 'false'));
  });
});
