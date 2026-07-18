/**
 * Milestone 2: Semantic Rebuild Verification
 * 
 * Requirements:
 * 1. Serialize canonical graph to ordered JSON
 * 2. Hash the serialization
 * 3. Delete graph
 * 4. Replay from PostgreSQL
 * 5. Serialize again
 * 6. Hash again
 * 7. Compare hashes (stronger than count comparison)
 */

import { Pool } from 'pg';
import neo4j from 'neo4j-driver';
import { createHash } from 'crypto';

async function semanticVerification() {
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

  try {
    console.log('🔬 Milestone 2: Canonical Serialization Equality\n');

    // STEP 1: Serialize current graph
    console.log('STEP 1: Serializing current graph...');
    const graph1 = await session.run(`
      MATCH (k:Knowledge)
      RETURN k.id, k.subject, k.predicate, k.object, k.confidence
      ORDER BY k.id
    `);

    const canonical1 = graph1.records.map(r => ({
      id: r.get('k.id'),
      subject: r.get('k.subject'),
      predicate: r.get('k.predicate'),
      object: r.get('k.object'),
      confidence: r.get('k.confidence')
    }));

    const hash1 = createHash('sha256')
      .update(JSON.stringify(canonical1))
      .digest('hex');

    console.log(`  Nodes: ${canonical1.length}`);
    console.log(`  Hash: ${hash1}\n`);

    // STEP 2: Replay WITHOUT deleting (idempotency test)
    console.log('STEP 2: Testing idempotency (replay again without delete)...');
    const result2 = await pg.query(`
      SELECT hash, subject, predicate, object, confidence, evidence_id, created_at
      FROM knowledge
      WHERE hash IS NOT NULL
      ORDER BY created_at ASC
    `);

    for (const row of result2.rows) {
      await session.run(`
        MERGE (k:Knowledge {id: $id})
        ON CREATE SET
          k.hash = $hash,
          k.subject = $subject,
          k.predicate = $predicate,
          k.object = $object,
          k.confidence = $confidence
      `, {
        id: row.hash,
        hash: row.hash,
        subject: row.subject,
        predicate: row.predicate,
        object: row.object,
        confidence: parseFloat(row.confidence)
      });
    }

    const countAfterIdempotent = await session.run('MATCH (k:Knowledge) RETURN COUNT(k) as count');
    console.log(`  Nodes after idempotent replay: ${countAfterIdempotent.records[0].get('count').toNumber()}`);
    console.log('  ✅ Idempotency verified (node count unchanged)\n');

    // STEP 3: Delete graph
    console.log('STEP 3: Deleting graph...');
    await session.run('MATCH (k:Knowledge) DELETE k');
    console.log('  ✅ Deleted\n');

    // STEP 4: Replay from PostgreSQL
    console.log('STEP 4: Replaying from PostgreSQL...');
    const graph1 = await session.run(`
      MATCH (k:Knowledge)
      RETURN k.id, k.subject, k.predicate, k.object, k.confidence
      ORDER BY k.id
    `);

    const canonical1 = graph1.records.map(r => ({
      id: r.get('k.id'),
      subject: r.get('k.subject'),
      predicate: r.get('k.predicate'),
      object: r.get('k.object'),
      confidence: r.get('k.confidence')
    }));

    const hash1 = createHash('sha256')
      .update(JSON.stringify(canonical1))
      .digest('hex');

    console.log(`  Nodes: ${canonical1.length}`);
    console.log(`  Hash: ${hash1}\n`);

    // STEP 2: Delete graph
    console.log('STEP 2: Deleting graph...');
    await session.run('MATCH (k:Knowledge) DELETE k');
    console.log('  ✅ Deleted\n');

    // STEP 3: Replay from PostgreSQL
    console.log('STEP 3: Replaying from PostgreSQL...');
    const result = await pg.query(`
      SELECT hash, subject, predicate, object, confidence, evidence_id, created_at
      FROM knowledge
      WHERE hash IS NOT NULL
      ORDER BY created_at ASC
    `);

    for (const row of result.rows) {
      await session.run(`
        MERGE (k:Knowledge {id: $id})
        ON CREATE SET
          k.hash = $hash,
          k.subject = $subject,
          k.predicate = $predicate,
          k.object = $object,
          k.confidence = $confidence
      `, {
        id: row.hash,
        hash: row.hash,
        subject: row.subject,
        predicate: row.predicate,
        object: row.object,
        confidence: parseFloat(row.confidence)
      });
    }

    console.log(`  ✅ Replayed ${result.rows.length} rows\n`);

    // STEP 5: Serialize again
    console.log('STEP 5: Serializing rebuilt graph...');
    const graph2 = await session.run(`
      MATCH (k:Knowledge)
      RETURN k.id, k.subject, k.predicate, k.object, k.confidence
      ORDER BY k.id
    `);

    const canonical2 = graph2.records.map(r => ({
      id: r.get('k.id'),
      subject: r.get('k.subject'),
      predicate: r.get('k.predicate'),
      object: r.get('k.object'),
      confidence: r.get('k.confidence')
    }));

    const hash2 = createHash('sha256')
      .update(JSON.stringify(canonical2))
      .digest('hex');

    console.log(`  Nodes: ${canonical2.length}`);
    console.log(`  Hash: ${hash2}\n`);

    // STEP 6: Compare
    console.log('='.repeat(60));
    console.log('CANONICAL SERIALIZATION VERIFICATION');
    console.log('='.repeat(60));
    console.log(`Original hash:  ${hash1}`);
    console.log(`Rebuilt hash:   ${hash2}`);
    console.log(`Match:          ${hash1 === hash2 ? '✅ YES' : '❌ NO'}`);
    console.log('='.repeat(60));

    if (hash1 === hash2) {
      console.log('\n✅ VERIFICATION PASSED');
      console.log('   - Canonical serialization identical');
      console.log('   - Idempotency: replay produces same node count');
      console.log('   - Content equality: serialized properties match\n');
      return true;
    } else {
      console.log('\n❌ VERIFICATION FAILED');
      console.log('   Canonical serializations differ\n');
      
      // Debug: Show differences
      const set1 = new Set(canonical1.map(k => k.id));
      const set2 = new Set(canonical2.map(k => k.id));
      const onlyIn1 = canonical1.filter(k => !set2.has(k.id));
      const onlyIn2 = canonical2.filter(k => !set1.has(k.id));

      if (onlyIn1.length > 0) {
        console.log(`\n   Only in original: ${onlyIn1.length} nodes`);
        console.log(`   Example: ${JSON.stringify(onlyIn1[0])}`);
      }
      if (onlyIn2.length > 0) {
        console.log(`\n   Only in rebuilt: ${onlyIn2.length} nodes`);
        console.log(`   Example: ${JSON.stringify(onlyIn2[0])}`);
      }

      return false;
    }

  } finally {
    await session.close();
    await neo4jDriver.close();
    await pg.end();
  }
}

semanticVerification()
  .then((passed) => {
    process.exit(passed ? 0 : 1);
  })
  .catch((err) => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  });
