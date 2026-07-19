/**
 * Bedrock Mantle Embedding Provider
 * 
 * Purpose: Generate embeddings via Bedrock Mantle API
 * Model: Uses Amazon Titan or other Bedrock embedding models via Mantle
 * 
 * Architecture:
 * - Uses existing Bedrock proxy at http://localhost:2999
 * - Authenticates with BEDROCK_MANTLE_API_KEY (x-api-key header)
 * - Compatible with Mantle's OpenAI-compatible endpoint
 */

import { EmbeddingProvider } from './types';

// Simple console logger for embeddings (avoid logger import issues)
const log = {
  warn: (msg: string) => console.warn(`[WARN] ${msg}`),
  error: (msg: string, err?: unknown) => console.error(`[ERROR] ${msg}`, err || ''),
};

export interface BedrockEmbeddingConfig {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  dimension?: number;
}

/**
 * Bedrock Mantle Embedding Provider
 * 
 * Uses the Mantle API endpoint for embeddings.
 * Mantle provides OpenAI-compatible endpoints under the Bedrock infrastructure.
 * 
 * Default model: amazon.titan-embed-text-v1
 * Default dimension: 1536 (matches OpenAI text-embedding-3-small)
 */
export class BedrockEmbeddingProvider implements EmbeddingProvider {
  readonly name: string;
  readonly model: string;
  readonly dimension: number;
  
  private baseUrl: string;
  private apiKey: string;

  constructor(config?: BedrockEmbeddingConfig) {
    this.baseUrl = config?.baseUrl || process.env.BEDROCK_PROXY_URL || 'http://localhost:2999';
    this.apiKey = config?.apiKey || process.env.BEDROCK_MANTLE_API_KEY || '';
    this.model = config?.model || process.env.BEDROCK_EMBEDDING_MODEL || 'amazon.titan-embed-text-v1';
    this.dimension = config?.dimension || 1536;
    this.name = `bedrock-${this.model}`;

    if (!this.apiKey) {
      log.warn('BEDROCK_MANTLE_API_KEY not set - embeddings will fail with 401');
    }
  }

  async embed(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      // Return zero vector for empty input
      return Array(this.dimension).fill(0);
    }

    try {
      const response = await fetch(`${this.baseUrl}/v1/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({
          model: this.model,
          input: text,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Bedrock embedding failed (${response.status}): ${error}`);
      }

      const data = await response.json() as {
        data: Array<{ embedding: number[]; index: number }>;
        model: string;
        usage: { prompt_tokens: number; total_tokens: number };
      };

      // Validate dimension
      const embedding = data.data[0].embedding;
      if (embedding.length !== this.dimension) {
        throw new Error(
          `Embedding dimension mismatch: expected ${this.dimension}, got ${embedding.length}`
        );
      }

      return embedding;

    } catch (error) {
      log.error('Bedrock embedding error:', error);
      throw error;
    }
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    // Filter empty texts and keep track of indices
    const nonEmptyIndices: number[] = [];
    const nonEmptyTexts: string[] = [];
    
    texts.forEach((text, idx) => {
      if (text && text.trim().length > 0) {
        nonEmptyIndices.push(idx);
        nonEmptyTexts.push(text);
      }
    });

    if (nonEmptyTexts.length === 0) {
      // All inputs empty, return zero vectors
      return texts.map(() => Array(this.dimension).fill(0));
    }

    try {
      const response = await fetch(`${this.baseUrl}/v1/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({
          model: this.model,
          input: nonEmptyTexts,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Bedrock batch embedding failed (${response.status}): ${error}`);
      }

      const data = await response.json() as {
        data: Array<{ embedding: number[]; index: number }>;
        model: string;
        usage: { prompt_tokens: number; total_tokens: number };
      };

      // Sort by index to match input order
      const sorted = data.data.sort((a, b) => a.index - b.index);

      // Build result array, filling zero vectors for empty inputs
      const result: number[][] = texts.map(() => Array(this.dimension).fill(0));
      sorted.forEach((item, i) => {
        const originalIdx = nonEmptyIndices[item.index];
        
        // Validate dimension
        if (item.embedding.length !== this.dimension) {
          throw new Error(
            `Embedding dimension mismatch at index ${originalIdx}: expected ${this.dimension}, got ${item.embedding.length}`
          );
        }
        
        result[originalIdx] = item.embedding;
      });

      return result;

    } catch (error) {
      log.error('Bedrock batch embedding error:', error);
      throw error;
    }
  }
}
