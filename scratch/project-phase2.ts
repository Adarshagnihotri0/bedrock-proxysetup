/**
 * Validate Projection with Real Phase 2 Knowledge
 * 
 * Stage 1: Replay 1k real events from PostgreSQL
 * 
 * Validates:
 * 1. Load time for 1000 knowledge rows
 * 2. Projection time (sequential)
 * 3. Replay time (idempotency check)
 * 4. Node count after replay
 * 5. Delete and rebuild time
 * 6. Semantic verification (compare triples)
 */

import { Pool } from 'pg';
import { Neo4jProjectionBackend } from '../src/projection/neo4j-backend';
import { Knowledge } from '../src/projection/types';

interface Phase2Knowledge {
  id: string;
  hash: string;
  subject: string;
  predicate: string;
  object: string;
  type: string;
  confidence: number;
  evidence_ids: string[];
  created_at: Date;
}

async function main() {
  console.log('🔍 Stage 1: Validate with Real Phase 2 Knowledge\n');

  // Connect to PostgreSQL
  const pg = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'bedrock_proxy',
    user: process.env.DB_USER || 'adarshagnihotri',
    password: process.env.DB_PASSWORD || ''
  });

  // Connect to Neo4j
  const neo4j = new Neo4jProjectionBackend();
  await neo4j.connect();

  try {
    // ========================================
    // STEP 1: Load Knowledge from Phase 2
    // ========================================
    console.log('STEP 1: Load knowledge from PostgreSQL');
    
    const loadStart = Date.now();
    const result = await pg.query<Phase2Knowledge>(`
      SELECT 
        k.id,
        k.hash,
        k.subject,
        k.predicate,
        k.object,
        k.type,
        k.confidence,
        array_agg(e.id) as evidence_ids,
        k.created_at
      FROM knowledge k
      JOIN evidence e ON k.evidence_id = e.id
      WHERE k.hash IS NOT NULL
      GROUP BY k.id
      ORDER BY k.created_at
      LIMIT 1000
    `);
    
    const loadTime = Date.now() - loadStart;
    console.log(`  ✅ Loaded ${result.rows.length} knowledge rows in ${loadTime}ms`);
    console.log(`  Load rate: ${(result.rows.length / loadTime * 1000).toFixed(0)} rows/sec\n`);

    const knowledge: Knowledge[] = result.rows.map(row => ({
      id: row.id,
      hash: row.hash,
      subject: row.subject,
      predicate: row.predicate,
      object: row.object,
      type: row.type as 'fact' | 'relationship' | 'inference',
      confidence: row.confidence,
      evidenceIds: row.evidence_ids || [],
      provenance: {
        createdAt: row.created_at,
        repository: 'bedrock-proxy'
      }
    }));

    // ========================================
    // STEP 2: First Projection
    // ========================================
    console.log('STEP 2: Project knowledge to Neo4j');
    
    await neo4j.deleteAll();
    
    const projectStart = Date.now();
    await neo4j.applyBatch(knowledge);
    const projectTime = Date.now() - projectStart;
    
    const nodeCount = await neo4j.count();
    console.log(`  ✅ Projected ${knowledge.length} knowledge in ${projectTime}ms`);
    console.log(`  Nodes created: ${nodeCount}`);
    console.log(`  Projection rate: ${(knowledge.length / projectTime * 1000).toFixed(0)} nodes/sec\n`);

    // ========================================
    // STEP 3: Replay (Idempotency Check)
    // ========================================
    console.log('STEP 3: Replay all knowledge (idempotency check)');
    
    const replayStart = Date.now();
    await neo4j.applyBatch(knowledge);
    const replayTime = Date.now() - replayStart;
    
    const nodeCountAfterReplay = await neo4j.count();
    console.log(`  ✅ Replayed ${knowledge.length} knowledge in ${replayTime}ms`);
    console.log(`  Nodes after replay: ${nodeCountAfterReplay}`);
    console.log(`  Idempotent: ${nodeCountAfterReplay === nodeCount ? '✅ YES' : '❌ NO'}\n`);

    // ========================================
    // STEP 4: Delete and Rebuild
    // ========================================
    console.log('STEP 4: Delete and rebuild');
    
    const deleteStart = Date.now();
    await neo4j.deleteAll();
    const deleteTime = Date.now() - deleteStart;
    
    console.log(`  ✅ Deleted ${nodeCount} nodes in ${deleteTime}ms`);
    
    const rebuildStart = Date.now();
    await neo4j.applyBatch(knowledge);
    const rebuildTime = Date.now() - rebuildStart;
    
    const nodeCountAfterRebuild = await neo4j.count();
    console.log(`  ✅ Rebuilt in ${rebuildTime}ms`);
    console.log(`  Nodes after rebuild: ${nodeCountAfterRebuild}`);
    console.log(`  Count preserved: ${nodeCountAfterRebuild === nodeCount ? '✅ YES' : '❌ NO'}\n`);

    // ========================================
    // STEP 5: Semantic Verification
    // ========================================
    console.log('STEP 5: Semantic verification (sample 10)');
    
    // Verify first 10 knowledge match
    const verificationPromises = knowledge.slice(0, 10).map(async (k) => {
      const retrieved = await neo4j.get(k.hash);
      if (!retrieved) {
        console.log(`  ❌ Hash ${k.hash} not found`);
        return false;
      }
      
      const match = 
        retrieved.subject === k.subject &&
        retrieved.predicate === k.predicate &&
        retrieved.object === k.object &&
        Math.abs(retrieved.confidence - k.confidence) < 0.01;
      
      if (!match) {
        console.log(`  ❌ Mismatch for hash ${k.hash}:`);
        console.log(`     Expected: ${k.subject} ${k.predicate} ${k.object} (${k.confidence})`);
        console.log(`     Got: ${retrieved.subject} ${retrieved.predicate} ${retrieved.object} (${retrieved.confidence})`);
      }
      
      return match;
    });
    
    const verificationResults = await Promise.all(verificationPromises);
    const verificationPassed = verificationResults.every(v => v);
    
    console.log(`  ${verificationPassed ? '✅' : '❌'} Semantic verification: ${verificationResults.filter(v => v).length}/10 passed\n`);

    // ========================================
    // SUMMARY
    // ========================================
    console.log('='.repeat(60));
    console.log('VALIDATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Knowledge loaded: ${knowledge.length}`);
    console.log(`Load time: ${loadTime}ms (${(knowledge.length / loadTime * 1000).toFixed(0)} rows/sec)`);
    console.log(`Projection time: ${projectTime}ms (${(knowledge.length / projectTime * 1000).toFixed(0)} nodes/sec)`);
    console.log(`Replay time: ${replayTime}ms`);
    console.log(`Delete time: ${deleteTime}ms`);
    console.log(`Rebuild time: ${rebuildTime}ms`);
    console.log(`\nIdempotency: ${nodeCountAfterReplay === nodeCount ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Count preservation: ${nodeCountAfterRebuild === nodeCount ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Semantic verification: ${verificationPassed ? '✅ PASS' : '❌ FAIL'}`);
    
    const allPassed = 
      nodeCountAfterReplay === nodeCount &&
      nodeCountAfterRebuild === nodeCount &&
      verificationPassed;
    
    console.log(`\nOverall: ${allPassed ? '✅ ALL VALIDATIONS PASSED' : '❌ SOME VALIDATIONS FAILED'}`);
    console.log('='.repeat(60));

  } catch (err) {
    console.error('❌ Validation failed:', err);
    throw err;
  } finally {
    await pg.end();
    await neo4j.close();
  }
}

main()
  .then(() => {
    console.log('\n✅ Stage 1 complete');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Stage 1 failed:', err);
    process.exit(1);
  });
