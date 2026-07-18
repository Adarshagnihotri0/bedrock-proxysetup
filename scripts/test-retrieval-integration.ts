/**
 * Retrieval Integration Test
 * 
 * Purpose: First end-to-end read path test
 * 
 * Pipeline:
 * PostgreSQL → Backfill → Neo4j → Vector Search → Hydration → Knowledge[]
 * 
 * Expected invariants:
 * 1. Retrieval returns results
 * 2. Every result has knowledge.id
 * 3. Every result has score > 0
 * 4. Every Neo4j hit hydrates from PostgreSQL
 */

import neo4j from 'neo4j-driver';
import { Pool } from 'pg';
import { VectorRetrievalService } from '../src/retrieval/vector-retrieval';
import { MockEmbeddingProvider } from '../src/embedding/mock-provider';

const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'test1234';

async function testRetrievalPipeline() {
  console.log('\n=== Retrieval Integration Test ===\n');

  const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));
  const pgPool = new Pool({ database: 'bedrock_proxy', user: 'adarshagnihotri' });
  const provider = new MockEmbeddingProvider();

  const retrievalService = new VectorRetrievalService(driver, pgPool, (text) => provider.embed(text));

  try {
    // Test query
    const query = 'canonical serialization replay';
    console.log(`Query: "${query}"\n`);

    const results = await retrievalService.retrieve(query, { limit: 5 });

    // Invariant 1: Returns results
    if (results.length === 0) {
      throw new Error('Retrieval returned zero results');
    }

    console.log(`✅ Retrieved ${results.length} results\n`);

    // Invariant 2: Every result has id
    for (const result of results) {
      if (!result.id) {
        throw new Error('Result missing knowledge.id');
      }

      // Invariant 3: Every result has score
      if (typeof result.score !== 'number' || result.score <= 0) {
        throw new Error(`Invalid score: ${result.score}`);
      }

      // Invariant 4: PostgreSQL hydration (id exists in DB)
      const pgCheck = await pgPool.query(
        'SELECT hash FROM knowledge WHERE hash = $1',
        [result.id]
      );

      if (pgCheck.rows.length !== 1) {
        throw new Error(
          `Hydration invariant violated: Neo4j returned ID ${result.id} but PostgreSQL has ${pgCheck.rows.length} rows`
        );
      }

      console.log(`Result: ${result.id}`);
      console.log(`  Score: ${result.score.toFixed(3)}`);
      console.log(`  Subject: ${result.subject}`);
      console.log(`  Predicate: ${result.predicate}`);
      console.log(`  Object: ${result.object}`);
      console.log(`  Confidence: ${result.confidence}`);
      console.log(`  PostgreSQL: ✅ Found\n`);
    }

    console.log('✅ All retrieval invariants validated');

  } finally {
    await driver.close();
    await pgPool.end();
  }
}

async function main() {
  try {
    await testRetrievalPipeline();
    console.log('\n=== Integration Test Passed ===\n');
  } catch (error) {
    console.error('\n❌ Integration test failed:', error);
    process.exit(1);
  }
}

main();
