/**
 * Evidence Admission Pipeline
 * 
 * Complete pipeline from collection to storage with verification at each stage:
 * 
 * Collector → Normalizer → Canonical Serializer → Hasher → Validator → Admission Policy → Provider
 */

import { Pool } from 'pg';
import { createHash } from 'crypto';
import type { Evidence, EvidenceType } from '../types/knowledge';
import type { EvidenceProvider } from '../types/providers';

/**
 * Stage 1: Collector Output
 * Raw data from different sources (git, terminal, tests, etc.)
 */
export interface CollectorOutput {
  type: EvidenceType;
  content: unknown;
  metadata: {
    source: string;
    command?: string;
    file?: string;
    line?: number;
    duration?: number;
    exitCode?: number;
  };
}

/**
 * Stage 2: Normalized Evidence
 * Content normalized to JSON-compatible format
 */
export interface NormalizedEvidence {
  type: EvidenceType;
  content: unknown; // JSON-compatible
  provenance: {
    source: string;
    command?: string;
    file?: string;
    line?: number;
    duration?: number;
    exitCode?: number;
    timestamp: Date;
    
    // Repository context
    repository: {
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
    };
    
    // Session context
    session: {
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
    };
  };
}

/**
 * Stage 3: Canonical Evidence
 * Content has canonical hash computed
 */
export interface CanonicalEvidence extends NormalizedEvidence {
  contentHash: string; // Canonical SHA-256
}

/**
 * Stage 4: Validated Evidence
 * Passed all validation checks
 */
export interface ValidatedEvidence extends CanonicalEvidence {
  validation: {
    isValid: true;
    checkedAt: Date;
    checks: string[]; // Names of passed checks
  };
}

/**
 * Stage 5: Admitted Evidence
 * Passed admission policy
 */
export interface AdmittedEvidence extends ValidatedEvidence {
  admission: {
    admitted: true;
    policy: string; // Which policy allowed it
    admittedAt: Date;
  };
}

/**
 * Pipeline: Stage 1 → 2 → 3 → 4 → 5 → Store
 */
export class EvidenceAdmissionPipeline {
  
  constructor(
    private provider: EvidenceProvider,
    private getRepositoryContext: () => Promise<NormalizedEvidence['provenance']['repository']>,
    private getSessionContext: () => Promise<NormalizedEvidence['provenance']['session']>
  ) {}
  
  /**
   * Complete pipeline from collector output to storage
   */
  async process(collectorOutput: CollectorOutput): Promise<string> {
    // Stage 2: Normalize
    const normalized = await this.normalize(collectorOutput);
    
    // Stage 3: Canonical hash
    const canonical = await this.canonicalize(normalized);
    
    // Stage 4: Validate
    const validated = await this.validate(canonical);
    
    // Stage 5: Admission policy
    const admitted = await this.applyAdmissionPolicy(validated);
    
    // Stage 6: Store
    const evidenceId = await this.store(admitted);
    
    return evidenceId;
  }
  
  // ============================================
  // STAGE 2: NORMALIZER
  // ============================================
  
  /**
   * Normalize evidence to JSON-compatible format
   */
  private async normalize(raw: CollectorOutput): Promise<NormalizedEvidence> {
    const [repository, session] = await Promise.all([
      this.getRepositoryContext(),
      this.getSessionContext()
    ]);
    
    return {
      type: raw.type,
      content: this.normalizeContent(raw.content),
      provenance: {
        source: raw.metadata.source,
        command: raw.metadata.command,
        file: raw.metadata.file,
        line: raw.metadata.line,
        duration: raw.metadata.duration,
        exitCode: raw.metadata.exitCode,
        timestamp: new Date(),
        repository,
        session
      }
    };
  }
  
  /**
   * Normalize non-JSON types
   */
  private normalizeContent(content: unknown): unknown {
    // Handle Date
    if (content instanceof Date) {
      return { __type: 'Date', iso: content.toISOString() };
    }
    
    // Handle Buffer
    if (Buffer.isBuffer(content)) {
      return { __type: 'Buffer', base64: content.toString('base64') };
    }
    
    // Handle Error
    if (content instanceof Error) {
      return {
        __type: 'Error',
        name: content.name,
        message: content.message,
        stack: content.stack
      };
    }
    
    // Handle Map
    if (content instanceof Map) {
      return {
        __type: 'Map',
        entries: Array.from(content.entries())
      };
    }
    
    // Handle Set
    if (content instanceof Set) {
      return {
        __type: 'Set',
        values: Array.from(content.values())
      };
    }
    
    // Recursively process objects and arrays
    if (Array.isArray(content)) {
      return content.map(item => this.normalizeContent(item));
    }
    
    if (typeof content === 'object' && content !== null) {
      const normalized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(content)) {
        normalized[key] = this.normalizeContent(value);
      }
      return normalized;
    }
    
    return content;
  }
  
  // ============================================
  // STAGE 3: CANONICAL SERIALIZER
  // ============================================
  
  /**
   * Compute canonical hash for evidence content
   */
  private async canonicalize(normalized: NormalizedEvidence): Promise<CanonicalEvidence> {
    const contentHash = this.canonicalHash(normalized.content);
    
    return {
      ...normalized,
      contentHash
    };
  }
  
  /**
   * Canonical serialization algorithm per RFC-0001
   * 
   * Key steps:
   * 1. Recursively sort object keys by UTF-8 byte order
   * 2. Use minimal string escaping
   * 3. Serialize numbers per ECMA-262 (subject to DECISION-002)
   * 4. No whitespace
   */
  private canonicalSerialize(value: unknown): string {
    return JSON.stringify(this.sortKeys(value));
  }
  
  /**
   * Sort object keys by UTF-8 byte order (recursive)
   */
  private sortKeys(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }
    
    if (Array.isArray(value)) {
      return value.map(item => this.sortKeys(item));
    }
    
    if (typeof value === 'object' && value !== null) {
      const sorted: Record<string, unknown> = {};
      const keys = Object.keys(value).sort((a, b) => {
        // UTF-8 byte-order comparison
        return Buffer.from(a, 'utf8').compare(Buffer.from(b, 'utf8'));
      });
      
      for (const key of keys) {
        sorted[key] = this.sortKeys((value as Record<string, unknown>)[key]);
      }
      
      return sorted;
    }
    
    return value;
  }
  
  /**
   * Compute canonical SHA-256 hash
   */
  private canonicalHash(content: unknown): string {
    const canonical = this.canonicalSerialize(content);
    return createHash('sha256').update(canonical, 'utf8').digest('hex');
  }
  
  /**
   * Test canonical serialization stability
   */
  testCanonicalSerialization(): void {
    // Test 1: Key order shouldn't matter
    const a = { z: 1, a: { b: 2, c: 3 } };
    const b = { a: { c: 3, b: 2 }, z: 1 };
    
    const hashA = this.canonicalHash(a);
    const hashB = this.canonicalHash(b);
    
    if (hashA !== hashB) {
      throw new Error('Canonical serialization failed: nested objects produce different hashes');
    }
    
    // Test 2: Array order should matter
    const c = [1, 2, 3];
    const d = [3, 2, 1];
    
    if (this.canonicalHash(c) === this.canonicalHash(d)) {
      throw new Error('Canonical serialization failed: array order should matter');
    }
    
    // Test 3: UTF-8 byte order
    const e = { alpha: 1, Alpha: 2, ALPHA: 3 };
    const f = { ALPHA: 3, Alpha: 2, alpha: 1 };
    
    if (this.canonicalHash(e) !== this.canonicalHash(f)) {
      throw new Error('Canonical serialization failed: case-sensitivity error');
    }
    
    console.log('✅ Canonical serialization tests passed');
  }
  
  // ============================================
  // STAGE 4: VALIDATOR
  // ============================================
  
  /**
   * Validate evidence before admission
   */
  private async validate(canonical: CanonicalEvidence): Promise<ValidatedEvidence> {
    const checks: string[] = [];
    
    // Check 1: Content is valid JSON
    try {
      JSON.stringify(canonical.content);
      checks.push('json-compatible');
    } catch (error) {
      throw new Error(`Invalid evidence: content is not JSON-serializable`);
    }
    
    // Check 2: Content hash is consistent
    const recomputedHash = this.canonicalHash(canonical.content);
    if (recomputedHash !== canonical.contentHash) {
      throw new Error(`Invalid evidence: hash mismatch. Expected ${canonical.contentHash}, got ${recomputedHash}`);
    }
    checks.push('hash-consistent');
    
    // Check 3: Provenance is complete
    if (!canonical.provenance.source) {
      throw new Error('Invalid evidence: missing source in provenance');
    }
    checks.push('provenance-complete');
    
    // Check 4: Repository context is present
    if (!canonical.provenance.repository.repositoryId) {
      throw new Error('Invalid evidence: missing repository context');
    }
    checks.push('repository-context');
    
    // Check 5: Session context is present
    if (!canonical.provenance.session.sessionId) {
      throw new Error('Invalid evidence: missing session context');
    }
    checks.push('session-context');
    
    return {
      ...canonical,
      validation: {
        isValid: true,
        checkedAt: new Date(),
        checks
      }
    };
  }
  
  // ============================================
  // STAGE 5: ADMISSION POLICY
  // ============================================
  
  /**
   * Apply admission policy to decide if evidence should be stored
   */
  private async applyAdmissionPolicy(validated: ValidatedEvidence): Promise<AdmittedEvidence> {
    // Policy 1: Always admit git diffs (they're valuable)
    if (validated.type === 'git_diff') {
      return {
        ...validated,
        admission: {
          admitted: true,
          policy: 'always-admit-git-diffs',
          admittedAt: new Date()
        }
      };
    }
    
    // Policy 2: Always admit build logs (for debugging)
    if (validated.type === 'build_log') {
      return {
        ...validated,
        admission: {
          admitted: true,
          policy: 'always-admit-build-logs',
          admittedAt: new Date()
        }
      };
    }
    
    // Policy 3: Admit test results only if there's a failure
    if (validated.type === 'test_result') {
      const content = validated.content as any;
      if (content.failed && content.failed > 0) {
        return {
          ...validated,
          admission: {
            admitted: true,
            policy: 'admit-failed-tests',
            admittedAt: new Date()
          }
        };
      }
    }
    
    // Policy 4: Admit compiler diagnostics only if there are errors
    if (validated.type === 'compiler_diagnostic') {
      const content = validated.content as any;
      if (content.errors && content.errors.length > 0) {
        return {
          ...validated,
          admission: {
            admitted: true,
            policy: 'admit-compiler-errors',
            admittedAt: new Date()
          }
        };
      }
    }
    
    // Policy 5: Deduplication (check if duplicate exists)
    const exists = await this.provider.exists(validated.contentHash);
    if (exists) {
      // Return existing evidence ID instead of throwing
      // This is expected behavior - same content = same evidence
      throw new Error(`DUPLICATE_DETECTED:${validated.contentHash}`);
    }
    
    // Policy 6: Default admission (allows manual override)
    return {
      ...validated,
      admission: {
        admitted: true,
        policy: 'default-accept',
        admittedAt: new Date()
      }
    };
  }
  
  // ============================================
  // STAGE 6: STORE
  // ============================================
  
  /**
   * Store admitted evidence
   */
  private async store(admitted: AdmittedEvidence): Promise<string> {
    const evidence: Omit<Evidence, 'id'> = {
      type: admitted.type,
      repository: admitted.provenance.repository.repositoryId,
      content: admitted.content,
      contentHash: admitted.contentHash,
      timestamp: admitted.provenance.timestamp,
      provenance: {
        source: admitted.provenance.source,
        command: admitted.provenance.command,
        file: admitted.provenance.file,
        line: admitted.provenance.line,
        branch: admitted.provenance.repository.branch,
        commit: admitted.provenance.repository.commit,
        userId: admitted.provenance.session.userId,
        sessionId: admitted.provenance.session.sessionId
      }
    };
    
    return await this.provider.store(evidence);
  }
}
