/**
 * Backfill Real Conversation Knowledge to Neo4j
 * 
 * Usage: npx ts-node scripts/backfill-conversation-knowledge.ts
 */

import { Pool } from 'pg';
import neo4j from 'neo4j-driver';

async function backfillRealKnowledge() {
  const pg = new Pool({ database: 'bedrock_proxy', user: 'adarshagnihotri' });
  const neo4jDriver = neo4j.driver('bolt://localhost:7687', neo4j.auth.basic('neo4j', 'test1234'));
  
  const session = neo4jDriver.session();
  
  try {
    // Get real knowledge from conversation
    const result = await pg.query(`
      SELECT id, subject, predicate, object, confidence
      FROM knowledge
      WHERE evidence_id IN (SELECT id FROM evidence WHERE type = 'user_conversation')
    `);
    
    console.log(`Found ${result.rows.length} real knowledge to embed\n`);
    
    if (result.rows.length === 0) {
      console.log('No knowledge found from conversations');
      return;
    }
    
    for (const row of result.rows) {
      const text = `${row.subject} ${row.predicate} ${row.object}`;
      
      // Simple mock embedding (same as MockEmbeddingProvider)
      const embedding = Array(1536).fill(0).map((_, i) => {
        const charCode = text.charCodeAt(i % text.length) || 0;
        return Math.sin(charCode + i * 0.001) * 0.5 + 0.5;
      });
      
      await session.run(`
        MERGE (k:Knowledge {id: $id})
        SET k.subject = $subject,
            k.predicate = $predicate,
            k.object = $object,
            k.confidence = $confidence,
            k.embedding = $embedding
      `, {
        id: row.id,
        subject: row.subject,
        predicate: row.predicate,
        object: row.object,
        confidence: row.confidence,
        embedding
      });
      
      console.log(`✓ Embedded: ${row.subject} → ${row.predicate} → ${row.object.substring(0, 60)}...`);
    }
    
    console.log('\n✅ Backfill complete');
    
  } finally {
    await session.close();
    await pg.end();
    await neo4jDriver.close();
  }
}

backfillRealKnowledge();
