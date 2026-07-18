// Phase 2: PostgreSQL Knowledge Provider
// Purpose: Store and query extracted knowledge

import { Pool, PoolClient } from 'pg';
import { Knowledge, NewKnowledge, KnowledgeFilters, KnowledgeStats } from '../types/knowledge-extraction.js';
import { KnowledgeType } from '../types/common.js';

export class PostgresKnowledgeProvider {
  constructor(private pool: Pool) {}
  
  /**
   * Get a database client for transactions
   */
  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }
  
  /**
   * Store extracted knowledge with hash (transaction-aware)
   * Hash is mandatory - enforces integrity
   * @returns Knowledge ID (UUID)
   */
  async store(knowledge: NewKnowledge, hash: string, client?: PoolClient): Promise<string> {
    if (!hash) {
      throw new Error('Hash is mandatory for knowledge storage');
    }
    
    const executor = client || this.pool;
    
    const result = await executor.query<{ id: string }>(`
      INSERT INTO knowledge (
        evidence_id, type, subject, predicate, object, confidence, context, hash,
        extractor_name, extractor_version
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `, [
      knowledge.evidenceId,
      knowledge.type,
      knowledge.subject,
      knowledge.predicate,
      knowledge.object,
      knowledge.confidence,
      knowledge.context || {},
      hash,
      knowledge.extractorName || null,
      knowledge.extractorVersion || 1
    ]);
    
    return result.rows[0].id;
  }
  
  /**
   * Alias for store() with explicit client for transactions
   */
  async storeWithClient(knowledge: NewKnowledge, hash: string, client: PoolClient): Promise<string> {
    return this.store(knowledge, hash, client);
  }
  
  /**
   * Find knowledge by hash (used for deduplication)
   * Returns ID if exists, null otherwise
   */
  async findByHash(hash: string): Promise<string | null> {
    const { rows } = await this.pool.query<{ id: string }>(`
      SELECT id FROM knowledge WHERE hash = $1 LIMIT 1
    `, [hash]);
    
    return rows[0]?.id || null;
  }
  
  /**
   * Find knowledge by hash within a transaction
   * Used for race condition recovery
   */
  async findByHashWithClient(hash: string, client: PoolClient): Promise<string | null> {
    const { rows } = await client.query<{ id: string }>(`
      SELECT id FROM knowledge WHERE hash = $1 LIMIT 1
    `, [hash]);
    
    return rows[0]?.id || null;
  }
  
  /**
   * Find knowledge by UUID
   */
  async findById(id: string): Promise<Knowledge | null> {
    const { rows } = await this.pool.query(`
      SELECT * FROM knowledge WHERE id = $1
    `, [id]);
    
    return rows[0] ? this.rowToKnowledge(rows[0]) : null;
  }
  
  /**
   * Find knowledge by evidence ID
   */
  async findByEvidenceId(evidenceId: string): Promise<Knowledge[]> {
    const { rows } = await this.pool.query(`
      SELECT * FROM knowledge WHERE evidence_id = $1 ORDER BY created_at
    `, [evidenceId]);
    
    return rows.map(this.rowToKnowledge);
  }
  
  /**
   * Query knowledge with filters
   */
  async query(filters: KnowledgeFilters): Promise<Knowledge[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramCount = 1;
    
    if (filters.type) {
      conditions.push(`type = $${paramCount++}`);
      values.push(filters.type);
    }
    
    if (filters.subject) {
      conditions.push(`subject = $${paramCount++}`);
      values.push(filters.subject);
    }
    
    if (filters.predicate) {
      conditions.push(`predicate = $${paramCount++}`);
      values.push(filters.predicate);
    }
    
    if (filters.object) {
      conditions.push(`object = $${paramCount++}`);
      values.push(filters.object);
    }
    
    if (filters.evidenceId) {
      conditions.push(`evidence_id = $${paramCount++}`);
      values.push(filters.evidenceId);
    }
    
    if (filters.minConfidence !== undefined) {
      conditions.push(`confidence >= $${paramCount++}`);
      values.push(filters.minConfidence);
    }
    
    if (filters.since) {
      conditions.push(`created_at >= $${paramCount++}`);
      values.push(filters.since);
    }
    
    if (filters.until) {
      conditions.push(`created_at <= $${paramCount++}`);
      values.push(filters.until);
    }
    
    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}`
      : '';
    
    const limitClause = filters.limit 
      ? `LIMIT $${paramCount++}`
      : '';
    
    const offsetClause = filters.offset 
      ? `OFFSET $${paramCount++}`
      : '';
    
    if (filters.limit) values.push(filters.limit);
    if (filters.offset) values.push(filters.offset);
    
    const { rows } = await this.pool.query(`
      SELECT * FROM knowledge
      ${whereClause}
      ORDER BY created_at DESC
      ${limitClause}
      ${offsetClause}
    `, values);
    
    return rows.map(this.rowToKnowledge);
  }
  
  /**
   * Find knowledge by subject
   */
  async findBySubject(subject: string): Promise<Knowledge[]> {
    const { rows } = await this.pool.query(`
      SELECT * FROM knowledge 
      WHERE subject = $1 
      ORDER BY created_at DESC
    `, [subject]);
    
    return rows.map(this.rowToKnowledge);
  }
  
  /**
   * Get knowledge statistics
   */
  async getStats(): Promise<KnowledgeStats> {
    const { rows } = await this.pool.query(`
      SELECT * FROM knowledge_stats
    `);
    
    const stats = rows[0];
    
    // Get breakdown by type
    const typeBreakdown = await this.pool.query<{ type: KnowledgeType; count: string }>(`
      SELECT type, COUNT(*) as count
      FROM knowledge
      GROUP BY type
    `);
    
    const byType: Record<KnowledgeType, number> = {
      fact: 0,
      relationship: 0,
      inference: 0
    };
    
    typeBreakdown.rows.forEach(row => {
      byType[row.type] = parseInt(row.count);
    });
    
    return {
      totalCount: parseInt(stats.total_knowledge),
      evidenceWithKnowledge: parseInt(stats.evidence_with_knowledge),
      avgKnowledgePerEvidence: parseFloat(stats.avg_knowledge_per_evidence) || 0,
      byType
    };
  }
  
  /**
   * Convert database row to Knowledge object
   */
  private rowToKnowledge(row: any): Knowledge {
    return {
      id: row.id,
      hash: row.hash,
      evidenceId: row.evidence_id,
      type: row.type,
      subject: row.subject,
      predicate: row.predicate,
      object: row.object,
      confidence: parseFloat(row.confidence),
      context: row.context || {},
      extractorName: row.extractor_name,
      extractorVersion: row.extractor_version,
      createdAt: row.created_at
    };
  }
}
