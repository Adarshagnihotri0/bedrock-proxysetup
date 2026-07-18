/**
 * OpenAI Embedding Provider
 * 
 * Model: text-embedding-3-small
 * Dimension: 1536
 * 
 * Cost: $0.02 per 1M tokens
 * Speed: ~1000 texts/sec
 */

import OpenAI from 'openai';
import { EmbeddingProvider } from './types';

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly model = 'text-embedding-3-small';
  readonly dimension = 1536;

  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY });
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: text
    });

    return response.data[0].embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const response = await this.client.embeddings.create({
      model: this.model,
      input: texts
    });

    // Sort by index to ensure order matches input
    const sorted = response.data.sort((a, b) => a.index - b.index);
    return sorted.map(item => item.embedding);
  }
}
