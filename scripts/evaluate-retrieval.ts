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

interface QueryTest {
  query: string;
  description: string;
  expected_keywords: string[];
  min_hits: number;
}

interface EvaluationCorpus {
  queries: QueryTest[];
}

interface QueryResult {
  query: string;
  passed: boolean;
  matched_keywords: string[];
  total_keywords: number;
  hits: number;
  latency_ms: number;
  results: string[];
}

async function evaluateRetrieval(
  retrievalService: VectorRetrievalService,
  corpus: EvaluationCorpus
): Promise<QueryResult[]> {
  const results: QueryResult[] = [];

  for (const test of corpus.queries) {
    const start = Date.now();
    
    const retrieved = await retrievalService.retrieve(test.query, { limit: 10 });
    
    const latency_ms = Date.now() - start;

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
      latency_ms,
      results: retrieved.slice(0, 5).map(r => `${r.subject}:${r.object}`)
    });
  }

  return results;
}

function printReport(results: QueryResult[]) {
  console.log('\n=== Retrieval Evaluation Report ===\n');

  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const avg_latency = results.reduce((sum, r) => sum + r.latency_ms, 0) / total;

  console.log(`Queries: ${total}`);
  console.log(`Passed: ${passed}/${total} (${(passed / total * 100).toFixed(1)}%)`);
  console.log(`Average latency: ${avg_latency.toFixed(1)} ms\n`);

  console.log('Individual Results:\n');

  results.forEach((result, i) => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    
    console.log(`${i + 1}. ${status}`);
    console.log(`   Query: "${result.query}"`);
    console.log(`   Keywords matched: ${result.matched_keywords.length}/${result.total_keywords}`);
    console.log(`   ${result.matched_keywords.join(', ')}`);
    console.log(`   Hits: ${result.hits}`);
    console.log(`   Latency: ${result.latency_ms} ms`);
    console.log(`   Top 5: ${result.results.slice(0, 3).join(', ')}...`);
    console.log('');
  });

  console.log(`\n=== Evaluation Complete ===\n`);

  if (passed === total) {
    console.log('✅ All queries passed\n');
  } else {
    console.log(`⚠️  ${total - passed} queries failed\n`);
    console.log('Note: Mock embeddings are not semantically meaningful.');
    console.log('Replace with OpenAI embeddings for real retrieval quality.\n');
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
    printReport(results);
  } finally {
    await driver.close();
    await pgPool.end();
  }
}

main().catch(console.error);
