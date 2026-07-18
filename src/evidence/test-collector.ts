/**
 * Test Evidence Collector
 * 
 * Collects evidence from test runs:
 * - Pass/fail status
 * - Coverage data
 * - Test durations
 * - Error messages
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import type { Evidence } from '../types/knowledge';

const execAsync = promisify(exec);

export interface TestEvidence {
  type: 'test_result';
  repository: string;
  content: {
    framework: string; // 'jest', 'pytest', 'go test', etc.
    passed: number;
    failed: number;
    skipped: number;
    total: number;
    duration: number;
    coverage?: {
      lines: number;
      branches: number;
      functions: number;
      statements: number;
    };
    failures: Array<{
      test: string;
      error: string;
      stack?: string;
    }>;
    success: boolean;
  };
  contentHash: string;
  timestamp: Date;
  provenance: any;
}

export interface CompilerEvidence {
  type: 'compiler_diagnostic';
  repository: string;
  content: {
    level: 'error' | 'warning' | 'info';
    file: string;
    line?: number;
    column?: number;
    message: string;
    code?: string;
    source: string; // 'typescript', 'eslint', etc.
  };
  contentHash: string;
  timestamp: Date;
  provenance: any;
}

export class TestEvidenceCollector {
  private repository: string;
  
  constructor(repository: string) {
    this.repository = repository;
  }
  
  /**
   * Run tests and collect evidence
   */
  async collectTests(command: string = 'npm test'): Promise<TestEvidence> {
    const startTime = Date.now();
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.repository,
        timeout: 60000,
        maxBuffer: 10 * 1024 * 1024
      });
      
      const duration = Date.now() - startTime;
      
      // Parse test output
      const testResults = this.parseTestOutput(stdout + stderr);
      
      return {
        type: 'test_result',
        repository: this.repository,
        content: {
          framework: 'test',
          ...testResults,
          duration,
          success: testResults.failed === 0
        },
        contentHash: '',
        timestamp: new Date(),
        provenance: {
          source: 'test.result',
          command
        }
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      // Parse error output
      const testResults = this.parseTestOutput(error.stdout + error.stderr + error.message);
      
      return {
        type: 'test_result',
        repository: this.repository,
        content: {
          framework: 'test',
          ...testResults,
          duration,
          success: false
        },
        contentHash: '',
        timestamp: new Date(),
        provenance: {
          source: 'test.result',
          command,
          file: testResults.failures[0]?.test
        }
      };
    }
  }
  
  /**
   * Run TypeScript compilation and collect diagnostics
   */
  async collectCompilerDiagnostics(): Promise<CompilerEvidence[]> {
    try {
      await execAsync('npx tsc --noEmit', {
        cwd: this.repository,
        timeout: 60000
      });
      
      // Compilation successful, no errors
      return [];
    } catch (error: any) {
      // Parse TypeScript errors
      return this.parseDiagnostics(error.stdout + error.stderr);
    }
  }
  
  /**
   * Run linter and collect evidence
   */
  async collectLintDiagnostics(command: string = 'npm run lint'): Promise<CompilerEvidence[]> {
    try {
      await execAsync(command, {
        cwd: this.repository,
        timeout: 30000
      });
      
      // Linting passed
      return [];
    } catch (error: any) {
      // Parse linter errors
      return this.parseLintOutput(error.stdout + error.stderr);
    }
  }
  
  /**
   * Parse test output (generic parser)
   */
  private parseTestOutput(output: string): {
    passed: number;
    failed: number;
    skipped: number;
    total: number;
    failures: Array<{ test: string; error: string; stack?: string }>;
    coverage?: any;
  } {
    const failures: Array<{ test: string; error: string; stack?: string }> = [];
    
    // Look for common test patterns
    const passedMatch = output.match(/(\d+)\s+(passing|passed|PASS)/i);
    const failedMatch = output.match(/(\d+)\s+(failing|failed|FAIL)/i);
    const skippedMatch = output.match(/(\d+)\s+(skipped|pending)/i);
    
    // Extract failure details
    const failureBlocks = output.split(/FAIL|✗|✖|FAILED/).slice(1);
    for (const block of failureBlocks) {
      const lines = block.trim().split('\n');
      if (lines.length > 0) {
        failures.push({
          test: lines[0].trim(),
          error: lines.slice(1, 3).join('\n').trim(),
          stack: lines.slice(3).join('\n').trim() || undefined
        });
      }
    }
    
    const passed = passedMatch ? parseInt(passedMatch[1]) : 0;
    const failed = failedMatch ? parseInt(failedMatch[1]) : failures.length;
    const skipped = skippedMatch ? parseInt(skippedMatch[1]) : 0;
    
    return {
      passed,
      failed,
      skipped,
      total: passed + failed + skipped,
      failures: failures.slice(0, 10), // Limit to 10 failures
      coverage: this.parseCoverage(output)
    };
  }
  
  /**
   * Parse coverage data from test output
   */
  private parseCoverage(output: string): { lines: number; branches: number; functions: number; statements: number } | undefined {
    // Look for coverage report
    const coverageMatch = output.match(/All files[^|]*\|[^|]*(\d+\.?\d*)[^|]*\|[^|]*(\d+\.?\d*)[^|]*\|[^|]*(\d+\.?\d*)[^|]*\|[^|]*(\d+\.?\d*)/);
    
    if (coverageMatch) {
      return {
        statements: parseFloat(coverageMatch[1]),
        branches: parseFloat(coverageMatch[2]),
        functions: parseFloat(coverageMatch[3]),
        lines: parseFloat(coverageMatch[4])
      };
    }
    
    return undefined;
  }
  
  /**
   * Parse TypeScript compiler diagnostics
   */
  private parseDiagnostics(output: string): CompilerEvidence[] {
    const diagnostics: CompilerEvidence[] = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      // Match TypeScript error format: file.ts(line,col): error TS1234: message
      const match = line.match(/^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$/);
      
      if (match) {
        diagnostics.push({
          type: 'compiler_diagnostic',
          repository: this.repository,
          content: {
            level: match[4] as 'error' | 'warning',
            file: match[1],
            line: parseInt(match[2]),
            column: parseInt(match[3]),
            message: match[6],
            code: match[5],
            source: 'typescript'
          },
          contentHash: '',
          timestamp: new Date(),
          provenance: {
            source: 'typescript.compiler',
            file: match[1],
            line: parseInt(match[2])
          }
        });
      }
    }
    
    return diagnostics;
  }
  
  /**
   * Parse linter output (ESLint)
   */
  private parseLintOutput(output: string): CompilerEvidence[] {
    const diagnostics: CompilerEvidence[] = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      // Match ESLint format: file:line:col  level  message  rule
      const match = line.match(/^(.+?):(\d+):(\d+)\s+(error|warning)\s+(.+?)\s{2,}(.+)$/);
      
      if (match) {
        diagnostics.push({
          type: 'compiler_diagnostic',
          repository: this.repository,
          content: {
            level: match[4] as 'error' | 'warning',
            file: match[1],
            line: parseInt(match[2]),
            column: parseInt(match[3]),
            message: match[5],
            code: match[6],
            source: 'eslint'
          },
          contentHash: '',
          timestamp: new Date(),
          provenance: {
            source: 'eslint.linter',
            file: match[1],
            line: parseInt(match[2])
          }
        });
      }
    }
    
    return diagnostics;
  }
}

/**
 * Quick utility for collecting test evidence
 */
export function createTestCollector(repository: string): TestEvidenceCollector {
  return new TestEvidenceCollector(repository);
}
