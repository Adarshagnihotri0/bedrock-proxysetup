/**
 * Enhanced Retrieval Evaluation Script
 * 
 * Purpose: Measure real retrieval metrics (not just keyword overlap)
 * 
 * Metrics:
 * - Top-1 accuracy: Was result #1 in expected.top1?
 * - Recall@5: Were expected.top5 in top 5?
 * - Recall@10: Were expected.top10 in top 10?
 * - MRR: Mean Reciprocal Rank
 * - Keyword overlap: Legacy metric (weak proxy)
 * 
 * Usage: npm run evaluate:retrieval-v2
 */

import neo4j from 'neo4j-driver';
import { Pool } from 'pg';
import yaml from 'yaml';
import fs from 'fs';
import { VectorRetrievalService } from '../src/retrieval/vector-retrieval';
import { EmbeddingProvider } from '../src/embedding/types';

interface RelevantDocument {
  hash: string;
  grade?: number;  // 3=highly relevant, 2=somewhat, 1=marginally
  notes?: string;
}

interface QueryTest {
  id: string;  // Stable query identifier for regression tracking
  query: string;
  description: string;
  category: string;
  relevant: RelevantDocument[];
  keywords?: string[];
}

interface EvaluationCorpus {
  version: string;
  queries: QueryTest[];
}

interface RetrievalMetrics {
  top1_accuracy: number;
  recall_at_1: number;
  recall_at_5: number;
  recall_at_10: number;
  mrr: number;
  keyword_overlap: number;
}

interface QueryResult {
  queryId: string;
  query: string;
  category: string;
  retrieved: Array<{ id: string; score: number }>;
  metrics: {
    top1_hit: boolean;
    recall1: number;
    recall5: number;
    recall10: number;
    reciprocal_rank: number;
    ndcg: number;
    keyword_match: number;
  };
  latency_ms: number;
}

function computeNDCG(retrieved: string[], relevantHashes: Map<string, number>): number {
  // Canonical DCG formula: (2^grade - 1) / log2(rank + 1)
  let dcg = 0;
  for (let i = 0; i < retrieved.length; i++) {
    const grade = relevantHashes.get(retrieved[i]) || 0;
    dcg += (Math.pow(2, grade) - 1) / Math.log2(i + 2);
  }
  
  // IDCG: ideal DCG (all relevant docs in perfect order)
  const idealGrades = Array.from(relevantHashes.values()).sort((a, b) => b - a);
  let idcg = 0;
  for (let i = 0; i < Math.min(idealGrades.length, retrieved.length); i++) {
    idcg += (Math.pow(2, idealGrades[i]) - 1) / Math.log2(i + 2);
  }
  
  return idcg > 0 ? dcg / idcg : 0;
}

function computeMetrics(
  retrieved: Array<{ id: string; hash?: string; score: number }>,
  relevant: RelevantDocument[],
  keywords?: string[]
): { top1_hit: boolean; recall1: number; recall5: number; recall10: number; reciprocal_rank: number; ndcg: number; keyword_match: number } {
  // Use hash if available, otherwise fall back to id
  const retrieved_ids = retrieved.map(r => r.hash || r.id);
  const relevantHashes = new Map(relevant.map(r => [r.hash, r.grade || 1]));
  
  // Top-1 accuracy
  const top1_hit = relevantHashes.has(retrieved_ids[0]);
  
  // Recall@1 (is first relevant doc in position 1?)
  const recall1 = relevantHashes.has(retrieved_ids[0]) ? 1 : 0;
  
  // Recall@5 (fraction of relevant docs in top 5)
  const recall5 = relevant.filter(r => retrieved_ids.slice(0, 5).includes(r.hash)).length / relevant.length;
  
  // Recall@10 (fraction of relevant docs in top 10)
  const recall10 = relevant.filter(r => retrieved_ids.slice(0, 10).includes(r.hash)).length / relevant.length;
  
  // Reciprocal Rank (1/position of first relevant result)
  let reciprocal_rank = 0;
  for (let i = 0; i < retrieved_ids.length; i++) {
    if (relevantHashes.has(retrieved_ids[i])) {
      reciprocal_rank = 1 / (i + 1);
      break;
    }
  }
  
  // NDCG (Normalized Discounted Cumulative Gain) - uses graded relevance
  const ndcg = computeNDCG(retrieved_ids, relevantHashes);
  
  // Keyword overlap (legacy, weak metric)
  let keyword_match = 0;
  if (keywords) {
    const resultText = retrieved.map(r => r.id).join(' ').toLowerCase();
    keyword_match = keywords.filter(kw => resultText.includes(kw.toLowerCase())).length / keywords.length;
  }
  
  return { top1_hit, recall1, recall5, recall10, reciprocal_rank, ndcg, keyword_match };
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

    const relevantHashes = test.relevant.map(r => r.hash);

    const metrics = computeMetrics(
      retrieved.map(r => ({ 
        id: r.id, 
        hash: r.provenance?.hash, 
        score: r.score 
      })),
      test.relevant,
      test.keywords
    );

    results.push({
      queryId: test.id,
      query: test.query,
      category: test.category,
      retrieved: retrieved.slice(0, 10).map(r => ({ id: r.id, score: r.score })),
      metrics,
      latency_ms
    });
  }

  return results;
}

function printReport(results: QueryResult[], provider: EmbeddingProvider, corpus: EvaluationCorpus) {
  console.log('\n=== Retrieval Evaluation Report ===\n');

  const total = results.length;
  
  // Aggregate metrics
  const top1_count = results.filter(r => r.metrics.top1_hit).length;
  const avg_recall1 = results.reduce((sum, r) => sum + r.metrics.recall1, 0) / total;
  const avg_recall5 = results.reduce((sum, r) => sum + r.metrics.recall5, 0) / total;
  const avg_recall10 = results.reduce((sum, r) => sum + r.metrics.recall10, 0) / total;
  const mrr = results.reduce((sum, r) => sum + r.metrics.reciprocal_rank, 0) / total;
  const avg_ndcg = results.reduce((sum, r) => sum + r.metrics.ndcg, 0) / total;
  const avg_keyword = results.reduce((sum, r) => sum + r.metrics.keyword_match, 0) / total;
  const avg_latency = results.reduce((sum, r) => sum + r.latency_ms, 0) / total;

  console.log(`Provider: ${provider.name}`);
  console.log(`Corpus: ${corpus.version}`);
  console.log(`Queries: ${total}\n`);

  console.log(`Retrieval Metrics:`);
  console.log(`  Recall@1: ${((top1_count / total) * 100).toFixed(1)}%`);
  console.log(`  Recall@5: ${(avg_recall5 * 100).toFixed(1)}%`);
  console.log(`  Recall@10: ${(avg_recall10 * 100).toFixed(1)}%`);
  console.log(`  MRR: ${mrr.toFixed(3)}`);
  console.log(`  NDCG: ${avg_ndcg.toFixed(3)}`);
  console.log(`  Latency: ${avg_latency.toFixed(0)} ms\n`);

  console.log(`Legacy Metric:`);
  console.log(`  Keyword Overlap: ${(avg_keyword * 100).toFixed(1)}%`);
  console.log(`  (Weak proxy - remove once relevance corpus is complete)\n`);

  console.log('Individual Results:\n');

  results.forEach((result, i) => {
    const status = result.metrics.top1_hit ? '✅' : '❌';
    
    console.log(`${i + 1}. ${status} [${result.queryId}]`);
    console.log(`   Query: "${result.query}"`);
    console.log(`   Top-1: ${result.metrics.top1_hit ? 'HIT' : 'MISS'}`);
    console.log(`   R@1: ${(result.metrics.recall1 * 100).toFixed(0)}% | R@5: ${(result.metrics.recall5 * 100).toFixed(0)}% | R@10: ${(result.metrics.recall10 * 100).toFixed(0)}%`);
    console.log(`   MRR: ${result.metrics.reciprocal_rank.toFixed(3)} | NDCG: ${result.metrics.ndcg.toFixed(3)}`);
    console.log(`   Latency: ${result.latency_ms} ms`);
    console.log(`   Top 3: ${result.retrieved.slice(0, 3).map(r => r.id.substring(0, 15)).join(', ')}...`);
    console.log('');
  });

  console.log(`\n=== Evaluation Complete ===\n`);

  if (top1_count === total) {
    console.log('✅ All queries had correct Top-1 result\n');
  } else {
    console.log(`⚠️  ${total - top1_count} queries missed Top-1\n`);
    console.log('Note: Need to populate expected.top1/top5 with ground truth IDs\n');
  }
}

async function main() {
  // Try v2 corpus first, fallback to v1
  let corpusPath = 'evaluation/corpus-v2.yaml';
  let corpusContent: string;
  
  try {
    corpusContent = fs.readFileSync(corpusPath, 'utf-8');
  } catch {
    corpusPath = 'evaluation/corpus.yaml';
    corpusContent = fs.readFileSync(corpusPath, 'utf-8');
  }

  const corpus = yaml.parse(corpusContent) as EvaluationCorpus;

  console.log(`Loaded ${corpus.queries.length} test queries from ${corpusPath}\n`);

  // Check if corpus has relevance judgments
  const hasRelevant = corpus.queries.some(q => q.relevant && q.relevant.length > 0);
  if (!hasRelevant) {
    console.log('⚠️  Corpus lacks relevance judgments');
    console.log('Metrics will use keyword overlap only (weak proxy)\n');
  }

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

  // Use dynamic import to get provider
  const { MockEmbeddingProvider } = await import('../src/embedding/mock-provider');
  const provider = new BedrockEmbeddingProvider();
  
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
