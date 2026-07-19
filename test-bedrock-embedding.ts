/**
 * Test Bedrock Mantle Embedding Provider
 * 
 * Prerequisites:
 * 1. Bedrock proxy running on http://localhost:2999
 * 2. BEDROCK_MANTLE_API_KEY in .env
 */

import { BedrockEmbeddingProvider } from './src/embedding/bedrock-provider';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testEmbedding() {
  console.log('Testing Bedrock Mantle Embedding Provider...\n');

  const provider = new BedrockEmbeddingProvider();
  
  console.log(`Provider: ${provider.name}`);
  console.log(`Model: ${provider.model}`);
  console.log(`Dimension: ${provider.dimension}\n`);

  // Test single embedding
  const text = "Hello, this is a test of the Bedrock Mantle embedding provider.";
  console.log(`Embedding: "${text}"\n`);
  
  try {
    const start = Date.now();
    const embedding = await provider.embed(text);
    const elapsed = Date.now() - start;
    
    console.log(`✅ Generated embedding in ${elapsed}ms`);
    console.log(`   Dimension: ${embedding.length}`);
    console.log(`   First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}]\n`);
  } catch (error) {
    console.error('❌ Embedding failed:', error);
    process.exit(1);
  }

  // Test batch embedding
  const texts = [
    "Knowledge graph for AI memory",
    "PostgreSQL as canonical store",
    "Neo4j for graph projection"
  ];
  
  console.log(`Testing batch embedding (${texts.length} texts)...\n`);
  
  try {
    const start = Date.now();
    const embeddings = await provider.embedBatch(texts);
    const elapsed = Date.now() - start;
    
    console.log(`✅ Generated ${embeddings.length} embeddings in ${elapsed}ms`);
    embeddings.forEach((emb, idx) => {
      console.log(`   [${idx}] Dimension: ${emb.length}, First value: ${emb[0].toFixed(4)}`);
    });
    
  } catch (error) {
    console.error('❌ Batch embedding failed:', error);
    process.exit(1);
  }

  console.log('\n✅ All tests passed!');
}

testEmbedding().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
