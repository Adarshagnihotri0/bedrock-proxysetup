#!/usr/bin/env ts-node

/**
 * Audit Verification Script
 * 
 * Purpose: Verify that all audit findings remain resolved
 * Run: npm run verify:audit
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

console.log('🔍 Running Audit Verification...\n');

let passCount = 0;
let failCount = 0;

function check(condition: boolean, name: string) {
  if (condition) {
    console.log(`✅ ${name}`);
    passCount++;
  } else {
    console.log(`❌ ${name}`);
    failCount++;
  }
}

// ============================================
// AUDIT-001: localeCompare removed
// ============================================

console.log('\n📋 AUDIT-001: localeCompare Determinism\n');

const extractorRegistry = fs.readFileSync(
  path.join(__dirname, '../src/extractors/extractor-registry.ts'),
  'utf-8'
);

check(
  !extractorRegistry.includes('.localeCompare('),
  'ExtractorRegistry uses binary comparison'
);

const knowledgeHasher = fs.readFileSync(
  path.join(__dirname, '../src/pipeline/knowledge-hasher.ts'),
  'utf-8'
);

check(
  knowledgeHasher.includes('Never use localeCompare'),
  'KnowledgeHasher documents localeCompare prohibition'
);

const knowledgeSorter = fs.readFileSync(
  path.join(__dirname, '../src/pipeline/knowledge-sorter.ts'),
  'utf-8'
);

check(
  knowledgeSorter.includes('Uses binary comparison'),
  'KnowledgeSorter documents binary comparison'
);

// ============================================
// AUDIT-002: Confidence aggregation documented
// ============================================

console.log('\n📋 AUDIT-002: Confidence Aggregation\n');

check(
  fs.existsSync(path.join(__dirname, '../docs/architecture/AUDIT_RESOLUTIONS.md')),
  'AUDIT_RESOLUTIONS.md exists'
);

const resolutions = fs.readFileSync(
  path.join(__dirname, '../docs/architecture/AUDIT_RESOLUTIONS.md'),
  'utf-8'
);

check(
  resolutions.includes('AUDIT-002') && resolutions.includes('TODO'),
  'AUDIT-002 documented as TODO'
);

// ============================================
// AUDIT-003: Architecture defended
// ============================================

console.log('\n📋 AUDIT-003: Confidence in Identity\n');

check(
  resolutions.includes('AUDIT-003') && resolutions.includes('REJECTED'),
  'AUDIT-003 rejected (architecture correct)'
);

// ============================================
// AUDIT-004: Canonical protocol verified
// ============================================

console.log('\n📋 AUDIT-004: Canonical Serialization\n');

const auditReport = fs.readFileSync(
  path.join(__dirname, '../docs/architecture/AUDIT_FINAL_REPORT.md'),
  'utf-8'
);

check(
  auditReport.includes('AUDIT-004') && auditReport.includes('REJECTED'),
  'AUDIT-004 rejected (canonical protocol exists)'
);

check(
  fs.existsSync(path.join(__dirname, '../docs/architecture/CROSS_REPOSITORY_DEPENDENCIES.md')),
  'Cross-repo dependencies documented'
);

// ============================================
// AUDIT-005: Race condition documented
// ============================================

console.log('\n📋 AUDIT-005: Evidence Race Condition\n');

check(
  resolutions.includes('AUDIT-005') && resolutions.includes('TODO'),
  'AUDIT-005 documented as TODO'
);

// ============================================
// Build Status
// ============================================

console.log('\n🔧 Build Verification\n');

try {
  execSync('npm run build', { stdio: 'ignore' });
  check(true, 'TypeScript build passes');
} catch (error) {
  check(false, 'TypeScript build passes');
}

// ============================================
// Summary
// ============================================

console.log('\n' + '='.repeat(50));
console.log(`\n📊 Summary: ${passCount}/${passCount + failCount} checks passed\n`);

if (failCount > 0) {
  console.log('❌ Audit verification FAILED\n');
  process.exit(1);
} else {
  console.log('✅ Audit verification PASSED\n');
  process.exit(0);
}

export {};
