/**
 * Retrieval Types - Query-to-Answer Pipeline
 * 
 * Purpose: Types for knowledge retrieval service
 * Phase: 2A - Read path validation
 */

export interface RetrievedKnowledge {
  id: string;
  score: number;
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  evidenceIds: string[];
  provenance: {
    repository?: string;
    createdAt?: Date;
    traceId?: string;
  };
}

export interface RetrievalOptions {
  limit?: number;
}

export interface RetrievalService {
  retrieve(query: string, options?: RetrievalOptions): Promise<RetrievedKnowledge[]>;
}
