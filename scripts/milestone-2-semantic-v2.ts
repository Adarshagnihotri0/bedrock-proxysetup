/**
 * Milestone 2: Canonical Serialization Equality
 * 
 * Requirements:
 * 1. Test idempotency: replay without delete
 * 2. Test rebuild: delete + replay
 * 3. Verify canonical serialization identical
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

    // INITIAL: Ensure graph is populated
    console.log('INITIAL: Populating graph from PostgreSQL...');
    const pgData = await pg.query(`
      SELECT hash, subject, predicate, object, confidence, evidence_id, created_at
      FROM knowledge
      WHERE hash IS NOT NULL
      ORDER BY created_at ASC
    `);

    // Clear and populate
    await session.run('MATCH (k:Knowledge) DELETE k');
    for (const row of pgData.rows) {
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
    console.log(`  ✅ Populated ${pgData.rows.length} nodes\n`);

    // STEP 1: Get initial graph state
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

    const count1 = await session.run('MATCH (k:Knowledge) RETURN COUNT(k) as count');
    console.log(`  Nodes: ${canonical1.length}`);
    console.log(`  Hash: ${hash1}\n`);

    // STEP 2: Test idempotency (replay WITHOUT delete)
    console.log('STEP 2: Testing idempotency (replay without delete)...');
    for (const row of pgData.rows) {
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
    const nodeCountIdempotent = countAfterIdempotent.records[0].get('count').toNumber();
    console.log(`  Nodes after replay: ${nodeCountIdempotent}`);
    console.log(`  ${nodeCountIdempotent === canonical1.length ? '✅' : '❌'} Idempotency: node count unchanged\n`);

    // STEP 3: Delete graph
    console.log('STEP 3: Deleting graph...');
    await session.run('MATCH (k:Knowledge) DELETE k');
    console.log('  ✅ Deleted\n');

    // STEP 4: Replay from PostgreSQL
    console.log('STEP 4: Replaying from PostgreSQL...');
    for (const row of pgData.rows) {
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
    console.log(`  ✅ Replayed ${pgData.rows.length} rows\n`);

    // STEP 5: Serialize rebuilt graph
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

    // STEP 6: Verify
    console.log('='.repeat(60));
    console.log('CANONICAL SERIALIZATION VERIFICATION');
    console.log('='.repeat(60));
    console.log(`Original hash:  ${hash1}`);
    console.log(`Rebuilt hash:   ${hash2}`);
    console.log(`Match:          ${hash1 === hash2 ? '✅ YES' : '❌ NO'}`);
    console.log('='.repeat(60));

    const idempotencyPassed = nodeCountIdempotent === canonical1.length;
    const rebuildPassed = hash1 === hash2;

    if (idempotencyPassed && rebuildPassed) {
      console.log('\n✅ VERIFICATION PASSED');
      console.log('   - Idempotency: replay twice produces same node count');
      console.log('   - Canonical serialization: identical hash after rebuild');
      console.log('   - Content equality: serialized properties match\n');
      return true;
    } else {
      console.log('\n❌ VERIFICATION FAILED');
      if (!idempotencyPassed) {
        console.log('   - Idempotency failed: node count changed');
      }
      if (!rebuildPassed) {
        console.log('   - Canonical serialization differs\n');
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
