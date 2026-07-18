import { NextFunction, Request, Response } from 'express';
import { getGraphitiClient, MemoryNode, MemoryQuery } from '../graphiti/client';

interface ConversationContext {
  userMessage: string;
  assistantMessage: string;
  model: string;
  sessionId: string;
  timestamp: number;
}

/**
 * Middleware to store conversation in Graphiti memory
 */
export async function storeConversationMemory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Skip if memory integration not enabled
  if (process.env.ENABLE_MEMORY_INTEGRATION !== 'true') {
    next();
    return;
  }

  const client = getGraphitiClient();
  
  // Connect if not already connected
  if (!client.isConnected()) {
    await client.connect();
  }

  // Store original end function
  const originalEnd = res.end;
  const chunks: Buffer[] = [];

  // Intercept response
  res.end = function(this: Response, chunk?: any, encoding?: any, cb?: any): any {
    if (chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const responseBody = Buffer.concat(chunks).toString('utf-8');

    // Store conversation in memory after response
    storeConversationAsync(req, responseBody)
      .catch(err => console.error('Failed to store conversation:', err));

    return originalEnd.call(this, chunk, encoding, cb);
  } as any;

  next();
}

/**
 * Async function to store conversation
 */
async function storeConversationAsync(req: Request, responseBody: string): Promise<void> {
  try {
    const client = getGraphitiClient();
    
    const sessionId = req.headers['x-session-id'] as string || 'default';
    const userMessage = extractUserMessage(req.body);
    
    if (!userMessage) return;

    // Store user message
    const userNodeId = await client.storeMemory({
      id: `user_${Date.now()}`,
      type: 'conversation',
      content: userMessage,
      metadata: {
        role: 'user',
        model: req.body?.model,
      },
      timestamp: Date.now(),
      sessionId,
    });

    // Extract assistant response
    const assistantMessage = extractAssistantMessage(responseBody);
    
    if (assistantMessage) {
      // Store assistant message
      const assistantNodeId = await client.storeMemory({
        id: `assistant_${Date.now()}`,
        type: 'conversation',
        content: assistantMessage,
        metadata: {
          role: 'assistant',
          model: req.body?.model,
          tokens: extractTokenCount(responseBody),
        },
        timestamp: Date.now(),
        sessionId,
      });

      // Create edge between messages
      if (userNodeId && assistantNodeId) {
        await client.storeEdge({
          from: userNodeId,
          to: assistantNodeId,
          type: 'follows',
          weight: 1.0,
        });
      }
    }

    console.log('✓ Stored conversation in Graphiti memory');
  } catch (error) {
    console.error('Error storing conversation:', error);
  }
}

/**
 * Retrieve context from memory for a query
 */
export async function getMemoryContext(query: string, sessionId?: string): Promise<string> {
  if (process.env.ENABLE_MEMORY_INTEGRATION !== 'true') {
    return '';
  }

  const client = getGraphitiClient();
  
  if (!client.isConnected()) {
    await client.connect();
  }

  try {
    const result = await client.queryMemories({
      text: query,
      sessionId,
      limit: 5,
    });

    if (result.nodes.length === 0) {
      return '';
    }

    // Build context string
    const contextParts = result.nodes.map(node => {
      const role = node.metadata?.role || 'unknown';
      return `[${role}]: ${node.content}`;
    });

    return `\n\n[Memory Context]\n${contextParts.join('\n')}\n`;
  } catch (error) {
    console.error('Error getting memory context:', error);
    return '';
  }
}

/**
 * Get recent conversation history
 */
export async function getRecentHistory(limit: number = 10, sessionId?: string): Promise<MemoryNode[]> {
  if (process.env.ENABLE_MEMORY_INTEGRATION !== 'true') {
    return [];
  }

  const client = getGraphitiClient();
  
  if (!client.isConnected()) {
    await client.connect();
  }

  return await client.getRecentMemories(limit, sessionId);
}

/**
 * Clear session memory
 */
export async function clearMemorySession(sessionId: string): Promise<void> {
  if (process.env.ENABLE_MEMORY_INTEGRATION !== 'true') {
    return;
  }

  const client = getGraphitiClient();
  
  if (!client.isConnected()) {
    await client.connect();
  }

  await client.clearSession(sessionId);
}

/**
 * Get memory statistics
 */
export async function getMemoryStats(): Promise<{ nodeCount: number; edgeCount: number }> {
  const client = getGraphitiClient();
  
  if (!client.isConnected()) {
    return { nodeCount: 0, edgeCount: 0 };
  }

  return await client.getSessionStats();
}

// Helper functions

function extractUserMessage(body: any): string | null {
  if (!body?.messages || !Array.isArray(body.messages)) {
    return null;
  }

  // Get the last user message
  const userMessages = body.messages.filter((m: any) => m.role === 'user');
  const lastUserMessage = userMessages[userMessages.length - 1];

  if (typeof lastUserMessage?.content === 'string') {
    return lastUserMessage.content;
  }

  if (Array.isArray(lastUserMessage?.content)) {
    return lastUserMessage.content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join(' ');
  }

  return null;
}

function extractAssistantMessage(responseBody: string): string | null {
  try {
    const response = JSON.parse(responseBody);

    // OpenAI format
    if (response.choices?.[0]?.message?.content) {
      return response.choices[0].message.content;
    }

    // Anthropic format
    if (response.content?.[0]?.text) {
      return response.content[0].text;
    }

    return null;
  } catch {
    return null;
  }
}

function extractTokenCount(responseBody: string): number | undefined {
  try {
    const response = JSON.parse(responseBody);

    // OpenAI format
    if (response.usage?.total_tokens) {
      return response.usage.total_tokens;
    }

    // Anthropic format
    if (response.usage?.input_tokens && response.usage?.output_tokens) {
      return response.usage.input_tokens + response.usage.output_tokens;
    }

    return undefined;
  } catch {
    return undefined;
  }
}
