/**
 * Core query execution logic
 */

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { ParsedQuery } from './parser';
import { execCommand, parseExpectResults, countResults, createTableRow, escapeMarkdown } from './utils';

export interface QueryResult {
  query: string;
  selector: string;
  flags: string[];
  output: string;
  stderr: string;
  exitCode: number;
  success: boolean;
  error?: string;
  expectedResults?: string;
  actualResultCount?: number;
  passed?: boolean;
  duration: number;
}

/**
 * Execute a single vlt query
 */
export async function executeQuery(
  query: ParsedQuery,
  workingDirectory?: string
): Promise<QueryResult> {
  const startTime = Date.now();
  
  const args = [query.selector, ...query.flags];
  const execOptions = workingDirectory ? { cwd: workingDirectory } : {};
  
  core.debug(`Executing: vlt query ${args.join(' ')}`);
  
  const result = await execCommand('vlt', ['query', ...args], execOptions);
  
  const duration = Date.now() - startTime;
  
  const queryResult: QueryResult = {
    query: `${query.selector} ${query.flags.join(' ')}`.trim(),
    selector: query.selector,
    flags: query.flags,
    output: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    success: result.exitCode === 0,
    duration,
  };
  
  // If the query itself failed, mark as failed
  if (!queryResult.success) {
    queryResult.error = queryResult.stderr || 'Query execution failed';
    queryResult.passed = false;
    return queryResult;
  }
  
  // Check expect-results if specified
  if (query.expectResults) {
    queryResult.expectedResults = query.expectResults;
    
    try {
      const actualCount = countResults(result.stdout, query.view || 'human');
      queryResult.actualResultCount = actualCount;
      
      const expectFn = parseExpectResults(query.expectResults);
      queryResult.passed = expectFn(actualCount);
      
      if (!queryResult.passed) {
        queryResult.error = `Expected ${query.expectResults} results, but got ${actualCount}`;
      }
    } catch (error) {
      queryResult.error = `Failed to parse expect-results: ${error}`;
      queryResult.passed = false;
    }
  } else {
    // If no expectation, consider it passed if the query executed successfully
    queryResult.passed = true;
  }
  
  return queryResult;
}

/**
 * Check whether output should be shown based on the show-results setting
 */
function shouldShowOutput(passed: boolean, showResults: string): boolean {
  if (showResults === 'always') return true;
  if (showResults === 'never') return false;
  // 'failed' (default) — show only for failed queries
  return !passed;
}

/**
 * Execute multiple queries
 */
export async function executeQueries(
  queries: ParsedQuery[],
  workingDirectory?: string,
  showResults: string = 'failed'
): Promise<QueryResult[]> {
  const results: QueryResult[] = [];
  
  for (const query of queries) {
    const result = await executeQuery(query, workingDirectory);
    results.push(result);
    
    // Log result
    if (result.passed) {
      core.info(`✅ ${result.query}`);
      if (shouldShowOutput(true, showResults) && result.output && result.output.trim()) {
        core.info(`Query output:\n${result.output}`);
      }
    } else {
      core.error(`❌ ${result.query}: ${result.error}`);
      if (shouldShowOutput(false, showResults)) {
        // Show stdout so users can see what matched (e.g. expect-results failures)
        if (result.output && result.output.trim()) {
          core.info(`Query output:\n${result.output}`);
        }
        // Show stderr so users can see CLI errors (e.g. unsupported selector)
        if (result.stderr && result.stderr.trim()) {
          core.info(`Query stderr:\n${result.stderr}`);
        }
      }
    }
  }
  
  return results;
}

/**
 * Generate summary table for GitHub Actions step summary
 */
export function generateSummaryTable(results: QueryResult[], showResults: string = 'failed'): string {
  const lines: string[] = [];
  
  lines.push('## Query Deps Results');
  lines.push('');
  
  // Table header
  lines.push(createTableRow(['Status', 'Query', 'Expected', 'Actual', 'Duration']));
  lines.push(createTableRow(['---', '---', '---', '---', '---']));
  
  for (const result of results) {
    const status = result.passed ? '✅' : '❌';
    const query = escapeMarkdown(result.query);
    const expected = result.expectedResults ? escapeMarkdown(result.expectedResults) : '-';
    const actual = result.actualResultCount !== undefined ? result.actualResultCount.toString() : '-';
    const duration = `${result.duration}ms`;
    
    lines.push(createTableRow([status, query, expected, actual, duration]));
  }
  
  lines.push('');
  
  // Add details for failed queries
  const failedResults = results.filter(r => !r.passed);
  if (failedResults.length > 0) {
    lines.push('### Failed Queries');
    lines.push('');
    
    for (const result of failedResults) {
      lines.push(`**${escapeMarkdown(result.query)}**`);
      if (result.error) {
        lines.push(`- Error: ${escapeMarkdown(result.error)}`);
      }
      if (result.stderr) {
        lines.push(`- stderr: \`${escapeMarkdown(result.stderr)}\``);
      }
      if (shouldShowOutput(false, showResults) && result.output && result.output.trim()) {
        lines.push('');
        lines.push('Output:');
        lines.push('```');
        lines.push(result.output);
        lines.push('```');
      }
      lines.push('');
    }
  }
  
  // Add output for successful queries with actual output
  const successfulWithOutput = results.filter(r => r.passed && r.output.trim() && shouldShowOutput(true, showResults));
  if (successfulWithOutput.length > 0) {
    lines.push('### Query Outputs');
    lines.push('');
    
    for (const result of successfulWithOutput) {
      lines.push(`**${escapeMarkdown(result.query)}**`);
      lines.push('');
      lines.push('```');
      lines.push(result.output);
      lines.push('```');
      lines.push('');
    }
  }
  
  return lines.join('\n');
}

/**
 * Set GitHub Actions outputs
 */
export function setOutputs(results: QueryResult[]): void {
  const allPassed = results.every(r => r.passed);
  
  core.setOutput('results', JSON.stringify(results));
  core.setOutput('passed', allPassed.toString());
  
  // Also set individual result outputs for easier access
  results.forEach((result, index) => {
    core.setOutput(`result-${index}`, JSON.stringify(result));
  });
}