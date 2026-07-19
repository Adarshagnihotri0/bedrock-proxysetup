/**
 * Full Pipeline: Evidence → Knowledge → Embeddings
 * 
 * Wires together all production components:
 * 1. EvidenceAdmissionPipeline (evidence storage)
 * 2. ExtractorRegistry (knowledge extraction)
 * 3. KnowledgeAdmissionPipeline (knowledge storage)
 * 4. Embedding backfill (vector embeddings)
 */

import type { Pool } from 'pg';
import type { Driver as Neo4jDriver } from 'neo4j-driver';
import { EvidenceAdmissionPipeline, CollectorOutput } from './admission-pipeline';
import { ExtractorRegistry } from '../extractors/extractor-registry';
import { KnowledgeAdmissionPipeline } from './knowledge-pipeline';
import { PostgresKnowledgeProvider } from '../adapters/postgres-knowledge-provider';
import { KnowledgeSupportProvider } from '../adapters/knowledge-support-provider';
import type { EvidenceProvider } from '../types/providers';
import type { Evidence } from '../types/knowledge';

export interface FullPipelineResult {
  evidenceId: string;
  knowledgeIds: string[];
  knowledgeCount: number;
  newKnowledgeCount: number;
}

export interface FullPipelineConfig {
  evidenceProvider: EvidenceProvider;
  knowledgeProvider: PostgresKnowledgeProvider;
  knowledgeSupportProvider: KnowledgeSupportProvider;
  getRepositoryContext: () => Promise<any>;
  getSessionContext: () => Promise<any>;
}

/**
 * Complete pipeline from collection to knowledge extraction
 * 
 * Flow:
 * CollectorOutput → Evidence → Extract → Knowledge → Store
 */
export class FullPipeline {
  private evidencePipeline: EvidenceAdmissionPipeline;
  private extractorRegistry: ExtractorRegistry;
  private knowledgePipeline: KnowledgeAdmissionPipeline;
  
  constructor(config: FullPipelineConfig) {
    this.evidencePipeline = new EvidenceAdmissionPipeline(
      config.evidenceProvider,
      config.getRepositoryContext,
      config.getSessionContext
    );
    
    this.extractorRegistry = new ExtractorRegistry();
    
    this.knowledgePipeline = new KnowledgeAdmissionPipeline(
      config.knowledgeProvider,
      config.knowledgeSupportProvider
    );
  }
  
  /**
   * Process collector output through full pipeline
   * 
   * Steps:
   * 1. Admit evidence (normalizes, validates, stores)
   * 2. Load stored evidence from DB
   * 3. Extract knowledge via all matching extractors
   * 4. Admit each extracted knowledge
   * 5. Return result with all IDs
   */
  async process(collectorOutput: CollectorOutput): Promise<FullPipelineResult> {
    // Step 1: Admit evidence
    const evidenceId = await this.evidencePipeline.process(collectorOutput);
    
    // Step 2: Load stored evidence
    const evidence = await this.loadEvidence(evidenceId);
    
    if (!evidence) {
      throw new Error(`Failed to load evidence: ${evidenceId}`);
    }
    
    // Step 3: Extract knowledge
    const extractedKnowledge = this.extractorRegistry.extract(evidence);
    
    if (extractedKnowledge.length === 0) {
      return {
        evidenceId,
        knowledgeIds: [],
        knowledgeCount: 0,
        newKnowledgeCount: 0
      };
    }
    
    // Step 4: Admit each extracted knowledge
    const knowledgeResults = [];
    let newCount = 0;
    
    for (const knowledge of extractedKnowledge) {
      const result = await this.knowledgePipeline.process({
        ...knowledge,
        evidenceId
      });
      
      knowledgeResults.push(result);
      
      if (result.isNew) {
        newCount++;
      }
    }
    
    return {
      evidenceId,
      knowledgeIds: knowledgeResults.map(r => r.knowledgeId),
      knowledgeCount: knowledgeResults.length,
      newKnowledgeCount: newCount
    };
  }
  
  /**
   * Load stored evidence from database
   */
  private async loadEvidence(evidenceId: string): Promise<Evidence | null> {
    // Use provider to load evidence
    // Note: This requires provider to support getById
    // For now, we'll query directly
    // TODO: Add getById to EvidenceProvider interface
    
    const { Pool } = await import('pg');
    const pg = new Pool({
      database: 'bedrock_proxy',
      user: process.env.PGUSER || 'adarshagnihotri'
    });
    
    try {
      const result = await pg.query(
        'SELECT * FROM evidence WHERE id = $1',
        [evidenceId]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      
      return {
        id: row.id,
        type: row.type,
        repository: row.repository,
        content: row.content,
        contentHash: row.content_hash,
        timestamp: row.timestamp,
        provenance: row.provenance
      };
    } finally {
      await pg.end();
    }
  }
}
