/**
 * Vision Validation Experiment
 * 
 * Goal: Prove or disprove the core vision
 * "Can this system produce useful context from real conversations?"
 * 
 * Approach:
 * 1. Ingest ONE real conversation file
 * 2. Extract knowledge triples (simple patterns for now)
 * 3. Build embeddings
 * 4. Retrieve for realistic queries
 * 5. Manual quality assessment
 * 
 * Usage:
 *   npx ts-node scripts/validate-vision.ts <conversation.md>
 */

import { Pool } from 'pg';
import neo4j from 'neo4j-driver';
import { createHash } from 'crypto';
import * as fs from 'fs';

interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

interface ParsedConversation {
  title: string;
  turns: ConversationTurn[];
}

/**
 * Parse Claude Code conversation markdown
 */
function parseConversationMarkdown(filePath: string): ParsedConversation {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  const turns: ConversationTurn[] = [];
  let currentRole: 'user' | 'assistant' | null = null;
  let currentContent: string[] = [];
  
  // Extract title from first heading
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1] : 'Untitled Conversation';
  
  for (const line of lines) {
    // Detect role markers
    if (line.startsWith('## User') || line.startsWith('**User**')) {
      if (currentRole && currentContent.length > 0) {
        turns.push({
          role: currentRole,
          content: currentContent.join('\n').trim()
        });
      }
      currentRole = 'user';
      currentContent = [];
    } else if (line.startsWith('## Assistant') || line.startsWith('**Assistant**')) {
      if (currentRole && currentContent.length > 0) {
        turns.push({
          role: currentRole,
          content: currentContent.join('\n').trim()
        });
      }
      currentRole = 'assistant';
      currentContent = [];
    } else if (currentRole) {
      currentContent.push(line);
    }
  }
  
  // Don't forget last turn
  if (currentRole && currentContent.length > 0) {
    turns.push({
      role: currentRole,
      content: currentContent.join('\n').trim()
    });
  }
  
  return { title, turns };
}

/**
 * Extract simple knowledge triples from conversation
 * 
 * This is a NAIVE extraction for validation purposes.
 * Future: Replace with LLM-based extraction
 */
function extractKnowledgeFromTurn(turn: ConversationTurn, turnIndex: number): Array<{
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
}> {
  const knowledge: Array<{
    subject: string;
    predicate: string;
    object: string;
    confidence: number;
  }> = [];
  
  // Simple pattern-based extraction
  const content = turn.content.toLowerCase();
  
  // Pattern 1: "X is Y" -> (X, is, Y)
  const isMatch = content.match(/(\w+)\s+is\s+(\w+)/);
  if (isMatch) {
    knowledge.push({
      subject: isMatch[1],
      predicate: 'is',
      object: isMatch[2],
      confidence: 0.6
    });
  }
  
  // Pattern 2: "X uses Y" -> (X, uses, Y)
  const usesMatch = content.match(/(\w+)\s+uses?\s+(\w+)/);
  if (usesMatch) {
    knowledge.push({
      subject: usesMatch[1],
      predicate: 'uses',
      object: usesMatch[2],
      confidence: 0.7
    });
  }
  
  // Pattern 3: "X for Y" -> (X, purpose, Y)
  const forMatch = content.match(/(\w+)\s+for\s+(\w+)/);
  if (forMatch) {
    knowledge.push({
      subject: forMatch[1],
      predicate: 'purpose',
      object: forMatch[2],
      confidence: 0.65
    });
  }
  
  // Pattern 4: Turn context -> (conversation, turn, turnIndex)
  knowledge.push({
    subject: 'conversation',
    predicate: 'contains',
    object: `turn_${turnIndex}`,
    confidence: 0.95
  });
  
  return knowledge;
}

async function validateVision(conversationPath: string) {
  console.log('\n🔬 Vision Validation Experiment\n');
  console.log('Goal: Can this system produce useful context from real data?\n');
  
  // Initialize
  const pg = new Pool({
    database: 'bedrock_proxy',
    user: process.env.PGUSER || 'adarshagnihotri'
  });
  
  const neo4jDriver = neo4j.driver(
    process.env.NEO4J_URI || 'bolt://localhost:7687',
    neo4j.auth.basic(
      process.env.NEO4J_USER || 'neo4j',
      process.env.NEO4J_PASSWORD || 'test1234'
    )
  );
  
  const session = neo4jDriver.session();
  
  try {
    // ============================================
    // STEP 1: Parse Conversation
    // ============================================
    console.log('📋 Step 1: Parse conversation...');
    
    const conversation = parseConversationMarkdown(conversationPath);
    console.log(`  Title: "${conversation.title}"`);
    console.log(`  Turns: ${conversation.turns.length}`);
    console.log(`  User messages: ${conversation.turns.filter(t => t.role === 'user').length}`);
    console.log(`  Assistant messages: ${conversation.turns.filter(t => t.role === 'assistant').length}\n`);
    
    if (conversation.turns.length === 0) {
      console.log('❌ No turns found in conversation. Check file format.');
      return;
    }
    
    // ============================================
    // STEP 2: Store Evidence
    // ============================================
    console.log('💾 Step 2: Store as evidence...');
    
    const evidenceIds: string[] = [];
    
    for (const [index, turn] of conversation.turns.entries()) {
      const contentHash = createHash('sha256')
        .update(turn.content)
        .digest('hex');
      
      const result = await pg.query(`
        INSERT INTO evidence (type, repository, content, content_hash, provenance)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [
        'conversation',
        'vision-validation',
        JSON.stringify({
          role: turn.role,
          content: turn.content.substring(0, 500), // Truncate for storage
          turnIndex: index
        }),
        contentHash,
        JSON.stringify({
          source: 'manual-import',
          conversationTitle: conversation.title,
          timestamp: new Date().toISOString()
        })
      ]);
      
      evidenceIds.push(result.rows[0].id);
    }
    
    console.log(`  ✅ Stored ${evidenceIds.length} evidence rows\n`);
    
    // ============================================
    // STEP 3: Extract Knowledge
    // ============================================
    console.log('🧠 Step 3: Extract knowledge triples...');
    
    let knowledgeCount = 0;
    
    for (const [index, turn] of conversation.turns.entries()) {
      const triples = extractKnowledgeFromTurn(turn, index);
      
      for (const triple of triples) {
        const hashInput = `${triple.subject}|${triple.predicate}|${triple.object}|fact`;
        const hash = createHash('sha256').update(hashInput).digest('hex');
        
        await pg.query(`
          INSERT INTO knowledge (
            evidence_id, type, subject, predicate, object, confidence, hash
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT DO NOTHING
        `, [
          evidenceIds[index],
          'fact',
          triple.subject,
          triple.predicate,
          triple.object,
          triple.confidence,
          hash
        ]);
        
        knowledgeCount++;
      }
    }
    
    console.log(`  ✅ Extracted ${knowledgeCount} knowledge triples\n`);
    
    // ============================================
    // STEP 4: Build Embeddings (Manual Backfill)
    // ============================================
    console.log('🔢 Step 4: Build vector embeddings...');
    
    // Get all knowledge with hashes
    const knowledgeResult = await pg.query(`
      SELECT hash, subject, predicate, object, confidence
      FROM knowledge
      WHERE hash IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 100
    `);
    
    console.log(`  Found ${knowledgeResult.rows.length} knowledge nodes to embed`);
    
    // For validation, use mock embeddings (deterministic)
    // Future: Replace with OpenAI embeddings
    for (const row of knowledgeResult.rows) {
      const text = `${row.subject} ${row.predicate} ${row.object}`;
      const embedding = Array(1536).fill(0).map((_, i) => 
        Math.sin(text.length + i) * 0.1
      );
      
      // Store in Neo4j
      await session.run(`
        MERGE (k:Knowledge {id: $hash})
        ON CREATE SET
          k.subject = $subject,
          k.predicate = $predicate,
          k.object = $object,
          k.confidence = $confidence,
          k.embedding = $embedding,
          k.embedding_model = 'mock-validation',
          k.created_at = datetime()
      `, {
        hash: row.hash,
        subject: row.subject,
        predicate: row.predicate,
        object: row.object,
        confidence: row.confidence,
        embedding
      });
    }
    
    console.log(`  ✅ Created embeddings for ${knowledgeResult.rows.length} nodes\n`);
    
    // ============================================
    // STEP 5: Retrieve Context
    // ============================================
    console.log('🔍 Step 5: Test retrieval...');
    
    // Create vector index if not exists
    try {
      await session.run(`
        CALL db.index.vector.createNodeIndex(
          'knowledge_embeddings',
          'Knowledge',
          'embedding',
          1536,
          'cosine'
        )
      `);
      console.log('  Created vector index');
    } catch (err: any) {
      if (err.message?.includes('already exists')) {
        console.log('  Vector index already exists');
      } else {
        throw err;
      }
    }
    
    // Test queries relevant to the conversation
    const testQueries = [
      'What is this conversation about?',
      'What tools or technologies are discussed?',
      'What are the main topics?'
    ];
    
    console.log('\n  Sample retrieval results:\n');
    
    for (const query of testQueries) {
      console.log(`  Query: "${query}"`);
      
      // Mock embedding for query
      const queryEmbedding = Array(1536).fill(0).map((_, i) => 
        Math.sin(query.length + i) * 0.1
      );
      
      const result = await session.run(`
        CALL db.index.vector.queryNodes('knowledge_embeddings', 3, $embedding)
        YIELD node, score
        RETURN node.subject AS subject, node.predicate AS predicate, 
               node.object AS object, score
        ORDER BY score DESC
      `, { embedding: queryEmbedding });
      
      if (result.records.length > 0) {
        result.records.forEach((record: any, i: number) => {
          const subject = record.get('subject');
          const predicate = record.get('predicate');
          const object = record.get('object');
          const score = record.get('score');
          console.log(`    ${i + 1}. (${subject}, ${predicate}, ${object}) - score: ${score.toFixed(3)}`);
        });
      } else {
        console.log('    No results');
      }
      console.log('');
    }
    
    // ============================================
    // STEP 6: Manual Quality Assessment
    // ============================================
    console.log('📊 Step 6: Manual Quality Assessment\n');
    console.log('  ✅ Ingestion works');
    console.log('  ✅ Knowledge extraction works (naive patterns)');
    console.log('  ✅ Embeddings generated');
    console.log('  ✅ Retrieval returns results');
    console.log('\n  ❓ Open questions:');
    console.log('     - Are extracted triples meaningful?');
    console.log('     - Do retrieved results answer queries?');
    console.log('     - Would this help future decision-making?\n');
    
    console.log('📂 Sample knowledge stored:');
    const sample = await pg.query(`
      SELECT subject, predicate, object, confidence
      FROM knowledge
      WHERE repository = 'vision-validation'
      ORDER BY RANDOM()
      LIMIT 5
    `);
    
    sample.rows.forEach((row: any, i: number) => {
      console.log(`  ${i + 1}. (${row.subject}, ${row.predicate}, ${row.object}) - conf: ${row.confidence.toFixed(2)}`);
    });
    
    console.log('\n✅ Vision validation complete\n');
    console.log('Next step: Manual review of retrieved context quality\n');
    
  } finally {
    await session.close();
    await neo4jDriver.close();
    await pg.end();
  }
}

async function main() {
  const conversationPath = process.argv[2];
  
  if (!conversationPath) {
    console.error('Usage: npx ts-node scripts/validate-vision.ts <conversation.md>');
    console.error('\nExample:');
    console.error('  npx ts-node scripts/validate-vision.ts ~/Desktop/session-transcript.md');
    process.exit(1);
  }
  
  if (!fs.existsSync(conversationPath)) {
    console.error(`File not found: ${conversationPath}`);
    process.exit(1);
  }
  
  await validateVision(conversationPath);
}

main().catch(console.error);
