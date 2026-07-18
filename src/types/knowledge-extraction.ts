// Phase 2: Knowledge Types
// Purpose: Define knowledge models for extracted facts from evidence

import type { KnowledgeType } from './common';

/**
 * Knowledge - Extracted fact from evidence
 * 
 * Identity: KnowledgeIdentity (type, subject, predicate, object)
 * Confidence is metadata, NOT identity
 * Many evidence can support one knowledge via knowledge_support table
 * 
 * Use KnowledgeHasher for hashing (single source of truth - K11)
 */
export interface Knowledge {
  id: string;                    // UUID
  hash: string;                  // SHA256(identity) - computed by KnowledgeHasher
  evidenceId: string;             // First supporting evidence (FK)
  type: KnowledgeType;           // fact, relationship, inference
  subject: string;               // Entity
  predicate: string;             // Relation
  object: string;                // Value
  confidence: number;            // 0.0-1.0 (metadata, not identity)
  context: Record<string, unknown>;  // Type-safe context
  extractorName?: string;        // Extractor provenance
  extractorVersion?: number;     // Extraction rules version
  createdAt: Date;
}

export interface NewKnowledge {
  evidenceId: string;
  type: KnowledgeType;
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  context?: Record<string, unknown>;  // Changed from 'any' to 'unknown'
  extractorName?: string;            // Extractor provenance
  extractorVersion?: number;         // Default: 1
}

export interface KnowledgeFilters {
  type?: KnowledgeType;
  subject?: string;
  predicate?: string;
  object?: string;
  evidenceId?: string;
  minConfidence?: number;
  since?: Date;
  until?: Date;
  limit?: number;
  offset?: number;
}

export interface KnowledgeStats {
  totalCount: number;
  evidenceWithKnowledge: number;
  avgKnowledgePerEvidence: number;
  byType: Record<KnowledgeType, number>;
}
