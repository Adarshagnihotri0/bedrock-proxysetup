/**
 * Graphiti Spike - Neo4j Assumption Validation
 * 
 * Purpose: Validate Neo4j capabilities for Phase 3 projection infrastructure
 * NOT production code - throwaway validation
 * 
 * Questions to answer:
 * 1. MERGE semantics for deterministic upsert?
 * 2. Content-addressable identity (knowledge_hash)?
 * 3. Provenance preservation?
 * 4. Relationship updates?
 * 5. Delete/rebuild?
 * 6. Query patterns?
 * 7. Batch performance?
 */

import neo4j, { Driver, Session } from 'neo4j-driver';

interface TestKnowledge {
  hash: string;
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  evidenceIds: string[];
}

const testKnowledge: TestKnowledge[] = [
  {
    hash: 'k:abc123def456',
    subject: 'user:alice',
    predicate: 'performed',
    object: 'action:login',
    confidence: 0.95,
    evidenceIds: ['e:1', 'e:2']
  },
  {
    hash: 'k:xyz789ghi012',
    subject: 'user:alice',
    predicate: 'owns',
    object: 'resource:456',
    confidence: 0.80,
    evidenceIds: ['e:3']
  }
];

async function main() {
  console.log('🔬 Graphiti Spike - Neo4j Validation\n');
  
  const driver = neo4j.driver(
    process.env.NEO4J_URI || 'bolt://localhost:7687',
    neo4j.auth.basic(
      process.env.NEO4J_USER || 'neo4j',
      process.env.NEO4J_PASSWORD || 'test1234'
    )
  );

  const session = driver.session();

  try {
    // ========================================
    // TEST 1: Deterministic Upsert with MERGE
    // ========================================
    console.log('TEST 1: Deterministic upsert using MERGE');
    console.log('Question: Can same hash produce same/updated node (not duplicate)?');

    try {
      // First insert
      await session.run(
        `
        MERGE (k:Knowledge {id: $hash})
        ON CREATE SET k.createdAt = datetime()
        SET k.subject = $subject,
            k.predicate = $predicate,
            k.object = $object,
            k.confidence = $confidence,
            k.evidenceIds = $evidenceIds
        RETURN k
        `,
        testKnowledge[0]
      );
      console.log('  ✅ First insert succeeded');

      // Second insert (upsert) with different confidence
      const result2 = await session.run(
        `
        MERGE (k:Knowledge {id: $hash})
        ON CREATE SET k.createdAt = datetime()
        SET k.subject = $subject,
            k.predicate = $predicate,
            k.object = $object,
            k.confidence = $confidence,
            k.evidenceIds = $evidenceIds,
            k.updatedAt = datetime()
        RETURN k.confidence as conf, k.updatedAt as updated
        `,
        { ...testKnowledge[0], confidence: 0.99 }
      );
      console.log('  ✅ Upsert succeeded');
      console.log('  Updated confidence:', result2.records[0]?.get('conf'));
      console.log('  Has updatedAt:', result2.records[0]?.get('updated') ? '✅' : '❌');

      // Verify single node
      const count = await session.run(
        'MATCH (k:Knowledge {id: $hash}) RETURN count(k) as count',
        { hash: testKnowledge[0].hash }
      );
      console.log('  Node count:', count.records[0]?.get('count').toNumber(), '(should be 1)');
    } catch (err) {
      console.log('  ❌ FAILED:', err);
    }

    // ========================================
    // TEST 2: Provenance Preservation
    // ========================================
    console.log('\nTEST 2: Provenance preservation');
    console.log('Question: Can we attach and retrieve provenance?');

    try {
      const result = await session.run(
        `
        MATCH (k:Knowledge {id: $hash})
        RETURN k.evidenceIds as evidenceIds, k.confidence as confidence
        `,
        { hash: testKnowledge[0].hash }
      );
      
      const evidenceIds = result.records[0]?.get('evidenceIds');
      const confidence = result.records[0]?.get('confidence');
      
      console.log('  ✅ Retrieved provenance');
      console.log('  Evidence IDs:', evidenceIds);
      console.log('  Confidence:', confidence);
      console.log('  Array preserved:', Array.isArray(evidenceIds) ? '✅' : '❌');
    } catch (err) {
      console.log('  ❌ FAILED:', err);
    }

    // ========================================
    // TEST 3: Relationships
    // ========================================
    console.log('\nTEST 3: Relationship creation');
    console.log('Question: Can we model knowledge relationships?');

    try {
      // Create second knowledge node
      await session.run(
        `
        MERGE (k:Knowledge {id: $hash})
        SET k.subject = $subject,
            k.predicate = $predicate,
            k.object = $object,
            k.confidence = $confidence
        `,
        testKnowledge[1]
      );

      // Create relationship
      await session.run(
        `
        MATCH (k1:Knowledge {id: $hash1}), (k2:Knowledge {id: $hash2})
        MERGE (k1)-[r:SUPPORTS]->(k2)
        SET r.confidence = $confidence,
            r.createdAt = datetime()
        RETURN r
        `,
        {
          hash1: testKnowledge[0].hash,
          hash2: testKnowledge[1].hash,
          confidence: 0.85
        }
      );
      console.log('  ✅ Created relationship');

      // Query relationship
      const relResult = await session.run(
        `
        MATCH (k1:Knowledge {id: $hash})-[r]->(k2:Knowledge)
        RETURN type(r) as relType, k2.id as targetId
        `,
        { hash: testKnowledge[0].hash }
      );
      
      relResult.records.forEach((record, i) => {
        console.log(`  Relation ${i + 1}: ${record.get('relType')} -> ${record.get('targetId')}`);
      });
    } catch (err) {
      console.log('  ❌ FAILED:', err);
    }

    // ========================================
    // TEST 4: Update/Append Semantics
    // ========================================
    console.log('\nTEST 4: Update with append semantics');
    console.log('Question: Can we append evidence (not replace)?');

    try {
      // Simulate adding more evidence
      await session.run(
        `
        MATCH (k:Knowledge {id: $hash})
        SET k.evidenceIds = k.evidenceIds + $newEvidence
        RETURN k.evidenceIds as evidenceIds
        `,
        {
          hash: testKnowledge[0].hash,
          newEvidence: ['e:4', 'e:5']
        }
      );

      const result = await session.run(
        'MATCH (k:Knowledge {id: $hash}) RETURN k.evidenceIds as evidenceIds',
        { hash: testKnowledge[0].hash }
      );
      
      const evidenceIds = result.records[0]?.get('evidenceIds');
      console.log('  ✅ Appended evidence');
      console.log('  Evidence IDs:', evidenceIds);
      console.log('  Original + new:', evidenceIds.length === 4 ? '✅' : '❌');
    } catch (err) {
      console.log('  ❌ FAILED:', err);
    }

    // ========================================
    // TEST 5: Delete and Rebuild
    // ========================================
    console.log('\nTEST 5: Delete and rebuild');
    console.log('Question: Can we clear projections and rebuild?');

    try {
      // Delete specific node
      await session.run(
        'MATCH (k:Knowledge {id: $hash}) DETACH DELETE k',
        { hash: testKnowledge[0].hash }
      );
      console.log('  ✅ Deleted node');

      // Verify deletion
      const deleted = await session.run(
        'MATCH (k:Knowledge {id: $hash}) RETURN k',
        { hash: testKnowledge[0].hash }
      );
      console.log('  Node gone:', deleted.records.length === 0 ? '✅' : '❌');

      // Rebuild
      await session.run(
        `
        CREATE (k:Knowledge {
          id: $hash,
          subject: $subject,
          predicate: $predicate,
          object: $object,
          confidence: $confidence,
          evidenceIds: $evidenceIds,
          rebuilt: true
        })
        `,
        testKnowledge[0]
      );
      console.log('  ✅ Rebuilt node');

      const rebuilt = await session.run(
        'MATCH (k:Knowledge {id: $hash}) RETURN k.rebuilt as rebuilt',
        { hash: testKnowledge[0].hash }
      );
      console.log('  Has rebuild marker:', rebuilt.records[0]?.get('rebuilt') ? '✅' : '❌');
    } catch (err) {
      console.log('  ❌ FAILED:', err);
    }

    // ========================================
    // TEST 6: Batch Performance
    // ========================================
    console.log('\nTEST 6: Batch insert performance');
    console.log('Question: How fast can we insert knowledge?');

    try {
      const batchSize = 100;
      const testBatch = [];
      
      for (let i = 0; i < batchSize; i++) {
        testBatch.push({
          hash: `batch-test-${i}`,
          subject: `entity:${i}`,
          predicate: 'relates_to',
          object: `entity:${i + 1}`,
          confidence: Math.random()
        });
      }

      const start = Date.now();
      
      // UNWIND for batch insert
      await session.run(
        `
        UNWIND $batch as item
        MERGE (k:Knowledge {id: item.hash})
        SET k.subject = item.subject,
            k.predicate = item.predicate,
            k.object = item.object,
            k.confidence = item.confidence
        `,
        { batch: testBatch }
      );
      
      const elapsed = Date.now() - start;
      console.log('  ✅ Batch insert succeeded');
      console.log('  Inserted:', batchSize, 'nodes');
      console.log('  Time:', elapsed, 'ms');
      console.log('  Throughput:', (batchSize / elapsed * 1000).toFixed(0), 'nodes/sec');
    } catch (err) {
      console.log('  ❌ FAILED:', err);
    }

    // ========================================
    // TEST 7: Query Patterns
    // ========================================
    console.log('\nTEST 7: Query pattern support');
    console.log('Question: What retrieval patterns work?');

    const queries = [
      {
        name: 'By subject pattern',
        cypher: 'MATCH (k:Knowledge) WHERE k.subject STARTS WITH "user:" RETURN k.id as id LIMIT 5'
      },
      {
        name: 'By confidence range',
        cypher: 'MATCH (k:Knowledge) WHERE k.confidence > 0.5 RETURN k.id as id, k.confidence as conf ORDER BY conf DESC LIMIT 5'
      },
      {
        name: 'Path finding',
        cypher: 'MATCH p=shortestPath((k1:Knowledge)-[*]-(k2:Knowledge)) RETURN p LIMIT 1'
      },
      {
        name: 'Neighbor expansion',
        cypher: 'MATCH (k:Knowledge {id: $hash})-[r]-(neighbor) RETURN type(r) as rel, neighbor.id as neighborId LIMIT 5'
      }
    ];

    for (const { name, cypher } of queries) {
      try {
        const result = await session.run(cypher, { hash: testKnowledge[0].hash });
        console.log(`  ✅ ${name}: ${result.records.length} results`);
      } catch (err) {
        console.log(`  ❌ ${name}:`, err instanceof Error ? err.message : String(err));
      }
    }

    // ========================================
    // CLEANUP
    // ========================================
    console.log('\n🧹 Cleaning up test data...');
    
    await session.run("MATCH (k:Knowledge) WHERE k.id STARTS WITH 'batch-test-' DELETE k");
    await session.run("MATCH (k:Knowledge) WHERE k.id STARTS WITH 'k:' DELETE k");
    console.log('  ✅ Cleanup complete');

  } catch (err) {
    console.error('\n❌ FATAL:', err);
    throw err;
  } finally {
    await session.close();
    await driver.close();
  }

  console.log('\n✅ Spike complete');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
