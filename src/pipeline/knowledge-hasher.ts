/**
 * Knowledge Hasher - Single Source of Truth for Identity
 * 
 * IMPORTANT: This is the ONLY implementation of knowledge hashing.
 * All code (pipeline, replay, tests, verification) MUST use this class.
 * 
 * Identity: SHA256(canonical(type, subject, predicate, object))
 * Confidence and context are metadata, NOT identity.
 * 
 * KNOWLEDGE HASHER RESPONSIBILITIES:
 * - Produce deterministic identity hash (K4, K11)
 * - Provide binary comparison for replay
 * 
 * NOT RESPONSIBLE FOR:
 * - Sorting (see KnowledgeSorter)
 * - Validation (see validateKnowledge)
 */

import { createHash } from 'crypto';
import type { KnowledgeType } from '../types/common';

/**
 * Knowledge identity - what makes knowledge unique
 * Excludes all metadata (confidence, context, provenance)
 */
export interface KnowledgeIdentity {
  type: KnowledgeType;
  subject: string;
  predicate: string;
  object: string;
}

/**
 * Single hasher for all knowledge identity
 * 
 * Invariant K4: Hash = SHA256(canonical(type, subject, predicate, object))
 * Invariant K11: Hash identity never changes across versions
 * 
 * IMPORTANT: KnowledgeHasher assumes validated input.
 * Call validateKnowledge() before hashing to ensure:
 * - Non-empty subject/predicate/object
 * - Valid KnowledgeType enum
 * - No whitespace-only fields
 */
export class KnowledgeHasher {
  /**
   * Normalize text for canonical representation
   * 
   * Applies ONLY to human-readable text fields (subject, predicate, object).
   * Does NOT normalize enum-like identifiers (type).
   * 
   * Steps:
   * 1. Unicode NFC normalization (handles é = e + ́ vs é)
   * 2. Collapse whitespace
   * 3. Trim edges
   */
  private static normalizeText(text: string): string {
    return text
      .normalize('NFC')  // Unicode normalization
      .trim()
      .replace(/\s+/g, ' ');
  }
  
  /**
   * Create canonical JSON string from identity
   * 
   * IMPORTANT: Keys are inserted in deterministic order.
   * JavaScript preserves insertion order (NOT alphabetical).
   * 
   * DO NOT REORDER THESE FIELDS - order matters for determinism.
   */
  private static canonicalize(identity: KnowledgeIdentity): string {
    const canonical = {
      object: this.normalizeText(identity.object),
      predicate: this.normalizeText(identity.predicate),
      subject: this.normalizeText(identity.subject),
      type: identity.type  // Never normalize enum values
    };
    
    // Insertion order is preserved (not alphabetical)
    return JSON.stringify(canonical);
  }
  
  /**
   * Compute identity hash
   * 
   * Used for:
   * - Deduplication
   * - Replay verification
   * - Storage
   * 
   * PRECONDITION: Input must be validated (see validateKnowledge)
   */
  static hash(identity: KnowledgeIdentity): string {
    const canonical = this.canonicalize(identity);
    return createHash('sha256').update(canonical).digest('hex');
  }
  
  /**
   * Deterministic binary comparison for hashes
   * 
   * IMPORTANT: Never use localeCompare - it's locale-dependent
   * Always use binary/lexicographic ordering for replay determinism
   */
  static compareHashes(a: string, b: string): number {
    // Binary comparison (locale-independent)
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }
}
