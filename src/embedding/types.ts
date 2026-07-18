/**
 * Embedding Provider Interface
 * 
 * Purpose: Abstract embedding model from storage
 * 
 * Why: Enables model swapping without Neo4j index recreation
 * 
 * Implementations: OpenAI, Ollama, Voyage, Nomic, local models
 */

export interface EmbeddingProvider {
  /**
   * Model identifier for versioning
   */
  readonly model: string;

  /**
   * Embedding dimension (e.g., 1536 for text-embedding-3-small)
   */
  readonly dimension: number;

  /**
   * Generate embedding for text
   */
  embed(text: string): Promise<number[]>;

  /**
   * Batch embed multiple texts (for efficiency)
   */
  embedBatch?(texts: string[]): Promise<number[][]>;
}

/**
 * Embedding metadata stored with each vector
 */
export interface EmbeddingMetadata {
  model: string;
  dimension: number;
  embeddedAt: Date;
}
