/**
 * Context Builders
 * 
 * Builds complete repository and session context for evidence provenance.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as crypto from 'crypto';

const execAsync = promisify(exec);

/**
 * Repository Context (per your feedback: strong identity)
 */
export interface RepositoryContext {
  repositoryId: string;
  branch: string;
  commit: string;
  name: string;
  path: string;
  remote?: string;
  gitStatus: {
    isClean: boolean;
    aheadBehind: { ahead: number; behind: number };
    uncommittedFiles: number;
  };
}

/**
 * Session Context (complete provenance per your feedback)
 */
export interface SessionContext {
  sessionId: string;
  userId: string;
  pid: number;
  cwd: string;
  hostname: string;
  platform: string;
  arch: string;
  runtime: string;
  agent: string;
  tool: string;
  startedAt: Date;
}

/**
 * Build repository context from current working directory
 */
export async function buildRepositoryContext(repoPath: string, repoName: string): Promise<RepositoryContext> {
  try {
    // Get current branch
    const { stdout: branch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: repoPath });
    
    // Get current commit (full SHA)
    const { stdout: commit } = await execAsync('git rev-parse HEAD', { cwd: repoPath });
    
    // Get remote URL
    let remote: string | undefined;
    try {
      const { stdout: remoteUrl } = await execAsync('git config --get remote.origin.url', { cwd: repoPath });
      remote = remoteUrl.trim();
    } catch {
      // No remote configured
    }
    
    // Get git status
    const { stdout: status } = await execAsync('git status --porcelain', { cwd: repoPath });
    
    // Get ahead/behind count
    let aheadBehind = { ahead: 0, behind: 0 };
    try {
      const { stdout: aheadBehindStr } = await execAsync(
        'git rev-list --left-right --count @{upstream}...HEAD',
        { cwd: repoPath }
      );
      const [behind, ahead] = aheadBehindStr.trim().split(/\s+/).map(Number);
      aheadBehind = { ahead: ahead || 0, behind: behind || 0 };
    } catch {
      // No upstream configured
    }
    
    // Create repository ID from remote URL OR path hash
    // Per your feedback: Prevent collisions between repos with same folder name
    const repositoryId = remote
      ? crypto.createHash('sha256').update(remote).digest('hex').substring(0, 16)
      : crypto.createHash('sha256').update(repoPath).digest('hex').substring(0, 16);
    
    return {
      repositoryId,
      branch: branch.trim(),
      commit: commit.trim(),
      name: repoName,
      path: repoPath,
      remote,
      gitStatus: {
        isClean: status.trim().length === 0,
        aheadBehind,
        uncommittedFiles: status.trim().split('\n').filter(Boolean).length
      }
    };
  } catch (error) {
    // Not a git repository - use path-based ID
    return {
      repositoryId: crypto.createHash('sha256').update(repoPath).digest('hex').substring(0, 16),
      branch: 'none',
      commit: 'none',
      name: repoName,
      path: repoPath,
      gitStatus: {
        isClean: true,
        aheadBehind: { ahead: 0, behind: 0 },
        uncommittedFiles: 0
      }
    };
  }
}

/**
 * Build session context from current process
 */
export async function buildSessionContext(
  userId: string,
  agent: string,
  tool: string
): Promise<SessionContext> {
  return {
    sessionId: crypto.randomUUID(),
    userId,
    pid: process.pid,
    cwd: process.cwd(),
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    runtime: `node-${process.version}`,
    agent,
    tool,
    startedAt: new Date()
  };
}

/**
 * Test repository isolation
 */
export async function testRepositoryIsolation(): Promise<void> {
  const repo1 = await buildRepositoryContext('/work/app1', 'app');
  const repo2 = await buildRepositoryContext('/home/user/app2', 'app');
  
  if (repo1.repositoryId === repo2.repositoryId) {
    throw new Error('Repository isolation failed: different paths produced same ID');
  }
  
  // Same repo should produce same ID
  const repo1Again = await buildRepositoryContext('/work/app1', 'app');
  
  if (repo1.repositoryId !== repo1Again.repositoryId) {
    throw new Error('Repository stability failed: same path produced different ID');
  }
  
  console.log('✅ Repository isolation tests passed');
}

/**
 * Test session uniqueness
 */
export async function testSessionUniqueness(): Promise<void> {
  const session1 = await buildSessionContext('user1', 'test-agent', 'test-tool');
  const session2 = await buildSessionContext('user1', 'test-agent', 'test-tool');
  
  if (session1.sessionId === session2.sessionId) {
    throw new Error('Session uniqueness failed: two sessions have same ID');
  }
  
  console.log('✅ Session uniqueness tests passed');
}
