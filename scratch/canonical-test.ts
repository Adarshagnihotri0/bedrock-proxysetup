/**
 * Test: Canonical Serialization Conformance
 * 
 * Run against canonical protocol test vectors to verify implementation.
 */

import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// Adapted from admission-pipeline.ts canonical serialization
function canonicalSerialize(value: unknown): string {
  if (value === null) return 'null';
  if (value === true) return 'true';
  if (value === false) return 'false';
  
  if (typeof value === 'number') {
    return JSON.stringify(value);  // Subject to DECISION-002
  }
  
  if (typeof value === 'string') {
    return JSON.stringify(value);  // Subject to DECISION-009
  }
  
  if (Array.isArray(value)) {
    const elements = value.map(el => canonicalSerialize(el));
    return `[${elements.join(',')}]`;
  }
  
  if (typeof value === 'object' && value !== null) {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(value).sort((a, b) => {
      // UTF-8 byte-order comparison
      return Buffer.from(a, 'utf8').compare(Buffer.from(b, 'utf8'));
    });
    
    for (const key of keys) {
      sorted[key] = (value as Record<string, unknown>)[key];
    }
    
    const pairs: string[] = [];
    for (const key of keys) {
      const keyStr = JSON.stringify(key);
      const valStr = canonicalSerialize(sorted[key]);
      pairs.push(`${keyStr}:${valStr}`);
    }
    
    return `{${pairs.join(',')}}`;
  }
  
  throw new Error(`Unsupported type: ${typeof value}`);
}

// Test runner
interface TestVector {
  id: string;
  title: string;
  input: any;
  expected: {
    utf8: string;
    hex: string;
    length: number;
  };
}

function runTest(vector: TestVector): { pass: boolean; message: string } {
  try {
    const canonical = canonicalSerialize(vector.input);
    const expected = vector.expected.utf8;
    
    if (canonical === expected) {
      return { pass: true, message: `✅ ${vector.id}: PASS` };
    } else {
      return {
        pass: false,
        message: `❌ ${vector.id}: FAIL\n  Expected: ${expected}\n  Got:      ${canonical}`
      };
    }
  } catch (error: any) {
    return { pass: false, message: `❌ ${vector.id}: ERROR - ${error.message}` };
  }
}

// Load and run tests
const vectorsPath = '/Users/adarshagnihotri/Desktop/Projects/whyAI references/canonical-protocol/test-vectors/serialization/';

const files = fs.readdirSync(vectorsPath)
  .filter(f => f.endsWith('.json') && f.startsWith('SER-'));

console.log(`Found ${files.length} test vectors\n`);

let passed = 0;
let failed = 0;

for (const file of files) {
  const vector: TestVector = JSON.parse(
    fs.readFileSync(path.join(vectorsPath, file), 'utf-8')
  );
  
  const result = runTest(vector);
  console.log(result.message);
  
  if (result.pass) passed++;
  else failed++;
}

console.log(`\n${passed}/${passed + failed} tests passed`);

export {};
