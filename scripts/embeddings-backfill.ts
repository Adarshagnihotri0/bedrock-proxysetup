/**
 * Embedding Backfill Script
 * 
 * Purpose: Populate embeddings for all Knowledge nodes in Neo4j
 * 
 * Contract:
 * - Resumable: safe to run multiple times
 * - Consistent: all nodes use same embedding model
 * - Idempotent: skips nodes with existing embeddings
 * 
 * Usage:
 *   npm run embeddings:backfill
 *   npx ts-node scripts/embeddings-backfill.ts
 */

import neo4j from 'neo4j-driver';
import { Pool } from 'pg';
import { EmbeddingProvider } from '../src/embedding/types';
import { MockEmbeddingProvider } from '../src/embedding/mock-provider';
// import { OpenAIEmbeddingProvider } from '../src/embedding/openai-provider';

async function backfillEmbeddings(
  neo4j: neo4j.Driver,
  pg: Pool,
  provider: EmbeddingProvider,
  batchSize = 100
) {
  const session = neo4j.session();
  
  try {
    // Get all knowledge hashes from PostgreSQL
    const pgResult = await pg.query(`
      SELECT hash, subject, predicate, object
      FROM knowledge
      WHERE hash IS NOT NULL
      ORDER BY created_at ASC
    `);

    console.log(`Found ${pgResult.rows.length} knowledge records in PostgreSQL`);

    if (pgResult.rows.length === 0) {
      console.log('No knowledge to embed');
      return;
    }

    // Check which nodes already have embeddings
    const existingResult = await session.run(`
      MATCH (k:Knowledge)
      WHERE k.embedding_model = $model
      RETURN k.id AS id
    `, { model: provider.model });

    const existingIds = new Set(existingResult.records.map(r => r.get('id')));
    console.log(`${existingIds.size} nodes already have embeddings for model ${provider.model}`);

    // Filter to only nodes needing embeddings
    const needingEmbedding = pgResult.rows.filter(row => !existingIds.has(row.hash));
    
    if (needingEmbedding.length === 0) {
      console.log('All nodes already have embeddings');
      return;
    }

    console.log(`Embedding ${needingEmbedding.length} nodes in batches of ${batchSize}`);

    // Process in batches
    let processed = 0;
    for (let i = 0; i < needingEmbedding.length; i += batchSize) {
      const batch = needingEmbedding.slice(i, i + batchSize);
      
      // Build text to embed
      const texts = batch.map(row => 
        `${row.subject} ${row.predicate} ${row.object}`
      );

      // Generate embeddings
      const embeddings = await provider.embedBatch(texts);

      // Validate dimensions
      for (const emb of embeddings) {
        if (emb.length !== provider.dimension) {
          throw new Error(
            `Embedding dimension mismatch: expected ${provider.dimension}, got ${emb.length}`
          );
        }
      }

      // Update Neo4j nodes
      for (let j = 0; j < batch.length; j++) {
        const row = batch[j];
        const embedding = embeddings[j];

        await session.run(`
          MATCH (k:Knowledge {id: $id})
          SET k.embedding = $embedding,
              k.embedding_model = $model,
              k.embedding_dimension = $dimension,
              k.embedded_at = datetime()
        `, {
          id: row.hash,
          embedding,
          model: provider.model,
          dimension: provider.dimension
        });
      }

      processed += batch.length;
      console.log(`Progress: ${processed}/${needingEmbedding.length} (${(processed / needingEmbedding.length * 100).toFixed(1)}%)`);
    }

    console.log(`\nBackfill complete: ${processed} nodes embedded`);

  } finally {
    await session.close();
  }
}

async function main() {
  const neo4jDriver = neo4j.driver(
    process.env.NEO4J_URI || 'bolt://localhost:7687',
    neo4j.auth.basic(
      process.env.NEO4J_USER || 'neo4j',
      process.env.NEO4J_PASSWORD || 'test1234'
    )
  );

  const pgPool = new Pool({
    database: 'bedrock_proxy',
    user: process.env.PGUSER || 'adarshagnihotri'
  });

  // Use mock provider for development
  const provider = new MockEmbeddingProvider();
  
  // For production:
  // const provider = new OpenAIEmbeddingProvider();

  console.log(`Using embedding provider: ${provider.model} (dimension: ${provider.dimension})\n`);

  try {
    await backfillEmbeddings(neo4jDriver, pgPool, provider);
  } finally {
    await neo4jDriver.close();
    await pgPool.end();
  }
}

main().catch(console.error);
