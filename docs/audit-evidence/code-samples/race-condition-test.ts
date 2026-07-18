/**
 * Test: Evidence Deduplication Race Condition
 * 
 * Question: Can parallel evidence collection trigger the race in insert_evidence()?
 */

import { Pool } from 'pg';
import { PostgresEvidenceProvider } from '../src/adapters/postgres-evidence-provider';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const provider = new PostgresEvidenceProvider(pool);

// Simulate parallel collection of identical evidence
async function testParallelInsert() {
  const evidence = {
    type: 'terminal_output' as const,
    repository: 'test-repo',
    content: { command: 'npm test', stdout: 'ok', stderr: '', exitCode: 0 },
    contentHash: 'abc123', // Same hash
    timestamp: new Date(),
    provenance: { source: 'test' }
  };

  console.log('Testing parallel insertion with identical hash...');
  
  try {
    // Simulate two threads inserting same evidence simultaneously
    const results = await Promise.all([
      provider.store(evidence),
      provider.store(evidence),
      provider.store(evidence),
    ]);
    
    console.log('All succeeded:', results);
    console.log('IDs:', results);
    
    // Check if they returned the same ID
    const uniqueIds = new Set(results);
    if (uniqueIds.size === 1) {
      console.log('✅ PASS: All calls returned same ID (deduplication works)');
    } else {
      console.log('❌ FAIL: Different IDs returned:', uniqueIds);
    }
  } catch (error: any) {
    console.error('❌ ERROR:', error.message);
    console.error('Code:', error.code);
    
    if (error.code === '23505') {
      console.log('\n⚠️  Race condition detected:');
      console.log('Database threw UNIQUE violation');
      console.log('Provider did NOT retry');
      console.log('Evidence collection FAILED');
    }
  } finally {
    await pool.end();
  }
}

testParallelInsert();
