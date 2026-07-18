/**
 * Generate Test Knowledge Data
 * 
 * Create realistic Phase 2 knowledge for validation
 */

import { Pool } from 'pg';

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

    // First create evidence
    for (let i = 0; i < count; i++) {
      await pg.query(`
        INSERT INTO evidence (id, type, repository, content, content_hash, timestamp, provenance)
        VALUES (
          gen_random_uuid(),
          'terminal_output',
          'bedrock-proxy',
          $1,
          $2,
          NOW(),
          jsonb_build_object(
            'source', 'terminal.stdout',
            'sessionId', $3
          )
        )
      `, [
        JSON.stringify({ output: `test output ${i}` }),
        `evidence-hash-${i}`,
        `session-${Math.floor(i / 100)}`
      ]);
    }

    console.log(`✅ Created ${count} evidence rows`);

    // Create knowledge
    const types = ['fact', 'relationship', 'inference'];
    const subjects = ['user', 'build', 'test', 'deployment', 'error', 'service', 'config'];
    const predicates = ['triggered', 'caused', 'requires', 'follows', 'precedes', 'relates_to'];
    const objects = ['failure', 'success', 'timeout', 'restart', 'cleanup', 'validation'];

    for (let i = 0; i < count; i++) {
      const evidence = await pg.query(`SELECT id FROM evidence ORDER BY timestamp DESC LIMIT 1 OFFSET $1`, [i]);
      if (evidence.rows.length === 0) continue;

      const evidenceId = evidence.rows[0].id;
      const subject = `${subjects[Math.floor(Math.random() * subjects.length)]}:${Math.floor(Math.random() * 50)}`;
      const predicate = predicates[Math.floor(Math.random() * predicates.length)];
      const object = `${objects[Math.floor(Math.random() * objects.length)]}:${Math.floor(Math.random() * 50)}`;
      const type = types[Math.floor(Math.random() * types.length)];
      const confidence = 0.5 + Math.random() * 0.5;

      // Create knowledge hash (Phase 2 canonical form)
      const knowledgeData = `${subject}|${predicate}|${object}|${type}`;
      const hash = `k:${Buffer.from(knowledgeData).toString('base64').substring(0, 32)}`;

      await pg.query(`
        INSERT INTO knowledge (evidence_id, type, subject, predicate, object, confidence, hash, context)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '{}')
      `, [evidenceId, type, subject, predicate, object, confidence, hash]);
    }

    console.log(`✅ Created ${count} knowledge rows\n`);

    const result = await pg.query('SELECT COUNT(*) FROM knowledge WHERE hash IS NOT NULL');
    console.log(`Total knowledge: ${result.rows[0].count}`);

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
