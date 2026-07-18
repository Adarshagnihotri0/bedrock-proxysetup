/**
 * Knowledge Support Provider
 * 
 * Manages the many-to-one relationship between evidence and knowledge.
 * One knowledge fact can be supported by multiple evidence.
 * 
 * IMPORTANT: This provider supports transactional operations.
 * Use WITH transaction for atomicity (K6, K12).
 */

import { Pool, PoolClient } from 'pg';

/**
 * Support record linking evidence to knowledge
 */
export interface KnowledgeSupport {
  knowledgeId: string;
  evidenceId: string;
  confidence: number;
  extractorName?: string;
  extractorVersion?: number;
  extractedAt: Date;
}

/**
 * Provider for knowledge_support junction table
 * 
 * Transaction Safety: All write operations support transaction clients
 */
export class KnowledgeSupportProvider {
  constructor(private pool: Pool) {}
  
  /**
   * Add evidence support for existing knowledge
   * Used when duplicate knowledge is extracted from new evidence
   * 
   * CONFIDENCE SEMANTICS:
   * - This confidence is the extraction confidence from THIS evidence
   * - Different from knowledge.confidence (which is canonical confidence)
   * - This is per-extraction confidence (how confident was THIS extractor)
   */
  async addSupport(
    support: Omit<KnowledgeSupport, 'extractedAt'>,
    client?: PoolClient
  ): Promise<void> {
    const executor = client || this.pool;
    
    // REQUIRES extractor version - no silent defaults (per review)
    if (support.extractorVersion === undefined || support.extractorVersion === null) {
      throw new Error('extractorVersion is required - no silent defaults');
    }
    
    await executor.query(`
      INSERT INTO knowledge_support (
        knowledge_id, evidence_id, confidence, extractor_name, extractor_version
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (knowledge_id, evidence_id) DO NOTHING
    `, [
      support.knowledgeId,
      support.evidenceId,
      support.confidence,
      support.extractorName || null,
      support.extractorVersion
    ]);
  }
  
  /**
   * Get all evidence supporting a knowledge fact
   * 
   * NOTE: Returns unordered results
   * Replay should never depend on DB insertion order
   * If caller needs ordering, they should request it explicitly
   */
  async getSupportingEvidence(knowledgeId: string): Promise<KnowledgeSupport[]> {
    const { rows } = await this.pool.query(`
      SELECT * FROM knowledge_support
      WHERE knowledge_id = $1
    `, [knowledgeId]);
    
    return rows.map(row => ({
      knowledgeId: row.knowledge_id,
      evidenceId: row.evidence_id,
      confidence: parseFloat(row.confidence),
      extractorName: row.extractor_name,
      extractorVersion: row.extractor_version,
      extractedAt: row.extracted_at
    }));
  }
  
  /**
   * Get knowledge count for evidence
   * Returns how many knowledge facts this evidence supports
   */
  async getKnowledgeCountForEvidence(evidenceId: string): Promise<number> {
    const { rows } = await this.pool.query<{ count: string }>(`
      SELECT COUNT(*) as count
      FROM knowledge_support
      WHERE evidence_id = $1
    `, [evidenceId]);
    
    return parseInt(rows[0].count, 10);
  }
  
  /**
   * Check if evidence already supports a knowledge fact
   */
  async hasSupport(knowledgeId: string, evidenceId: string): Promise<boolean> {
    const { rows } = await this.pool.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM knowledge_support
        WHERE knowledge_id = $1 AND evidence_id = $2
      ) as exists
    `, [knowledgeId, evidenceId]);
    
    return rows[0].exists;
  }
}
