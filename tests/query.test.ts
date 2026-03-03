/**
 * Unit tests for query execution
 */

import { generateSummaryTable, setOutputs } from '../src/query';
import { QueryResult } from '../src/query';

// Mock @actions/core
jest.mock('@actions/core', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  setOutput: jest.fn(),
  summary: {
    addRaw: jest.fn().mockReturnThis(),
    write: jest.fn(),
  },
}));

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
    
    expect(summary).toContain('## Query Deps Results');
    expect(summary).toContain('✅');
    expect(summary).toContain('malware');
    expect(summary).toContain('150ms');
    expect(summary).toContain('200ms');
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
    
    expect(summary).toContain('❌');
    expect(summary).toContain('### Failed Queries');
    expect(summary).toContain('Expected 0 results, but got 1');
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

    expect(summary).toContain('### Failed Queries');
    expect(summary).toContain('Expected 0 results, but got 3');
    // The actual matched packages should be shown
    expect(summary).toContain('Output:');
    expect(summary).toContain('gpl-pkg@1.0.0');
    expect(summary).toContain('lgpl-lib@2.3.4');
    expect(summary).toContain('agpl-service@0.1.0');
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

    expect(summary).toContain('### Failed Queries');
    expect(summary).toContain('unsupported selector');
    expect(summary).toContain('stderr');
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

    expect(summary).toContain('### Failed Queries');
    expect(summary).toContain('connection reset');
    // stdout should also be shown
    expect(summary).toContain('Output:');
    expect(summary).toContain('partial-result@1.0.0');
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

    expect(summary).toContain('### Failed Queries');
    expect(summary).toContain('Expected 0 results, but got 2');
    // Output should NOT be shown
    expect(summary).not.toContain('gpl-pkg@1.0.0');
    expect(summary).not.toContain('Output:');
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

    expect(summary).toContain('### Query Outputs');
    expect(summary).toContain('```');
    expect(summary).toContain('"name": "lodash"');
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

    // With 'failed' mode, successful query output should NOT be shown
    expect(summary).not.toContain('### Query Outputs');
    expect(summary).not.toContain('"name": "lodash"');
  });

  it('should include query outputs for successful queries (legacy default behavior)', () => {
    // When show-results is 'always', successful query outputs are shown
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
    
    expect(summary).toContain('### Query Outputs');
    expect(summary).toContain('```');
    expect(summary).toContain('"name": "lodash"');
  });
});

describe('setOutputs', () => {
  const mockSetOutput = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-mock setOutput for each test
    const core = require('@actions/core');
    core.setOutput = mockSetOutput;
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

    expect(mockSetOutput).toHaveBeenCalledWith('results', JSON.stringify(results));
    expect(mockSetOutput).toHaveBeenCalledWith('passed', 'true');
    expect(mockSetOutput).toHaveBeenCalledWith('result-0', JSON.stringify(results[0]));
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

    expect(mockSetOutput).toHaveBeenCalledWith('passed', 'false');
  });
});
