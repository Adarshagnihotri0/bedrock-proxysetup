/**
 * Git Evidence Collector
 * 
 * Collects evidence from Git operations:
 * - Diffs
 * - Commits
 * - Branches
 * - Tags
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { createHash } from 'crypto';
import type { Evidence } from '../types/knowledge';

const execAsync = promisify(exec);

export interface GitDiffEvidence {
  type: 'git_diff';
  repository: string;
  content: {
    files: Array<{
      path: string;
      additions: number;
      deletions: number;
      changes: string[];
    }>;
    commit?: string;
    branch?: string;
  };
  contentHash: string;
  timestamp: Date;
  provenance: any;
}

export interface GitCommitEvidence {
  type: 'git_commit';
  repository: string;
  content: {
    hash: string;
    message: string;
    author: string;
    timestamp: string;
    files: string[];
  };
  contentHash: string;
  timestamp: Date;
  provenance: any;
}

export class GitEvidenceCollector {
  
  /**
   * Collect evidence from git diff
   */
  static async collectDiff(
    repository: string,
    options?: {
      commit?: string;
      branch?: string;
      staged?: boolean;
    }
  ): Promise<GitDiffEvidence> {
    // Get git diff
    let command = 'git diff';
    if (options?.staged) command += ' --staged';
    if (options?.commit) command += ` ${options.commit}`;
    
    const { stdout: diffOutput } = await execAsync(command, { cwd: repository });
    
    // Parse diff output
    const files = this.parseDiffOutput(diffOutput);
    
    // Get current branch
    const { stdout: branchOutput } = await execAsync('git branch --show-current', { cwd: repository });
    const branch = branchOutput.trim() || options?.branch || 'unknown';
    
    // Get latest commit
    const { stdout: commitOutput } = await execAsync('git rev-parse HEAD', { cwd: repository });
    const commit = commitOutput.trim() || options?.commit;
    
    return {
      type: 'git_diff',
      repository,
      content: {
        files,
        commit,
        branch
      },
      contentHash: '', // Will be set by provider
      timestamp: new Date(),
      provenance: {
        source: 'git.diff',
        branch,
        commit,
        command
      }
    };
  }
  
  /**
   * Collect evidence from git commit
   */
  static async collectCommit(
    repository: string,
    commitHash?: string
  ): Promise<GitCommitEvidence> {
    const hash = commitHash || 'HEAD';
    
    // Get commit info
    const { stdout: commitInfo } = await execAsync(
      `git log -1 --format="%H|%s|%an|%aI" ${hash}`,
      { cwd: repository }
    );
    
    const [commit, message, author, timestamp] = commitInfo.trim().split('|');
    
    // Get files changed
    const { stdout: filesOutput } = await execAsync(
      `git diff-tree --no-commit-id --name-only -r ${commit}`,
      { cwd: repository }
    );
    
    const files = filesOutput.trim().split('\n').filter(f => f);
    
    return {
      type: 'git_commit',
      repository,
      content: {
        hash: commit,
        message,
        author,
        timestamp,
        files
      },
      contentHash: '', // Will be set by provider
      timestamp: new Date(),
      provenance: {
        source: 'git.commit',
        commit,
        file: files[0]
      }
    };
  }
  
  /**
   * Collect evidence from all uncommitted changes
   */
  static async collectUncommittedChanges(repository: string): Promise<GitDiffEvidence[]> {
    const evidences: GitDiffEvidence[] = [];
    
    // Check staged changes
    const { stdout: stagedCheck } = await execAsync('git diff --staged --quiet || echo "has_staged"', { cwd: repository });
    if (stagedCheck.includes('has_staged')) {
      const stagedEvidence = await this.collectDiff(repository, { staged: true });
      evidences.push(stagedEvidence);
    }
    
    // Check unstaged changes
    const { stdout: unstagedCheck } = await execAsync('git diff --quiet || echo "has_unstaged"', { cwd: repository });
    if (unstagedCheck.includes('has_unstaged')) {
      const unstagedEvidence = await this.collectDiff(repository, { staged: false });
      evidences.push(unstagedEvidence);
    }
    
    return evidences;
  }
  
  /**
   * Watch for git changes and collect evidence
   */
  static async watchAndCollect(
    repository: string,
    onEvidence: (evidence: GitDiffEvidence) => Promise<void>
  ): Promise<void> {
    // Get initial commit hash
    let lastCommit: string;
    try {
      const { stdout } = await execAsync('git rev-parse HEAD', { cwd: repository });
      lastCommit = stdout.trim();
    } catch {
      lastCommit = '';
    }
    
    // Poll for changes every 5 seconds
    const interval = setInterval(async () => {
      try {
        const { stdout: currentCommitOutput } = await execAsync('git rev-parse HEAD', { cwd: repository });
        const currentCommit = currentCommitOutput.trim();
        
        if (currentCommit !== lastCommit) {
          // New commit detected
          const evidence = await this.collectDiff(repository, { commit: currentCommit });
          await onEvidence(evidence);
          lastCommit = currentCommit;
        }
      } catch (error) {
        // Git command failed, ignore
      }
    }, 5000);
    
    // Return cleanup function
    return new Promise((resolve) => {
      process.on('SIGINT', () => {
        clearInterval(interval);
        resolve();
      });
    });
  }
  
  /**
   * Parse git diff output into structured format
   */
  private static parseDiffOutput(diffOutput: string): Array<{
    path: string;
    additions: number;
    deletions: number;
    changes: string[];
  }> {
    const files: Array<{
      path: string;
      additions: number;
      deletions: number;
      changes: string[];
    }> = [];
    
    const lines = diffOutput.split('\n');
    let currentFile: any = null;
    
    for (const line of lines) {
      // Match file header
      const fileMatch = line.match(/^diff --git a\/(.+) b\/(.+)$/);
      if (fileMatch) {
        if (currentFile) {
          files.push(currentFile);
        }
        currentFile = {
          path: fileMatch[2],
          additions: 0,
          deletions: 0,
          changes: []
        };
        continue;
      }
      
      if (!currentFile) continue;
      
      // Count additions
      if (line.startsWith('+') && !line.startsWith('+++')) {
        currentFile.additions++;
        currentFile.changes.push(line.slice(1));
      }
      
      // Count deletions
      if (line.startsWith('-') && !line.startsWith('---')) {
        currentFile.deletions++;
        currentFile.changes.push(line.slice(1));
      }
    }
    
    if (currentFile) {
      files.push(currentFile);
    }
    
    return files;
  }
}

/**
 * Quick utility to collect git diff
 */
export async function collectGitDiff(repository: string): Promise<GitDiffEvidence> {
  return GitEvidenceCollector.collectDiff(repository);
}
