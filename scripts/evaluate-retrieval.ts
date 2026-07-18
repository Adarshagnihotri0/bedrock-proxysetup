/**
 * Retrieval Evaluation Script
 * 
 * Purpose: Measure retrieval quality systematically
 * 
 * Metrics:
 * - Top-1 accuracy: Is the #1 result relevant?
 * - Top-5 recall: Are expected keywords in top 5?
 * - Average latency: Time per query
 * 
 * Usage: npm run evaluate-retrieval
 */

import neo4j from 'neo4j-driver';
import { Pool } from 'pg';
import yaml from 'yaml';
import fs from 'fs';
import { VectorRetrievalService } from '../src/retrieval/vector-retrieval';
import { MockEmbeddingProvider } from '../src/embedding/mock-provider';
import { EmbeddingProvider } from '../src/embedding/types';

interface QueryTest {
  query: string;
  description: string;
  expected_keywords: string[];
  min_hits: number;
}

interface EvaluationCorpus {
  version: string;
  queries: QueryTest[];
}

interface TimingBreakdown {
  embedding_ms?: number;  // Optional: measured separately
  retrieve_ms: number;     // Total retrieval time
  total_ms: number;
}

interface QueryResult {
  query: string;
  passed: boolean;
  matched_keywords: string[];
  total_keywords: number;
  hits: number;
  timing: TimingBreakdown;
  results: string[];
}

async function evaluateRetrieval(
  retrievalService: VectorRetrievalService,
  corpus: EvaluationCorpus
): Promise<QueryResult[]> {
  const results: QueryResult[] = [];

  for (const test of corpus.queries) {
    // Timing: Total retrieval (includes embedding internally)
    const searchStart = Date.now();
    const retrieved = await retrievalService.retrieve(test.query, { limit: 10 });
    const retrieve_ms = Date.now() - searchStart;
    
    // Note: retrieve() creates embeddings internally, so we measure total time
    // To measure embedding separately, would need to refactor VectorRetrievalService

    // Check if results contain expected keywords
    const resultText = retrieved
      .map(r => `${r.subject} ${r.predicate} ${r.object}`)
      .join(' ')
      .toLowerCase();

    const matched_keywords = test.expected_keywords.filter(kw => 
      resultText.includes(kw.toLowerCase())
    );

    const passed = matched_keywords.length >= Math.ceil(test.expected_keywords.length * 0.5);

    results.push({
      query: test.query,
      passed,
      matched_keywords,
      total_keywords: test.expected_keywords.length,
      hits: retrieved.length,
      timing: {
        retrieve_ms,
        total_ms: retrieve_ms
      },
      results: retrieved.slice(0, 5).map(r => `${r.subject}:${r.object}`)
    });
  }

  return results;
}

function printReport(results: QueryResult[], provider: EmbeddingProvider, corpus: EvaluationCorpus) {
  console.log('\n=== Retrieval Evaluation Report ===\n');

  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const avg_retrieve = results.reduce((sum, r) => sum + r.timing.retrieve_ms, 0) / total;

  console.log(`Provider: ${provider.name}`);
  console.log(`Corpus: ${corpus.version}`);
  console.log(`Keyword Match: ${((passed / total) * 100).toFixed(0)}%`);
  console.log(`Latency: ${avg_retrieve.toFixed(0)} ms\n`);
  
  console.log(`Note: Currently measures keyword overlap, not Top-1 precision.`);
  console.log(`Future: Add expected_first/top5 for real retrieval metrics.\n`);

  console.log('Individual Results:\n');

  results.forEach((result, i) => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    
    console.log(`${i + 1}. ${status}`);
    console.log(`   Query: "${result.query}"`);
    console.log(`   Keywords matched: ${result.matched_keywords.length}/${result.total_keywords}`);
    console.log(`   ${result.matched_keywords.join(', ')}`);
    console.log(`   Hits: ${result.hits}`);
    console.log(`   Latency: ${result.timing.retrieve_ms} ms`);
    console.log(`   Top 5: ${result.results.slice(0, 3).join(', ')}...`);
    console.log('');
  });

  console.log(`\n=== Evaluation Complete ===\n`);

  if (passed === total) {
    console.log('✅ All queries passed\n');
  } else {
    console.log(`⚠️  ${total - passed} queries failed\n`);
    console.log('Caveats:');
    console.log('- Measuring keyword overlap (not Top-1 precision)');
    console.log('- Mock embeddings are not semantically meaningful');
    console.log('- Need expected_first/top5 for real retrieval metrics\n');
  }
}

async function main() {
  // Load corpus
  const corpusPath = 'evaluation/corpus.yaml';
  const corpusContent = fs.readFileSync(corpusPath, 'utf-8');
  const corpus = yaml.parse(corpusContent) as EvaluationCorpus;

  console.log(`Loaded ${corpus.queries.length} test queries from ${corpusPath}\n`);

  // Initialize services
  const driver = neo4j.driver(
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

  const provider = new MockEmbeddingProvider();
  const retrievalService = new VectorRetrievalService(
    driver,
    pgPool,
    (text) => provider.embed(text)
  );

  try {
    const results = await evaluateRetrieval(retrievalService, corpus);
    printReport(results, provider, corpus);
  } finally {
    await driver.close();
    await pgPool.end();
  }
}

main().catch(console.error);
