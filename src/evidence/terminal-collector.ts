/**
 * Terminal Evidence Collector
 * 
 * Captures terminal output from command execution
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import type { Evidence } from '../types/knowledge';

const execAsync = promisify(exec);

export interface TerminalEvidence {
  type: 'terminal_output';
  repository: string;
  content: {
    command: string;
    stdout: string;
    stderr: string;
    exitCode: number;
    duration: number; // milliseconds
  };
  contentHash: string;
  timestamp: Date;
  provenance: any;
}

export class TerminalEvidenceCollector {
  private repository: string;
  private sessionId?: string;
  
  constructor(options: { repository: string; sessionId?: string }) {
    this.repository = options.repository;
    this.sessionId = options.sessionId;
  }
  
  /**
   * Execute a command and collect evidence
   */
  async executeAndCollect(
    command: string,
    options?: {
      timeout?: number;
      cwd?: string;
      env?: Record<string, string>;
    }
  ): Promise<TerminalEvidence> {
    const startTime = Date.now();
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: options?.cwd || this.repository,
        timeout: options?.timeout || 30000,
        env: { ...process.env, ...options?.env },
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });
      
      const duration = Date.now() - startTime;
      
      return {
        type: 'terminal_output',
        repository: this.repository,
        content: {
          command,
          stdout,
          stderr,
          exitCode: 0,
          duration
        },
        contentHash: '', // Will be set by provider
        timestamp: new Date(),
        provenance: {
          source: 'terminal.stdout',
          command,
          sessionId: this.sessionId,
          userId: process.env.USER
        }
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      // Command failed
      return {
        type: 'terminal_output',
        repository: this.repository,
        content: {
          command,
          stdout: error.stdout || '',
          stderr: error.stderr || error.message,
          exitCode: error.code || 1,
          duration
        },
        contentHash: '', // Will be set by provider
        timestamp: new Date(),
        provenance: {
          source: 'terminal.stderr',
          command,
          sessionId: this.sessionId,
          userId: process.env.USER
        }
      };
    }
  }
  
  /**
   * Wrap a command execution and returns both result and evidence
   */
  async wrap<T>(
    command: string,
    fn: () => Promise<T>
  ): Promise<{ result: T; evidence: TerminalEvidence }> {
    const startTime = Date.now();
    
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      
      const evidence: TerminalEvidence = {
        type: 'terminal_output',
        repository: this.repository,
        content: {
          command,
          stdout: JSON.stringify(result),
          stderr: '',
          exitCode: 0,
          duration
        },
        contentHash: '',
        timestamp: new Date(),
        provenance: {
          source: 'terminal.stdout',
          command,
          sessionId: this.sessionId
        }
      };
      
      return { result, evidence };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      const evidence: TerminalEvidence = {
        type: 'terminal_output',
        repository: this.repository,
        content: {
          command,
          stdout: '',
          stderr: error.message,
          exitCode: 1,
          duration
        },
        contentHash: '',
        timestamp: new Date(),
        provenance: {
          source: 'terminal.stderr',
          command,
          sessionId: this.sessionId
        }
      };
      
      throw { error, evidence };
    }
  }
  
  /**
   * Run npm command and collect evidence
   */
  async npm(command: string): Promise<TerminalEvidence> {
    const fullCommand = `npm ${command}`;
    return this.executeAndCollect(fullCommand);
  }
  
  /**
   * Run git command and collect evidence
   */
  async git(command: string): Promise<TerminalEvidence> {
    const fullCommand = `git ${command}`;
    return this.executeAndCollect(fullCommand);
  }
  
  /**
   * Run build and collect evidence (TypeScript, webpack, etc.)
   */
  async build(buildCommand: string = 'npm run build'): Promise<TerminalEvidence> {
    return this.executeAndCollect(buildCommand, { timeout: 120000 }); // 2 minutes
  }
  
  /**
   * Run tests and collect evidence
   */
  async test(testCommand: string = 'npm test'): Promise<TerminalEvidence> {
    return this.executeAndCollect(testCommand, { timeout: 60000 }); // 1 minute
  }
}

/**
 * Quick utility for collecting terminal evidence
 */
export function createTerminalCollector(options: {
  repository: string;
  sessionId?: string;
}): TerminalEvidenceCollector {
  return new TerminalEvidenceCollector(options);
}
