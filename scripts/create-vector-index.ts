/**
 * Create Neo4j Vector Index for Knowledge Embeddings
 * 
 * Purpose: Enable vector similarity search on Knowledge nodes
 * 
 * Prerequisites:
 * - Neo4j 5.11+ (vector index support)
 * - Knowledge nodes exist
 * - Embeddings populated via backfill script
 * 
 * Index config:
 * - Dimensions: 1536 (text-embedding-3-small)
 * - Similarity: cosine
 * - Name: knowledge_embeddings
 */

import neo4j from 'neo4j-driver';

const DIMENSION = 1536;
const INDEX_NAME = 'knowledge_embeddings';

async function createVectorIndex(driver: neo4j.Driver) {
  const session = driver.session();

  try {
    console.log(`Creating vector index: ${INDEX_NAME}`);
    console.log(`  Dimensions: ${DIMENSION}`);
    console.log(`  Similarity: cosine`);

    await session.run(`
      CREATE VECTOR INDEX ${INDEX_NAME} IF NOT EXISTS
      FOR (k:Knowledge)
      ON k.embedding
      OPTIONS {
        indexConfig: {
          \`vector.dimensions\`: ${DIMENSION},
          \`vector.similarity_function\`: 'cosine'
        }
      }
    `);

    console.log('\nIndex created successfully');

    // Verify index exists
    const result = await session.run(`
      SHOW INDEXES
      WHERE name = $name
    `, { name: INDEX_NAME });

    if (result.records.length > 0) {
      const record = result.records[0];
      console.log('\nIndex verification:');
      console.log(`  Name: ${record.get('name')}`);
      console.log(`  State: ${record.get('state')}`);
      console.log(`  Type: ${record.get('type')}`);
    } else {
      console.error('\nWarning: Index not found after creation');
    }

  } finally {
    await session.close();
  }
}

async function main() {
  const driver = neo4j.driver(
    process.env.NEO4J_URI || 'bolt://localhost:7687',
    neo4j.auth.basic(
      process.env.NEO4J_USER || 'neo4j',
      process.env.NEO4J_PASSWORD || 'test1234'
    )
  );

  try {
    await createVectorIndex(driver);
  } finally {
    await driver.close();
  }
}

main().catch(console.error);
