/**
 * Projection Types
 * 
 * Types for Phase 3 projection infrastructure.
 * These match the database schema from Phase 2 migrations.
 */

/**
 * Knowledge - Data from PostgreSQL knowledge table
 * 
 * Schema: migrations/005_create_knowledge.sql
 * Dedupe: migrations/006_add_knowledge_hash.sql
 */
export interface Knowledge {
  id: string;
  hash: string;
  
  // Knowledge triple (Phase 2 canonical form)
  subject: string;
  predicate: string;
  object: string;
  type: 'fact' | 'relationship' | 'inference';
  
  // Confidence from extraction
  confidence: number;
  
  // Evidence backing this knowledge (many-to-one)
  evidenceIds: string[];
  
  // Provenance for projection
  provenance: {
    createdAt?: Date;
    repository?: string;
    traceId?: string;
  };
}

/**
 * Projection Event
 * 
 * Event that triggers projection.
 * For now: Knowledge is the event.
 */
export type ProjectionEvent = Knowledge;
