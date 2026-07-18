/**
 * Mock Embedding Provider (Development/Testing)
 * 
 * Purpose: Enable retrieval testing without API calls
 * 
 * WARNING: Not suitable for production - deterministic but meaningless
 */

import { EmbeddingProvider } from './types';

export class MockEmbeddingProvider implements EmbeddingProvider {  readonly name = 'mock';  readonly model = 'mock-embedding';
  readonly dimension = 1536;

  async embed(text: string): Promise<number[]> {
    // Deterministic mock based on text content
    // Different texts produce different vectors
    const hash = this.simpleHash(text);
    return Array(this.dimension).fill(0).map((_, i) => 
      Math.sin(hash + i * 0.1) * 0.5
    );
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(t => this.embed(t)));
  }

  private simpleHash(text: string): number {
    return text.split('').reduce((acc, char) => 
      ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0
    );
  }
}
