// Phase 2: Knowledge Extractor Interface
// Purpose: Define extraction contract for evidence types

import { Evidence } from './knowledge.js';
import { Knowledge, NewKnowledge } from './knowledge-extraction.js';

/**
 * Extractor for converting evidence into knowledge
 * 
 * Contract:
 * - Pure function: No side effects, no external state
 * - Deterministic: Same evidence → same knowledge
 * - Evidence-dependent: Must reference evidence.id
 */
export interface KnowledgeExtractor {
  /**
   * Check if this extractor handles the given evidence type
   */
  supports(evidenceType: string): boolean;
  
  /**
   * Extract knowledge from evidence
   * 
   * @param evidence - Evidence to extract from
   * @returns Array of knowledge facts (may be empty)
   * @throws Never (return empty array on error)
   * 
   * Guarantees:
   * - Each knowledge.evidenceId === evidence.id
   * - Extraction is deterministic
   * - Confidence in [0.0, 1.0]
   */
  extract(evidence: Evidence): NewKnowledge[];
}

/**
 * Registry of all extractors
 */
export interface ExtractorRegistry {
  /**
   * Get extractor for evidence type
   */
  getExtractor(evidenceType: string): KnowledgeExtractor | null;
  
  /**
   * Register extractor
   */
  register(extractor: KnowledgeExtractor): void;
  
  /**
   * Get all registered extractors
   */
  getAll(): KnowledgeExtractor[];
}
