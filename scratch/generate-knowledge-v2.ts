/**
 * Generate Test Knowledge Data (V2)
 * 
 * Create realistic Phase 2 knowledge for validation
 * Designed for milestone validation, not production
 */

import { Pool } from 'pg';
import { createHash } from 'crypto';

async function generateKnowledge(count: number) {
  const pg = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'bedrock_proxy',
    user: 'adarshagnihotri',
    password: ''
  });

  try {
    console.log(`Generating ${count} knowledge rows...\n`);

    const types = ['fact', 'relationship', 'inference'];
    const subjects = ['user', 'build', 'test', 'deployment', 'error', 'service', 'config'];
    const predicates = ['triggered', 'caused', 'requires', 'follows', 'precedes', 'relates_to'];
    const objects = ['failure', 'success', 'timeout', 'restart', 'cleanup', 'validation'];

    // Clean existing test data
    await pg.query("DELETE FROM knowledge WHERE subject LIKE 'test_%'");
    await pg.query("DELETE FROM evidence WHERE repository = 'test-validation'");
    console.log('✅ Cleaned existing test data');

    // Create evidence + knowledge
    for (let i = 0; i < count; i++) {
      const subject = `test_${subjects[Math.floor(Math.random() * subjects.length)]}:${Math.floor(Math.random() * 50)}`;
      const predicate = predicates[Math.floor(Math.random() * predicates.length)];
      const object = `${objects[Math.floor(Math.random() * objects.length)]}:${Math.floor(Math.random() * 50)}`;
      const type = types[Math.floor(Math.random() * types.length)];
      const confidence = 0.5 + Math.random() * 0.5;
      const sessionId = `test-session-${Math.floor(i / 100)}`;

      // Create evidence
      const evidenceResult = await pg.query(`
        INSERT INTO evidence (type, repository, content, content_hash, provenance)
        VALUES (
          'terminal_output',
          'test-validation',
          $1,
          $2,
          $3
        )
        RETURNING id
      `, [
        JSON.stringify({ output: `test output ${i}` }),
        createHash('sha256').update(`evidence-${i}`).digest('hex'),
        JSON.stringify({
          source: 'terminal.stdout',
          sessionId,
          timestamp: new Date().toISOString()
        })
      ]);

      const evidenceId = evidenceResult.rows[0].id;

      // Create canonical hash
      const hashInput = `${subject}|${predicate}|${object}|${type}`;
      const hash = createHash('sha256').update(hashInput).digest('hex');

      // Create knowledge
      await pg.query(`
        INSERT INTO knowledge (evidence_id, type, subject, predicate, object, confidence, hash)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [evidenceId, type, subject, predicate, object, confidence, hash]);

      if ((i + 1) % 100 === 0) {
        console.log(`  Created ${i + 1}/${count} knowledge rows`);
      }
    }

    const result = await pg.query('SELECT COUNT(*) FROM knowledge WHERE hash IS NOT NULL');
    console.log(`\n✅ Total knowledge in database: ${result.rows[0].count}`);

  } finally {
    await pg.end();
  }
}

const count = parseInt(process.argv[2] || '1000');
generateKnowledge(count)
  .then(() => {
    console.log('✅ Generation complete');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Generation failed:', err);
    process.exit(1);
  });
