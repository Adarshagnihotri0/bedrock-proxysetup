/**
 * Vector Retrieval Service
 * 
 * Purpose: Retrieve knowledge from Neo4j + PostgreSQL
 * Pipeline: query → embed → vector search → hydrate → return
 * 
 * NO ranking heuristics
 * NO LLM
 * NO context assembly
 * 
 * This is the stable foundation.
 */

import neo4j, { Driver, int } from 'neo4j-driver';
import { Pool } from 'pg';
import { RetrievedKnowledge, RetrievalOptions, RetrievalService } from './types';

export class VectorRetrievalService implements RetrievalService {
  constructor(
    private neo4j: Driver,
    private pg: Pool,
    private embedFn: (text: string) => Promise<number[]>
  ) {}

  /**
   * Retrieve knowledge by vector similarity
   * 
   * Pipeline:
   * 1. Embed query
   * 2. Vector search in Neo4j
   * 3. Hydrate from PostgreSQL
   * 4. Return structured results
   */
  async retrieve(query: string, options?: RetrievalOptions): Promise<RetrievedKnowledge[]> {
    const limit = options?.limit || 10;

    // Step 1: Embed query
    const embedding = await this.embedFn(query);

    // Step 2: Vector search in Neo4j
    const session = this.neo4j.session();
    try {
      const result = await session.run(
        `
        CALL db.index.vector.queryNodes($indexName, $limit, $embedding)
        YIELD node, score
        RETURN node.id AS knowledgeId, score
        ORDER BY score DESC
        `,
        { 
          indexName: 'knowledge_embeddings',
          embedding, 
          limit: int(limit)
        }
      );

      const neo4jHits = result.records.map(record => ({
        knowledgeId: record.get('knowledgeId'),
        score: record.get('score')
      }));

      if (neo4jHits.length === 0) {
        return [];
      }

      // Step 3: Hydrate from PostgreSQL
      const knowledgeIds = neo4jHits.map(h => h.knowledgeId);
      const pgResult = await this.pg.query(
        `
        SELECT 
          hash,
          subject,
          predicate,
          object,
          confidence,
          evidence_id
        FROM knowledge
        WHERE hash = ANY($1)
        `,
        [knowledgeIds]
      );

      // Step 4: Merge Neo4j scores with PostgreSQL data
      const scoreMap = new Map(neo4jHits.map(h => [h.knowledgeId, h.score]));
      
      const retrieved: RetrievedKnowledge[] = pgResult.rows.map(row => ({
        id: row.hash,
        score: scoreMap.get(row.hash) || 0,
        subject: row.subject,
        predicate: row.predicate,
        object: row.object,
        confidence: row.confidence,
        evidenceIds: Array.isArray(row.evidence_id) ? row.evidence_id : [],
        provenance: {}
      }));

      // Sort by score descending
      return retrieved.sort((a, b) => b.score - a.score);
    } finally {
      await session.close();
    }
  }
}
