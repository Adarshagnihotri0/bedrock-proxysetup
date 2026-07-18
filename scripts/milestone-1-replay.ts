/**
 * Milestone 1: Replay All Phase 2 Knowledge
 * 
 * Requirements:
 * 1. Replay ALL knowledge from PostgreSQL into Neo4j
 * 2. Produce replay report with metrics
 * 
 * Report format:
 *   Knowledge rows: [count]
 *   Projected: [count]
 *   Failed: [count]
 *   Duplicate MERGE: [count]
 *   Elapsed: [time]
 *   Throughput: [facts/sec]
 */

import { Pool } from 'pg';
// @ts-ignore - no types available
import QueryStream from 'pg-query-stream';
import neo4j from 'neo4j-driver';
import { Knowledge } from '../src/projection/types';

interface ReplayReport {
  totalInPG: number;
  projected: number;
  failed: number;
  duplicateMerge: number;
  elapsedMs: number;
  throughputFactsPerSec: number;
  errors: string[];
}

async function replayAllKnowledge(): Promise<ReplayReport> {
  const pg = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'bedrock_proxy',
    user: 'adarshagnihotri',
    password: ''
  });

  const neo4jDriver = neo4j.driver(
    'bolt://localhost:7687',
    neo4j.auth.basic('neo4j', 'test1234')
  );

  const session = neo4jDriver.session();
  const report: ReplayReport = {
    totalInPG: 0,
    projected: 0,
    failed: 0,
    duplicateMerge: 0,
    elapsedMs: 0,
    throughputFactsPerSec: 0,
    errors: []
  };

  const startTime = Date.now();

  try {
    // Count total
    const countResult = await pg.query('SELECT COUNT(*) FROM knowledge WHERE hash IS NOT NULL');
    report.totalInPG = parseInt(countResult.rows[0].count);
    console.log(`Found ${report.totalInPG} knowledge rows to replay\n`);

    // Clear Neo4j
    await session.run('MATCH (k:Knowledge) DELETE k');
    console.log('✅ Cleared Neo4j graph');

    // Stream from PG → Neo4j (TRUE streaming, no buffering)
    const query = new QueryStream(`
      SELECT 
        hash,
        subject,
        predicate,
        object,
        type,
        confidence,
        evidence_id,
        created_at
      FROM knowledge
      WHERE hash IS NOT NULL
      ORDER BY created_at ASC
    `, [], { batchSize: 100 }); // Process in batches of 100

    const stream = pg.query(query);
    
    console.log(`Streaming rows to Neo4j (batches of 100)...\n`);

    for await (const row of stream) {
      try {
        const knowledge: Knowledge = {
          id: row.hash,
          hash: row.hash,
          subject: row.subject,
          predicate: row.predicate,
          object: row.object,
          type: row.type,
          confidence: parseFloat(row.confidence),
          evidenceIds: [row.evidence_id],
          provenance: {
            createdAt: row.created_at,
            repository: 'bedrock-proxy'
          }
        };

        // MERGE into Neo4j (idempotent)
        const cypher = `
          MERGE (k:Knowledge {id: $id})
          ON CREATE SET
            k.hash = $hash,
            k.subject = $subject,
            k.predicate = $predicate,
            k.object = $object,
            k.type = $type,
            k.confidence = $confidence,
            k.evidenceIds = $evidenceIds,
            k.provenance_repository = $provenance_repository,
            k.provenance_createdAt = $provenance_createdAt
        `;

        await session.run(cypher, {
          id: knowledge.id,
          hash: knowledge.hash,
          subject: knowledge.subject,
          predicate: knowledge.predicate,
          object: knowledge.object,
          type: knowledge.type,
          confidence: knowledge.confidence,
          evidenceIds: knowledge.evidenceIds,
          provenance_repository: 'bedrock-proxy',
          provenance_createdAt: knowledge.provenance.createdAt?.toISOString() || null
        });

        report.projected++;

        if (report.projected % 100 === 0) {
          console.log(`  Projected ${report.projected}/${report.totalInPG}`);
        }

      } catch (err) {
        report.failed++;
        const errorMsg = err instanceof Error ? err.message : String(err);
        report.errors.push(errorMsg);
        if (report.errors.length <= 5) {
          console.error(`❌ Error projecting row: ${errorMsg}`);
        }
      }
    }

    const endTime = Date.now();
    report.elapsedMs = endTime - startTime;
    report.throughputFactsPerSec = Math.round(report.projected / (report.elapsedMs / 1000));

    // Count nodes in Neo4j
    const neo4jCount = await session.run('MATCH (k:Knowledge) RETURN COUNT(k) as count');
    const nodeCount = neo4jCount.records[0].get('count').toNumber();

    console.log(`\n${'='.repeat(60)}`);
    console.log('REPLAY REPORT');
    console.log('='.repeat(60));
    console.log(`Knowledge rows in PostgreSQL: ${report.totalInPG}`);
    console.log(`Projected to Neo4j:           ${report.projected}`);
    console.log(`Nodes in Neo4j:              ${nodeCount}`);
    console.log(`Failed:                      ${report.failed}`);
    console.log(`Elapsed:                     ${report.elapsedMs}ms`);
    console.log(`Throughput:                  ${report.throughputFactsPerSec} facts/sec`);
    if (report.errors.length > 0) {
      console.log(`Errors:                      ${report.errors.length}`);
      if (report.errors.length <= 5) {
        report.errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
      }
    }
    console.log('='.repeat(60));
    console.log(`${nodeCount === report.projected ? '✅' : '❌'} Validation: ${nodeCount === report.projected ? 'PASSED' : 'FAILED'} (node count matches projection)`);

  } finally {
    await session.close();
    await neo4jDriver.close();
    await pg.end();
  }

  return report;
}

replayAllKnowledge()
  .then((report) => {
    console.log('\n✅ Replay complete');
    process.exit(report.failed > 0 ? 1 : 0);
  })
  .catch((err) => {
    console.error('❌ Replay failed:', err);
    process.exit(1);
  });
