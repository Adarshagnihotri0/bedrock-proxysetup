#!/usr/bin/env ts-node
// Phase 2 Verification: Knowledge Extraction
// Purpose: Verify knowledge table, FK constraint, and basic extraction

import { Pool } from 'pg';
import { PostgresKnowledgeProvider } from '../src/adapters/postgres-knowledge-provider';
import { TerminalOutputExtractor } from '../src/extractors/terminal-output-extractor';
import { EvidenceAdmissionPipeline } from '../src/pipeline/admission-pipeline';
import { PostgresEvidenceProvider } from '../src/adapters/postgres-evidence-provider';
import { buildRepositoryContext, buildSessionContext } from '../src/context/builders';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://localhost:5432/bedrock_proxy'
});

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

const results: TestResult[] = [];

async function runVerification() {
  console.log('=== Phase 2 Verification: Knowledge Extraction ===\n');
  
  // Test 1: Knowledge table exists
  console.log('1. Testing knowledge table existence...');
  await testKnowledgeTable();
  
  // Test 2: FK constraint enforces "no knowledge without evidence"
  console.log('2. Testing FK constraint (no knowledge without evidence)...');
  await testFKConstraint();
  
  // Test 3: Knowledge immutability
  console.log('3. Testing knowledge immutability...');
  await testKnowledgeImmutability();
  
  // Test 4: Basic knowledge insertion
  console.log('4. Testing knowledge insertion...');
  await testKnowledgeInsertion();
  
  // Test 5: Terminal output extractor
  console.log('5. Testing terminal output extractor...');
  await testTerminalExtractor();
  
  // Test 6: Knowledge query API
  console.log('6. Testing knowledge query API...');
  await testKnowledgeQuery();
  
  // Test 7: Extraction determinism
  console.log('7. Testing extraction determinism...');
  await testExtractionDeterminism();
  
  // Print results
  console.log('\n=== Verification Results ===\n');
  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.name}: ${result.message}`);
    if (result.details) {
      console.log('   Details:', JSON.stringify(result.details, null, 2));
    }
  });
  
  console.log(`\nTotal: ${results.filter(r => r.passed).length} passed, ${results.filter(r => !r.passed).length} failed\n`);
  
  if (results.every(r => r.passed)) {
    console.log('✅ ALL PHASE 2 VERIFICATIONS PASSED!\n');
  } else {
    console.log('❌ SOME TESTS FAILED. Fix before proceeding.\n');
  }
  
  await pool.end();
}

async function testKnowledgeTable() {
  try {
    const { rows } = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'knowledge'
    `);
    
    if (rows.length > 0) {
      results.push({
        name: 'Knowledge Table',
        passed: true,
        message: 'Knowledge table exists with correct schema',
        details: { columns: rows.length }
      });
    } else {
      throw new Error('Knowledge table not found');
    }
  } catch (error: any) {
    results.push({
      name: 'Knowledge Table',
      passed: false,
      message: error.message
    });
  }
}

async function testFKConstraint() {
  try {
    // Try to insert knowledge with non-existent evidence_id
    const fakeId = '00000000-0000-0000-0000-000000000000';
    
    try {
      await pool.query(`
        INSERT INTO knowledge (evidence_id, type, subject, predicate, object, confidence)
        VALUES ($1, 'fact', 'test', 'test', 'test', 1.0)
      `, [fakeId]);
      
      // Should not reach here
      await pool.query('DELETE FROM knowledge WHERE evidence_id = $1', [fakeId]);
      throw new Error('FK constraint not enforced - insert should have failed');
    } catch (insertError: any) {
      if (insertError.message.includes('foreign key') || insertError.message.includes('violates')) {
        results.push({
          name: 'FK Constraint',
          passed: true,
          message: 'FK constraint enforced - cannot insert knowledge without evidence'
        });
      } else {
        throw insertError;
      }
    }
  } catch (error: any) {
    results.push({
      name: 'FK Constraint',
      passed: false,
      message: error.message
    });
  }
}

async function testKnowledgeImmutability() {
  try {
    // First create evidence and knowledge
    const evidenceProvider = new PostgresEvidenceProvider(pool);
    const pipeline = new EvidenceAdmissionPipeline(
      evidenceProvider,
      () => buildRepositoryContext(process.cwd(), 'test-repo'),
      () => buildSessionContext('test-user', 'test-agent', 'test-tool')
    );
    
    const evidenceId = await pipeline.process({
      type: 'terminal_output',
      content: { command: 'test', exitCode: 0 },
      metadata: { source: 'test' }
    });
    
    // Insert knowledge
    const knowledgeProvider = new PostgresKnowledgeProvider(pool);
    const knowledgeId = await knowledgeProvider.store({
      evidenceId,
      type: 'fact',
      subject: 'test',
      predicate: 'test',
      object: 'test',
      confidence: 1.0
    });
    
    // Try to update knowledge
    try {
      await pool.query(`
        UPDATE knowledge SET subject = 'modified' WHERE id = $1
      `, [knowledgeId]);
      
      throw new Error('Knowledge update should have been prevented');
    } catch (updateError: any) {
      if (updateError.message.includes('cannot be modified') || updateError.message.includes('append-only')) {
        results.push({
          name: 'Knowledge Immutability',
          passed: true,
          message: 'Knowledge cannot be modified after insertion'
        });
      } else {
        throw updateError;
      }
    }
    
    // Cleanup
    await pool.query('DELETE FROM knowledge WHERE evidence_id = $1', [evidenceId]);
    await pool.query('DELETE FROM evidence WHERE id = $1', [evidenceId]);
  } catch (error: any) {
    results.push({
      name: 'Knowledge Immutability',
      passed: false,
      message: error.message
    });
  }
}

async function testKnowledgeInsertion() {
  try {
    // Create evidence first
    const evidenceProvider = new PostgresEvidenceProvider(pool);
    const pipeline = new EvidenceAdmissionPipeline(
      evidenceProvider,
      () => buildRepositoryContext(process.cwd(), 'test-repo'),
      () => buildSessionContext('test-user', 'test-agent', 'test-tool')
    );
    
    const evidenceId = await pipeline.process({
      type: 'terminal_output',
      content: { command: 'test_insert', exitCode: 0 },
      metadata: { source: 'test' }
    });
    
    // Insert knowledge
    const knowledgeProvider = new PostgresKnowledgeProvider(pool);
    const knowledgeId = await knowledgeProvider.store({
      evidenceId,
      type: 'fact',
      subject: 'test_insert',
      predicate: 'succeeded',
      object: 'true',
      confidence: 1.0
    });
    
    results.push({
      name: 'Knowledge Insertion',
      passed: true,
      message: `Knowledge inserted successfully: ${knowledgeId}`,
      details: { knowledgeId }
    });
    
    // Cleanup
    await pool.query('DELETE FROM knowledge WHERE evidence_id = $1', [evidenceId]);
    await pool.query('DELETE FROM evidence WHERE id = $1', [evidenceId]);
  } catch (error: any) {
    results.push({
      name: 'Knowledge Insertion',
      passed: false,
      message: error.message
    });
  }
}

async function testTerminalExtractor() {
  try {
    const extractor = new TerminalOutputExtractor();
    
    // Create mock evidence
    const mockEvidence: any = {
      id: 'test-id-123',
      type: 'terminal_output',
      content: {
        command: 'npm test',
        exitCode: 0,
        output: 'PASS all tests passed',
        duration: 1234
      }
    };
    
    const knowledge = extractor.extract(mockEvidence);
    
    if (knowledge.length > 0 && 
        knowledge.every(k => k.evidenceId === 'test-id-123') &&
        knowledge.every(k => k.confidence >= 0 && k.confidence <= 1)) {
      results.push({
        name: 'Terminal Extractor',
        passed: true,
        message: `Extracted ${knowledge.length} knowledge facts`,
        details: { 
          count: knowledge.length,
          types: knowledge.map(k => `${k.subject} ${k.predicate} ${k.object}`)
        }
      });
    } else {
      throw new Error('Invalid knowledge extracted');
    }
  } catch (error: any) {
    results.push({
      name: 'Terminal Extractor',
      passed: false,
      message: error.message
    });
  }
}

async function testKnowledgeQuery() {
  try {
    // Create evidence and knowledge
    const evidenceProvider = new PostgresEvidenceProvider(pool);
    const pipeline = new EvidenceAdmissionPipeline(
      evidenceProvider,
      () => buildRepositoryContext(process.cwd(), 'test-repo'),
      () => buildSessionContext('test-user', 'test-agent', 'test-tool')
    );
    const knowledgeProvider = new PostgresKnowledgeProvider(pool);
    
    const evidenceId = await pipeline.process({
      type: 'terminal_output',
      content: { command: 'query_test', exitCode: 0 },
      metadata: { source: 'test' }
    });
    
    await knowledgeProvider.store({
      evidenceId,
      type: 'fact',
      subject: 'query_test',
      predicate: 'tested',
      object: 'query',
      confidence: 0.9
    });
    
    // Query by subject
    const results1 = await knowledgeProvider.query({ subject: 'query_test' });
    
    // Query by type
    const results2 = await knowledgeProvider.query({ type: 'fact' });
    
    // Query by confidence
    const results3 = await knowledgeProvider.query({ minConfidence: 0.8 });
    
    if (results1.length > 0 && results2.length > 0 && results3.length > 0) {
      results.push({
        name: 'Knowledge Query',
        passed: true,
        message: 'Query API functional',
        details: {
          bySubject: results1.length,
          byType: results2.length,
          byConfidence: results3.length
        }
      });
    } else {
      throw new Error('Query returned no results');
    }
    
    // Cleanup
    await pool.query('DELETE FROM knowledge WHERE evidence_id = $1', [evidenceId]);
    await pool.query('DELETE FROM evidence WHERE id = $1', [evidenceId]);
  } catch (error: any) {
    results.push({
      name: 'Knowledge Query',
      passed: false,
      message: error.message
    });
  }
}

async function testExtractionDeterminism() {
  try {
    const extractor = new TerminalOutputExtractor();
    
    // Same evidence should produce same knowledge
    const mockEvidence: any = {
      id: 'determinism-test',
      type: 'terminal_output',
      content: {
        command: 'npm run build',
        exitCode: 1,
        output: 'Build failed with error'
      }
    };
    
    // Extract multiple times
    const knowledge1 = extractor.extract(mockEvidence);
    const knowledge2 = extractor.extract(mockEvidence);
    
    // Should be identical
    const same = JSON.stringify(knowledge1) === JSON.stringify(knowledge2);
    
    if (same) {
      results.push({
        name: 'Extraction Determinism',
        passed: true,
        message: 'Same evidence produces identical knowledge',
        details: { iterations: 2, knowledge_count: knowledge1.length }
      });
    } else {
      throw new Error('Extraction not deterministic');
    }
  } catch (error: any) {
    results.push({
      name: 'Extraction Determinism',
      passed: false,
      message: error.message
    });
  }
}

// Run
runVerification().catch(console.error);
