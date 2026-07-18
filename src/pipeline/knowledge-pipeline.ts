/**
 * Knowledge Admission Pipeline
 * 
 * Architecture:
 * - Uses KnowledgeHasher as single source of truth (K11)
 * - Many-to-one: Multiple evidence support single knowledge via knowledge_support
 * - Transactional: Knowledge + Support inserted atomically (K6, K12)
 * - Bounded LRU cache for performance
 * - DB-backed deduplication
 * - First-writer-wins concurrent admission (K13)
 * 
 * Confidence Semantics:
 * - knowledge.confidence: Canonical confidence (aggregate across all evidence)
 * - knowledge_support.confidence: Per-extraction confidence from THIS evidence
 * - K14: Confidence nullable pending Phase 3 aggregation
 */

import type { PoolClient } from 'pg';
import type { Knowledge, NewKnowledge } from '../types/knowledge-extraction';
import { KnowledgeType } from '../types/common';
import type { PostgresKnowledgeProvider } from '../adapters/postgres-knowledge-provider';
import type { KnowledgeSupportProvider } from '../adapters/knowledge-support-provider';
import { KnowledgeHasher } from './knowledge-hasher';
import { KnowledgeSorter } from './knowledge-sorter';

/**
 * Result of knowledge admission
 */
export interface KnowledgeAdmissionResult {
  knowledgeId: string;
  knowledgeHash: string;
  isNew: boolean;
  supportAdded: boolean; // True if support record created
  supportCount: number;  // Total support records (useful for Phase 3)
}

/**
 * Replay verification result
 * Returns detailed breakdown per user review request
 */
export interface ReplayVerificationResult {
  isValid: boolean;
  identityMatch: boolean;
  supportRecordCount: number;
  allSupportVerified: boolean;
  extractorMetadata: {
    hasName: boolean;
    hasVersion: boolean;
    name: string | null;
    version: number | null;
  };
}

/**
 * Pipeline errors
 */
export class KnowledgeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KnowledgeValidationError';
  }
}

/**
 * Validate knowledge before admission
 */
export function validateKnowledge(knowledge: NewKnowledge): void {
  // Evidence ID required
  if (!knowledge.evidenceId) {
    throw new KnowledgeValidationError('knowledge must reference evidence');
  }
  
  // Type must be valid
  const validTypes: KnowledgeType[] = ['fact', 'relationship', 'inference'];
  if (!validTypes.includes(knowledge.type)) {
    throw new KnowledgeValidationError(`invalid knowledge type: ${knowledge.type}`);
  }
  
  // Subject/Predicate/Object must be non-empty strings
  if (!knowledge.subject || typeof knowledge.subject !== 'string') {
    throw new KnowledgeValidationError('subject must be non-empty string');
  }
  if (!knowledge.predicate || typeof knowledge.predicate !== 'string') {
    throw new KnowledgeValidationError('predicate must be non-empty string');
  }
  if (!knowledge.object || typeof knowledge.object !== 'string') {
    throw new KnowledgeValidationError('object must be non-empty string');
  }
  
  // Confidence must be in [0, 1]
  if (knowledge.confidence < 0 || knowledge.confidence > 1) {
    throw new KnowledgeValidationError(`confidence must be in [0, 1], got ${knowledge.confidence}`);
  }
  
  // Confidence must be deterministic (no NaN, Infinity)
  if (!Number.isFinite(knowledge.confidence)) {
    throw new KnowledgeValidationError('confidence must be finite number');
  }
}

/**
 * Pipeline for admitting knowledge
 * 
 * Flow: Knowledge → Validate → Hash → Deduplicate → Store/Support
 * 
 * Many-to-One Architecture:
 * - Multiple evidence can support single knowledge fact
 * - Duplicate knowledge: Add support record (doesn't discard evidence)
 * - New knowledge: Create knowledge + support record
 * 
 * Uses KnowledgeHasher as single source of truth (K11)
 * 
 * Core invariants:
 * - K11: KnowledgeHasher is single source of truth
 * - K12: Knowledge must have support records
 * - K13: First-writer-wins for concurrent admissions
 * - K14: Confidence is nullable pending aggregation
 */
export class KnowledgeAdmissionPipeline {
  private provider: PostgresKnowledgeProvider;
  private supportProvider: KnowledgeSupportProvider;
  private cache: Map<string, string>; // Bounded LRU cache (max 10k entries)
  private readonly MAX_CACHE_SIZE = 10000;
  
  constructor(
    provider: PostgresKnowledgeProvider,
    supportProvider: KnowledgeSupportProvider
  ) {
    this.provider = provider;
    this.supportProvider = supportProvider;
    this.cache = new Map();
  }
  
  /**
   * Check if hash exists (DB-backed, not in-memory)
   * Uses bounded cache for hot hashes
   */
  private async checkHashExists(hash: string): Promise<string | null> {
    // Check bounded cache first
    const cachedId = this.cache.get(hash);
    if (cachedId) {
      return cachedId;
    }

    // DB query (no full table scan - uses index)
    const existingId = await this.provider.findByHash(hash);

    if (existingId) {
      // Add to cache
      this.cache.set(hash, existingId);

      // Evict oldest if cache full (simple LRU)
      if (this.cache.size > this.MAX_CACHE_SIZE) {
        const firstKey = this.cache.keys().next().value;
        if (firstKey) {
          this.cache.delete(firstKey);
        }
      }
    }

    return existingId;
  }

  /**
   * Admit knowledge through pipeline
   * 
   * Three cases:
   * 1. New knowledge: Create knowledge + support
   * 2. Existing knowledge, new evidence: Add support (preserve provenance!)
   * 3. Existing knowledge, existing evidence: Skip (idempotent)
   * 
   * Concurrent admission (K13):
   * Database UNIQUE(hash) constraint ensures first-writer-wins.
   * Loser catches 23505 and attaches support instead.
   */
  async process(knowledge: NewKnowledge): Promise<KnowledgeAdmissionResult> {
    // 1. Validate
    validateKnowledge(knowledge);

    // 2. Hash using KnowledgeHasher (single source of truth)
    const knowledgeHash = KnowledgeHasher.hash({
      type: knowledge.type,
      subject: knowledge.subject,
      predicate: knowledge.predicate,
      object: knowledge.object
    });

    // 3. Check for existing knowledge (bounded cache + DB check)
    const existingId = await this.checkHashExists(knowledgeHash);

    if (existingId) {
      // Knowledge already exists - add support record instead of discarding
      const alreadySupported = await this.supportProvider.hasSupport(
        existingId,
        knowledge.evidenceId
      );

      if (alreadySupported) {
        // Idempotent: this evidence already supports this knowledge
        const supportCount = await this.supportProvider.getKnowledgeCountForEvidence(knowledge.evidenceId);
        return {
          knowledgeId: existingId,
          knowledgeHash,
          isNew: false,
          supportAdded: false,
          supportCount
        };
      }

      // Add support record (preserve provenance!)
      await this.supportProvider.addSupport({
        knowledgeId: existingId,
        evidenceId: knowledge.evidenceId,
        confidence: knowledge.confidence,
        extractorName: knowledge.extractorName,
        extractorVersion: knowledge.extractorVersion
      });

      return {
        knowledgeId: existingId,
        knowledgeHash,
        isNew: false,
        supportAdded: true,
        supportCount: await this.supportProvider.getKnowledgeCountForEvidence(knowledge.evidenceId)
      };
    }

    // 4. New knowledge: ATOMIC transaction with race condition handling (K6, K12, K13)
    // Database enforces UNIQUE(hash) - we handle concurrent admission
    const client = await this.provider.getClient();

    try {
      await client.query('BEGIN');

      // Try to insert knowledge - database enforces UNIQUE(hash)
      let knowledgeId: string;
      let isNew = true;

      try {
        knowledgeId = await this.provider.storeWithClient(
          knowledge,
          knowledgeHash,
          client
        );
      } catch (error: unknown) {
        // Handle race condition: another transaction inserted same hash
        const pgError = error as { code?: string; constraint?: string };
        if (pgError.code === '23505' && pgError.constraint === 'knowledge_hash_key') {
          // UNIQUE constraint violation - another transaction won
          // Retrieve the winning knowledge ID and attach support
          const winnerId = await this.provider.findByHashWithClient(knowledgeHash, client);
          if (!winnerId) {
            // Should never happen - constraint triggered but no record found
            throw new Error('Race condition recovery failed: hash constraint violation but no existing record');
          }
          knowledgeId = winnerId;
          isNew = false;
        } else {
          throw error; // Re-throw unexpected errors
        }
      }

      // Insert support record (idempotent via ON CONFLICT DO NOTHING)
      await this.supportProvider.addSupport({
        knowledgeId,
        evidenceId: knowledge.evidenceId,
        confidence: knowledge.confidence,
        extractorName: knowledge.extractorName,
        extractorVersion: knowledge.extractorVersion
      }, client);

      await client.query('COMMIT');

      // Update cache only after successful commit
      this.cache.set(knowledgeHash, knowledgeId);

      return {
        knowledgeId,
        knowledgeHash,
        isNew,
        supportAdded: true,
        supportCount: isNew ? 1 : await this.supportProvider.getKnowledgeCountForEvidence(knowledge.evidenceId)
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Batch process multiple knowledge items
   * Uses KnowledgeSorter for deterministic binary ordering
   */
  async processBatch(knowledgeItems: NewKnowledge[]): Promise<KnowledgeAdmissionResult[]> {
    // Sort using KnowledgeSorter (SRP)
    const sorted = KnowledgeSorter.sortByIdentity(knowledgeItems);

    const results: KnowledgeAdmissionResult[] = [];

    for (const knowledge of sorted) {
      const result = await this.process(knowledge);
      results.push(result);
    }

    return results;
  }

  /**
   * Replay verification: Prove knowledge provenance and integrity
   * 
   * Returns detailed breakdown (not just true/false):
   * - Identity match (hash verification)
   * - Support edges (provenance)
   * - Extractor metadata (audit trail)
   */
  async verifyReplayDetailed(knowledgeId: string): Promise<ReplayVerificationResult> {
    // 1. Get knowledge from database (includes hash column)
    const stored = await this.provider.findById(knowledgeId);

    if (!stored) {
      return {
        isValid: false,
        identityMatch: false,
        supportRecordCount: 0,
        allSupportVerified: false,
        extractorMetadata: {
          hasName: false,
          hasVersion: false,
          name: null,
          version: null
        }
      };
    }

    // 2. Verify identity (hash)
    const recomputedHash = stored.hash
      ? KnowledgeHasher.hash({
          type: stored.type,
          subject: stored.subject,
          predicate: stored.predicate,
          object: stored.object
        })
      : null;

    const identityMatch = stored.hash !== null && stored.hash === recomputedHash;

    // 3. Get supporting evidence
    const support = await this.supportProvider.getSupportingEvidence(knowledgeId);
    const supportRecordCount = support.length;

    // 4. Verify all support records exist
    let allSupportVerified = true;
    for (const s of support) {
      const exists = await this.supportProvider.hasSupport(knowledgeId, s.evidenceId);
      if (!exists) {
        allSupportVerified = false;
        break;
      }
    }

    // 5. Extract metadata (any support record - they should be consistent)
    const firstSupport = support[0];
    const extractorMetadata = {
      hasName: firstSupport?.extractorName !== undefined && firstSupport?.extractorName !== null,
      hasVersion: firstSupport?.extractorVersion !== undefined && firstSupport?.extractorVersion !== null,
      name: firstSupport?.extractorName || null,
      version: firstSupport?.extractorVersion || null
    };

    const isValid = identityMatch && supportRecordCount > 0 && allSupportVerified;

    return {
      isValid,
      identityMatch,
      supportRecordCount,
      allSupportVerified,
      extractorMetadata
    };
  }

  /**
   * Legacy replay verification (backward compatibility)
   * 
   * Steps:
   * 1. Get knowledge from DB
   * 2. Get all supporting evidence
   * 3. Re-extract from first evidence
   * 4. Compare hashes
   * 
   * Verifies both identity AND provenance (K11)
   */
  async verifyReplay(knowledgeId: string): Promise<boolean> {
    const result = await this.verifyReplayDetailed(knowledgeId);
    return result.isValid;
  }
}
