/**
 * CLI for Retrieval Service
 * 
 * Usage: npx ts-node src/retrieval/cli.ts "query string"
 * 
 * Example:
 *   npx ts-node src/retrieval/cli.ts "How does replay validation work?"
 */

import neo4j from 'neo4j-driver';
import { Pool } from 'pg';
import { VectorRetrievalService } from './vector-retrieval';
import { BedrockEmbeddingProvider } from '../embedding/bedrock-provider';

async function main() {
  const query = process.argv[2];
  
  if (!query) {
    console.error('Usage: npx ts-node src/retrieval/cli.ts "query string"');
    process.exit(1);
  }

  // Initialize services
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

  // Use Bedrock Mantle embedding provider (via local proxy)
  const embeddingProvider = new BedrockEmbeddingProvider();
  const embedFn = async (text: string) => embeddingProvider.embed(text);

  const retrievalService = new VectorRetrievalService(neo4jDriver, pgPool, embedFn);

  try {
    console.log(`\nQuery: "${query}"\n`);
    console.log('Searching...\n');

    const results = await retrievalService.retrieve(query, { limit: 10 });

    if (results.length === 0) {
      console.log('No results found.\n');
      return;
    }

    console.log(`Found ${results.length} results:\n`);
    
    results.forEach((result, index) => {
      console.log(`${index + 1}.`);
      console.log(`Score: ${result.score.toFixed(3)}`);
      console.log(`Subject: ${result.subject}`);
      console.log(`Predicate: ${result.predicate}`);
      console.log(`Object: ${result.object}`);
      console.log(`Confidence: ${result.confidence}`);
      
      if (result.evidenceIds && result.evidenceIds.length > 0) {
        console.log(`Evidence IDs: ${result.evidenceIds.slice(0, 3).join(', ')}${result.evidenceIds.length > 3 ? '...' : ''}`);
      }
      
      if (result.provenance.repository) {
        console.log(`Repository: ${result.provenance.repository}`);
      }
      
      if (result.provenance.createdAt) {
        console.log(`Created: ${result.provenance.createdAt.toISOString()}`);
      }
      
      console.log('---\n');
    });

  } finally {
    await neo4jDriver.close();
    await pgPool.end();
  }
}

main().catch(console.error);
