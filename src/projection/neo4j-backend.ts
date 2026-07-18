/**
 * Neo4jProjectionBackend - Neo4j Projection Primitive
 * 
 * Purpose: Project Knowledge to Neo4j graph using direct Cypher
 * Constraint: No abstractions, no runtime, just projection
 * 
 * VALIDATION ORDER:
 * 1. Single event projection
 * 2. 100 events → 100 nodes
 * 3. Delete, replay, count equality
 * 4. Idempotency (replay twice, no duplicates)
 * 5. Partial projection continuation
 * 
 * NOT YET VALIDATED:
 * - Crash recovery (persisted state)
 * - Semantic equality verification
 * - Concurrent projection workers
 * - Performance at scale (50k+ events)
 */

import neo4j, { Driver, Session } from 'neo4j-driver';
import { Knowledge } from './types';

export class Neo4jProjectionBackend {
  private driver: Driver;
  private connected = false;

  constructor(
    uri: string = process.env.NEO4J_URI || 'bolt://localhost:7687',
    user: string = process.env.NEO4J_USER || 'neo4j',
    password: string = process.env.NEO4J_PASSWORD || 'test1234'
  ) {
    this.driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  }

  /**
   * Connect to Neo4j
   */
  async connect(): Promise<void> {
    if (this.connected) return;
    
    await this.driver.verifyConnectivity();
    this.connected = true;
  }

  /**
   * Project a single Knowledge event
   * 
   * IMPLEMENTATION: Hardcoded MERGE
   * NO queues, NO retries, NO runtime
   */
  async apply(knowledge: Knowledge): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }

    const session = this.driver.session();
    
    try {
      // MERGE: Deterministic projection by knowledge hash
      await session.run(
        `
        MERGE (k:Knowledge {id: $hash})
        ON CREATE SET k.createdAt = datetime()
        ON MATCH SET k.updatedAt = datetime()
        SET k.subject = $subject,
            k.predicate = $predicate,
            k.object = $object,
            k.confidence = $confidence,
            k.evidenceIds = $evidenceIds,
            k.provenance_repository = $provenance_repository,
            k.provenance_createdAt = $provenance_createdAt
        `,
        {
          hash: knowledge.hash,
          subject: knowledge.subject,
          predicate: knowledge.predicate,
          object: knowledge.object,
          confidence: knowledge.confidence,
          evidenceIds: knowledge.evidenceIds || [],
          provenance_repository: knowledge.provenance?.repository || null,
          provenance_createdAt: knowledge.provenance?.createdAt?.toISOString() || null
        }
      );
    } finally {
      await session.close();
    }
  }

  /**
   * Batch project multiple Knowledge events
   * 
   * IMPLEMENTATION: Direct UNWIND batch
   * NO optimization, NO parallel processing
   */
  async applyBatch(knowledge: Knowledge[]): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }

    const session = this.driver.session();
    
    try {
      await session.run(
        `
        UNWIND $batch as item
        MERGE (k:Knowledge {id: item.hash})
        ON CREATE SET k.createdAt = datetime()
        ON MATCH SET k.updatedAt = datetime()
        SET k.subject = item.subject,
            k.predicate = item.predicate,
            k.object = item.object,
            k.confidence = item.confidence,
            k.evidenceIds = item.evidenceIds,
            k.provenance_repository = item.provenance_repository,
            k.provenance_createdAt = item.provenance_createdAt
        `,
        { 
          batch: knowledge.map(k => ({
            hash: k.hash,
            subject: k.subject,
            predicate: k.predicate,
            object: k.object,
            confidence: k.confidence,
            evidenceIds: k.evidenceIds || [],
            provenance_repository: k.provenance?.repository || null,
            provenance_createdAt: k.provenance?.createdAt?.toISOString() || null
          }))
        }
      );
    } finally {
      await session.close();
    }
  }

  /**
   * Delete entire graph
   * 
   * USE CASE: Rebuild from scratch
   */
  async deleteAll(): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }

    const session = this.driver.session();
    
    try {
      await session.run('MATCH (n:Knowledge) DETACH DELETE n');
    } finally {
      await session.close();
    }
  }

  /**
   * Get Knowledge by hash
   * 
   * USE CASE: Verification testing
   */
  async get(hash: string): Promise<Knowledge | null> {
    if (!this.connected) {
      await this.connect();
    }

    const session = this.driver.session();
    
    try {
      const result = await session.run(
        'MATCH (k:Knowledge {id: $hash}) RETURN k',
        { hash }
      );

      if (result.records.length === 0) {
        return null;
      }

      const node = result.records[0].get('k').properties;
      
      return {
        id: node.id,
        hash: node.id,
        subject: node.subject,
        predicate: node.predicate,
        object: node.object,
        type: node.type || 'fact',
        confidence: node.confidence,
        evidenceIds: node.evidenceIds || [],
        provenance: {
          repository: node.provenance_repository || undefined,
          createdAt: node.provenance_createdAt ? new Date(node.provenance_createdAt) : undefined
        }
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Count total Knowledge nodes
   * 
   * USE CASE: Verification testing
   */
  async count(): Promise<number> {
    if (!this.connected) {
      await this.connect();
    }

    const session = this.driver.session();
    
    try {
      const result = await session.run(
        'MATCH (k:Knowledge) RETURN count(k) as count'
      );
      
      return result.records[0].get('count').toNumber();
    } finally {
      await session.close();
    }
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    await this.driver.close();
    this.connected = false;
  }
}
