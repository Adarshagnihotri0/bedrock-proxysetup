#!/usr/bin/env ts-node
/**
 * Ingest Command - Full Pipeline CLI
 * 
 * One command to process a conversation through the complete system:
 * 
 * Usage:
 *   npx ts-node src/cli/ingest.ts <conversation.md>
 * 
 * Flow:
 *   1. Parse conversation markdown
 *   2. Process each turn through full pipeline (evidence + knowledge)
 *   3. Backfill embeddings if needed
 *   4. Show retrieval results
 * 
 * This is the production entry point for the bedrock-proxy system.
 */

import { Pool } from 'pg';
import neo4j, { Driver } from 'neo4j-driver';
import * as fs from 'fs';
import { FullPipeline } from '../pipeline/full-pipeline';
import { PostgresEvidenceProvider } from '../adapters/postgres-evidence-provider';
import { PostgresKnowledgeProvider } from '../adapters/postgres-knowledge-provider';
import { KnowledgeSupportProvider } from '../adapters/knowledge-support-provider';
import { VectorRetrievalService } from '../retrieval/vector-retrieval';
import { BedrockEmbeddingProvider } from '../embedding/bedrock-provider';

interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface ParsedConversation {
  title: string;
  turns: ConversationTurn[];
}

/**
 * Parse Claude Code conversation markdown
 */
function parseConversationMarkdown(filePath: string): ParsedConversation {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  const turns: ConversationTurn[] = [];
  let currentRole: 'user' | 'assistant' | null = null;
  let currentContent: string[] = [];
  
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1] : 'Untitled Conversation';
  
  for (const line of lines) {
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
  
  if (currentRole && currentContent.length > 0) {
    turns.push({
      role: currentRole,
      content: currentContent.join('\n').trim()
    });
  }
  
  return { title, turns };
}

async function getRepositoryContext() {
  const { execSync } = require('child_process');
  
  return {
    repositoryId: 'bedrock-proxy',
    branch: execSync('git rev-parse --abbrev-ref HEAD').toString().trim() || 'main',
    commit: execSync('git rev-parse HEAD').toString().trim() || 'unknown',
    name: 'bedrock-proxy',
    path: process.cwd(),
    gitStatus: {
      isClean: true,
      aheadBehind: { ahead: 0, behind: 0 },
      uncommittedFiles: 0
    }
  };
}

async function getSessionContext() {
  return {
    sessionId: `ingest-${Date.now()}`,
    userId: process.env.USER || 'unknown',
    pid: process.pid,
    cwd: process.cwd(),
    hostname: require('os').hostname(),
    platform: process.platform,
    arch: process.arch,
    runtime: `node ${process.version}`,
    agent: 'bedrock-proxy-cli',
    tool: 'ingest'
  };
}

async function backfillEmbeddings(pg: Pool, neo4jDriver: Driver) {
  const session = neo4jDriver.session();
  
  try {
    // Check for knowledge without embeddings
    const result = await session.run(`
      MATCH (k:Knowledge)
      WHERE k.embedding IS NULL
      RETURN count(k) as count
    `);
    
    const count = result.records[0].get('count').toNumber();
    
    if (count === 0) {
      console.log('  ✓ All knowledge has embeddings\n');
      return 0;
    }
    
    console.log(`  Backfilling ${count} knowledge nodes with embeddings...`);
    
    // Get all knowledge without embeddings
    const knowledgeResult = await session.run(`
      MATCH (k:Knowledge)
      WHERE k.embedding IS NULL
      RETURN k.id as id, k.subject as subject, k.predicate as predicate, k.object as object
      LIMIT 1000
    `);
    
    const embeddingProvider = new BedrockEmbeddingProvider();
    let embeddedCount = 0;
    
    for (const record of knowledgeResult.records) {
      const id = record.get('id');
      const subject = record.get('subject');
      const predicate = record.get('predicate');
      const object = record.get('object');
      
      const text = `${subject} ${predicate} ${object}`;
      const embedding = await embeddingProvider.embed(text);
      
      await session.run(`
        MATCH (k:Knowledge {id: $id})
        SET k.embedding = $embedding
      `, { id, embedding });
      
      embeddedCount++;
      
      if (embeddedCount % 100 === 0) {
        console.log(`    Embedded ${embeddedCount}/${count}`);
      }
    }
    
    console.log(`  ✓ Embedded ${embeddedCount} knowledge nodes\n`);
    return embeddedCount;
    
  } finally {
    await session.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: npx ts-node src/cli/ingest.ts <conversation.md>');
    console.log('\nExample:');
    console.log('  npx ts-node src/cli/ingest.ts ~/Desktop/session.md');
    process.exit(1);
  }
  
  const conversationPath = args[0];
  
  console.log('\n🚀 Bedrock Proxy - Full Pipeline Ingestion\n');
  console.log(`File: ${conversationPath}\n`);
  
  // Initialize database connections
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
  
  try {
    // ========================================
    // STEP 1: Parse Conversation
    // ========================================
    console.log('📋 Step 1: Parse conversation...');
    
    const conversation = parseConversationMarkdown(conversationPath);
    console.log(`  Title: "${conversation.title}"`);
    console.log(`  Turns: ${conversation.turns.length}\n`);
    
    if (conversation.turns.length === 0) {
      console.log('❌ No conversation turns found. Check file format.');
      process.exit(1);
    }
    
    // ========================================
    // STEP 2: Initialize Pipeline
    // ========================================
    console.log('🔧 Step 2: Initialize full pipeline...');
    
    const evidenceProvider = new PostgresEvidenceProvider(pg);
    const knowledgeProvider = new PostgresKnowledgeProvider(pg);
    const knowledgeSupportProvider = new KnowledgeSupportProvider(pg);
    
    const pipeline = new FullPipeline({
      evidenceProvider,
      knowledgeProvider,
      knowledgeSupportProvider,
      getRepositoryContext,
      getSessionContext
    });
    
    console.log('  ✓ Evidence pipeline initialized');
    console.log('  ✓ Knowledge pipeline initialized');
    console.log('  ✓ Extractor registry initialized\n');
    
    // ========================================
    // STEP 3: Process Conversation
    // ========================================
    console.log('💾 Step 3: Process through full pipeline...');
    
    const results = [];
    let totalKnowledge = 0;
    let totalNewKnowledge = 0;
    
    for (const [index, turn] of conversation.turns.entries()) {
      const collectorOutput = {
        type: 'user_conversation' as const,
        content: {
          role: turn.role,
          message: turn.content,
          turnIndex: index,
          conversationTitle: conversation.title
        },
        metadata: {
          source: 'claude-code-export',
          file: conversationPath,
          line: index
        }
      };
      
      const result = await pipeline.process(collectorOutput);
      results.push(result);
      
      totalKnowledge += result.knowledgeCount;
      totalNewKnowledge += result.newKnowledgeCount;
      
      if ((index + 1) % 5 === 0 || index === conversation.turns.length - 1) {
        console.log(`  Processed ${index + 1}/${conversation.turns.length} turns`);
      }
    }
    
    console.log(`\n  ✓ Admitted ${results.length} evidence`);
    console.log(`  ✓ Extracted ${totalKnowledge} knowledge (${totalNewKnowledge} new)\n`);
    
    // ========================================
    // STEP 4: Backfill Embeddings
    // ========================================
    console.log('🔢 Step 4: Ensure embeddings...');
    
    const embeddedCount = await backfillEmbeddings(pg, neo4jDriver);
    
    // ========================================
    // STEP 5: Test Retrieval
    // ========================================
    console.log('🔍 Step 5: Test retrieval...');
    
    const embeddingProvider = new BedrockEmbeddingProvider();
    const retrievalService = new VectorRetrievalService(
      neo4jDriver,
      pg,
      (text) => embeddingProvider.embed(text)
    );
    
    const testQueries = [
      'What is this conversation about?',
      'What decisions were made?',
      'What technologies are discussed?'
    ];
    
    for (const query of testQueries) {
      console.log(`\n  Query: "${query}"`);
      
      try {
        const results = await retrievalService.retrieve(query, { limit: 3 });
        
        if (results.length === 0) {
          console.log('    No results found');
          continue;
        }
        
        for (const [i, result] of results.entries()) {
          console.log(`    ${i + 1}. ${result.subject} → ${result.predicate} → ${result.object}`);
          console.log(`       Confidence: ${result.confidence?.toFixed(2) || 'N/A'}`);
        }
      } catch (err: any) {
        console.log(`    ⚠️  Error: ${err.message}`);
      }
    }
    
    console.log('\n✅ Full pipeline completed successfully!\n');
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pg.end();
    await neo4jDriver.close();
  }
}

main();
