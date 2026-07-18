/**
 * PostgreSQL Evidence Provider
 * 
 * Production implementation of EvidenceProvider interface.
 * Stores evidence in PostgreSQL with automatic deduplication.
 * 
 * Architecture:
 * - Uses JSONB for flexible content storage
 * - SHA-256 content hashing for deduplication
 * - Provenance tracking for every evidence
 * - Indexed for fast queries
 */

import type { EvidenceProvider } from '../types/providers';
import type { Evidence } from '../types/knowledge';
import { Pool, QueryResult } from 'pg';
import { createHash } from 'crypto';

export class PostgresEvidenceProvider implements EvidenceProvider {
  constructor(private pool: Pool) {}

  /**
   * Store evidence with automatic deduplication
   * Returns existing ID if duplicate, new ID otherwise
   */
  async store(evidence: Omit<Evidence, 'id'>): Promise<string> {
    const client = await this.pool.connect();
    
    try {
      // Use provided hash (computed by pipeline)
      // DO NOT recalculate - hash is already canonical
      const contentHash = evidence.contentHash;
      
      // Verify hash length
      if (contentHash.length !== 64) {
        throw new Error(`Invalid hash length: ${contentHash.length} (expected 64 for SHA-256)`);
      }
      
      // Call stored procedure (handles deduplication)
      const result = await client.query<{
        insert_evidence: string;
      }>(
        `SELECT insert_evidence($1, $2, $3, $4, $5, $6) as insert_evidence`,
        [
          evidence.type,
          evidence.repository,
          JSON.stringify(evidence.content),
          contentHash,
          JSON.stringify(evidence.provenance),
          evidence.timestamp
        ]
      );
      
      return result.rows[0].insert_evidence;
    } finally {
      client.release();
    }
  }

  /**
   * Retrieve evidence by ID
   */
  async get(id: string): Promise<Evidence | null> {
    const result = await this.pool.query<{
      id: string;
      type: Evidence['type'];
      repository: string;
      content: any;
      content_hash: string;
      timestamp: Date;
      provenance: any;
    }>(
      'SELECT * FROM evidence WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.rowToEvidence(result.rows[0]);
  }

  /**
   * Query evidence by repository and type
   */
  async query(params: {
    repository: string;
    type?: Evidence['type'];
    since?: Date;
    limit?: number;
  }): Promise<Evidence[]> {
    let query = 'SELECT * FROM evidence WHERE repository = $1';
    const values: any[] = [params.repository];
    let paramIndex = 2;
    
    if (params.type) {
      query += ` AND type = $${paramIndex}`;
      values.push(params.type);
      paramIndex++;
    }
    
    if (params.since) {
      query += ` AND timestamp >= $${paramIndex}`;
      values.push(params.since);
      paramIndex++;
    }
    
    query += ' ORDER BY timestamp DESC';
    
    if (params.limit) {
      query += ` LIMIT $${paramIndex}`;
      values.push(params.limit);
    }
    
    const result = await this.pool.query(query, values);
    
    return result.rows.map(row => this.rowToEvidence(row));
  }

  /**
   * Get all evidence by IDs (used for knowledge validation)
   */
  async getAll(ids: string[]): Promise<Evidence[]> {
    if (ids.length === 0) return [];
    
    const result = await this.pool.query(
      'SELECT * FROM evidence WHERE id = ANY($1)',
      [ids]
    );
    
    return result.rows.map(row => this.rowToEvidence(row));
  }

  /**
   * Check if evidence with this content hash exists
   */
  async exists(contentHash: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT evidence_exists($1) as exists',
      [contentHash]
    );
    
    return result.rows[0].exists;
  }

  /**
   * Get statistics about evidence storage
   */
  async getStats(repository?: string): Promise<{
    totalCount: number;
    uniqueCount: number;
    duplicateCount: number;
    byType: Record<string, number>;
  }> {
    if (repository) {
      const result = await this.pool.query(`
        SELECT 
          COUNT(*) as total_count,
          COUNT(DISTINCT content_hash) as unique_count,
          type,
          COUNT(*) as type_count
        FROM evidence
        WHERE repository = $1
        GROUP BY type, grouping sets ((type), ())
      `, [repository]);
      
      const stats: any = {
        totalCount: 0,
        uniqueCount: 0,
        duplicateCount: 0,
        byType: {}
      };
      
      for (const row of result.rows) {
        if (row.type === null) {
          stats.totalCount = parseInt(row.total_count);
          stats.uniqueCount = parseInt(row.unique_count);
          stats.duplicateCount = stats.totalCount - stats.uniqueCount;
        } else {
          stats.byType[row.type] = parseInt(row.type_count);
        }
      }
      
      return stats;
    }
    
    // Global stats
    const result = await this.pool.query(`
      SELECT 
        COUNT(*) as total_count,
        COUNT(DISTINCT content_hash) as unique_count,
        type,
        COUNT(*) as type_count
      FROM evidence
      GROUP BY type, grouping sets ((type), ())
    `);
    
    const stats: any = {
      totalCount: 0,
      uniqueCount: 0,
      duplicateCount: 0,
      byType: {}
    };
    
    for (const row of result.rows) {
      if (row.type === null) {
        stats.totalCount = parseInt(row.total_count);
        stats.uniqueCount = parseInt(row.unique_count);
        stats.duplicateCount = stats.totalCount - stats.uniqueCount;
      } else {
        stats.byType[row.type] = parseInt(row.type_count);
      }
    }
    
    return stats;
  }

  /**
   * Get duplicate evidence (for monitoring)
   */
  async getDuplicates(limit: number = 100): Promise<Array<{
    contentHash: string;
    count: number;
    evidenceIds: string[];
  }>> {
    const result = await this.pool.query(
      'SELECT * FROM evidence_duplicates LIMIT $1',
      [limit]
    );
    
    return result.rows.map(row => ({
      contentHash: row.content_hash,
      count: parseInt(row.duplicate_count),
      evidenceIds: row.evidence_ids
    }));
  }

  /**
   * Clean up old evidence (for lifecycle management)
   */
  async pruneOlderThan(days: number): Promise<number> {
    const result = await this.pool.query(
      'DELETE FROM evidence WHERE timestamp < NOW() - INTERVAL \'1 day\' * $1',
      [days]
    );
    
    return result.rowCount || 0;
  }

  /**
   * Calculate SHA-256 hash of content
   */
  private hashContent(content: any): string {
    const contentString = JSON.stringify(content, Object.keys(content).sort());
    return createHash('sha256').update(contentString).digest('hex');
  }

  /**
   * Convert database row to Evidence object
   */
  private rowToEvidence(row: any): Evidence {
    return {
      id: row.id,
      type: row.type,
      repository: row.repository,
      content: typeof row.content === 'string' ? JSON.parse(row.content) : row.content,
      contentHash: row.content_hash,
      timestamp: new Date(row.timestamp),
      provenance: typeof row.provenance === 'string' ? JSON.parse(row.provenance) : row.provenance
    };
  }
}
