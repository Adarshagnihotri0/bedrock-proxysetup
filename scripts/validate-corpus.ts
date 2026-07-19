/**
 * Corpus Validation Script
 * 
 * Purpose: Verify placeholder hashes exist in knowledge table
 * 
 * Run this before benchmarking to catch typos early:
 *   npm run validate:corpus
 */

import { Pool } from 'pg';
import yaml from 'yaml';
import * as fs from 'fs';

interface RelevantDocument {
  hash: string;
  grade?: number;
  notes?: string;
}

interface QueryTest {
  id: string;
  relevant: RelevantDocument[];
}

interface EvaluationCorpus {
  version: string;
  queries: QueryTest[];
}

async function validateCorpus(corpus: EvaluationCorpus, pgPool: Pool): Promise<void> {
  console.log(`Validating corpus ${corpus.version}...\n`);

  // Collect all unique hashes
  const allHashes = new Set<string>();
  corpus.queries.forEach(q => {
    q.relevant.forEach(r => allHashes.add(r.hash));
  });

  console.log(`Found ${allHashes.size} unique hashes across ${corpus.queries.length} queries\n`);

  // Check which hashes exist in knowledge table
  const result = await pgPool.query(
    'SELECT DISTINCT hash FROM knowledge WHERE hash = ANY($1)',
    [Array.from(allHashes)]
  );

  const existingHashes = new Set(result.rows.map((r: any) => r.hash));
  const missingHashes = Array.from(allHashes).filter(h => !existingHashes.has(h));

  if (missingHashes.length === 0) {
    console.log('✅ All hashes found in knowledge table\n');
  } else {
    console.log(`❌ ${missingHashes.length} hashes missing from knowledge table:\n`);
    missingHashes.forEach(h => console.log(`  ${h}`));
    console.log('\n');
    
    // Show which queries are affected
    corpus.queries.forEach(q => {
      const missing = q.relevant.filter(r => missingHashes.includes(r.hash));
      if (missing.length > 0) {
        console.log(`  Query "${q.id}" has ${missing.length} invalid hashes`);
      }
    });
    
    console.log('\nBenchmark validity compromised. Please fix hashes before running evaluation.\n');
    process.exit(1);
  }

  // Validate grades
  corpus.queries.forEach(q => {
    q.relevant.forEach(r => {
      if (r.grade && (r.grade < 1 || r.grade > 3)) {
        console.log(`⚠️  Warning: Query "${q.id}" has grade=${r.grade} (expected 1-3)`);
      }
    });
  });

  console.log('✅ Corpus validation passed\n');
}

async function main() {
  const corpusPath = 'evaluation/corpus-v2.yaml';
  const corpusContent = fs.readFileSync(corpusPath, 'utf-8');
  const corpus = yaml.parse(corpusContent) as EvaluationCorpus;

  const pgPool = new Pool({
    database: 'bedrock_proxy',
    user: process.env.PGUSER || 'adarshagnihotri'
  });

  try {
    await validateCorpus(corpus, pgPool);
  } finally {
    await pgPool.end();
  }
}

main().catch(console.error);
