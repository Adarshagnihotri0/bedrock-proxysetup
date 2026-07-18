// Phase 2: Terminal Output Extractor
// Purpose: Extract knowledge from terminal/command execution evidence

import { Evidence } from '../types/knowledge.js';
import { NewKnowledge } from '../types/knowledge-extraction.js';
import { KnowledgeExtractor } from '../types/extractors.js';

/**
 * Extracts knowledge from terminal_output evidence
 * 
 * Extraction Rules:
 * 1. Command execution facts (success/failure)
 * 2. Exit code knowledge
 * 3. Output pattern recognition
 * 4. Duration metrics
 */
export class TerminalOutputExtractor implements KnowledgeExtractor {
  
  supports(evidenceType: string): boolean {
    return evidenceType === 'terminal_output';
  }
  
  extract(evidence: Evidence): NewKnowledge[] {
    const knowledge: NewKnowledge[] = [];
    
    try {
      const content = evidence.content;
      const command = content.command || '';
      const exitCode = content.exitCode;
      const output = content.output || '';
      const stderr = content.stderr || '';
      const duration = content.duration;
      
      // Skip if no command
      if (!command) {
        return knowledge;
      }
      
      // Normalize command for subject (remove variations)
      const commandSubject = this.normalizeCommand(command);
      
      // Fact 1: Command execution success/failure
      knowledge.push({
        evidenceId: evidence.id,
        type: 'fact',
        subject: `command:${commandSubject}`,
        predicate: 'exit_code',
        object: exitCode.toString(),
        confidence: 1.0,
        context: { duration },
        extractorName: 'TerminalOutputExtractor',
        extractorVersion: 1
      });
      
      // Fact 2: Success state
      knowledge.push({
        evidenceId: evidence.id,
        type: 'fact',
        subject: `command:${commandSubject}`,
        predicate: 'succeeded',
        object: exitCode === 0 ? 'true' : 'false',
        confidence: 1.0,
        context: {},
        extractorName: 'TerminalOutputExtractor',
        extractorVersion: 1
      });
      
      // Fact 3: Error patterns (if failed)
      if (exitCode !== 0) {
        const errorType = this.classifyError(output, stderr);
        if (errorType) {
          knowledge.push({
            evidenceId: evidence.id,
            type: 'fact',
            subject: `command:${commandSubject}`,
            predicate: 'error_type',
            object: errorType,
            confidence: 0.9,
            context: { output_sample: output.substring(0, 200) },
            extractorName: 'TerminalOutputExtractor',
            extractorVersion: 1
          });
        }
      }
      
      // Fact 4: Output patterns
      const patterns = this.extractPatterns(output);
      patterns.forEach(pattern => {
        knowledge.push({
          evidenceId: evidence.id,
          type: 'fact',
          subject: `command:${commandSubject}`,
          predicate: 'output_contains',
          object: pattern,
          extractorName: 'TerminalOutputExtractor',
          extractorVersion: 1,
          confidence: 0.95,
          context: {}
        });
      });
      
      // Fact 5: Duration bucket (if available)
      if (duration !== undefined && duration !== null) {
        const durationBucket = this.classifyDuration(duration);
        knowledge.push({
          evidenceId: evidence.id,
          type: 'fact',
          subject: `command:${commandSubject}`,
          predicate: 'duration_bucket',
          object: durationBucket,
          confidence: 1.0,
          context: { duration_ms: duration },
          extractorName: 'TerminalOutputExtractor',
          extractorVersion: 1
        });
      }
      
    } catch (error) {
      // Silently return empty array on extraction errors
      // Pure extractor: no side effects allowed
    }
    
    return knowledge;
  }
  
  /**
   * Normalize command for consistent subjects
   * Example: "npm run test --watch" → "npm_run_test"
   */
  private normalizeCommand(command: string): string {
    return command
      .split(' ')
      .slice(0, 3) // First 3 parts
      .map(part => part.replace(/[^a-zA-Z0-9_-]/g, ''))
      .filter(part => part.length > 0)
      .join('_')
      .toLowerCase();
  }
  
  /**
   * Classify error type from output
   */
  private classifyError(stdout: string, stderr: string): string | null {
    const combined = (stdout + ' ' + stderr).toLowerCase();
    
    if (combined.includes('enoent') || combined.includes('no such file')) {
      return 'file_not_found';
    }
    if (combined.includes('eacces') || combined.includes('permission denied')) {
      return 'permission_denied';
    }
    if (combined.includes('etimedout') || combined.includes('timeout')) {
      return 'timeout';
    }
    if (combined.includes('syntax error') || combined.includes('unexpected token')) {
      return 'syntax_error';
    }
    if (combined.includes('cannot find module')) {
      return 'missing_dependency';
    }
    if (combined.includes('compilation failed') || combined.includes('build failed')) {
      return 'build_failure';
    }
    
    return null;
  }
  
  /**
   * Extract meaningful patterns from output
   */
  private extractPatterns(output: string): string[] {
    const patterns: string[] = [];
    const lines = output.split('\n').slice(0, 20); // First 20 lines
    
    for (const line of lines) {
      // Match common patterns
      if (line.includes('PASS') || line.includes('✓')) {
        patterns.push('pass_indicator');
      }
      if (line.includes('FAIL') || line.includes('✗')) {
        patterns.push('fail_indicator');
      }
      if (line.includes('error') || line.includes('Error')) {
        patterns.push('error_message');
      }
      if (line.includes('warning') || line.includes('Warning')) {
        patterns.push('warning_message');
      }
    }
    
    return [...new Set(patterns)]; // Dedupe
  }
  
  /**
   * Classify duration into buckets
   */
  private classifyDuration(durationMs: number): string {
    if (durationMs < 100) return 'instant';
    if (durationMs < 1000) return 'fast';
    if (durationMs < 5000) return 'medium';
    if (durationMs < 30000) return 'slow';
    return 'very_slow';
  }
}
