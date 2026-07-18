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
   * 
   * INVARIANT: Returned array length MUST equal dimension
   */
  embed(text: string): Promise<number[]>;

  /**
   * Batch embed multiple texts (for efficiency)
   * 
   * INVARIANT: Each returned array length MUST equal dimension
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

/**
 * Validate embedding dimension
 * 
 * INVARIANT: embedding.length must equal expected dimension
 * 
 * @throws Error if dimension mismatch
 */
export function validateEmbedding(embedding: number[], expectedDimension: number): void {
  if (embedding.length !== expectedDimension) {
    throw new Error(
      `Embedding dimension mismatch: expected ${expectedDimension}, got ${embedding.length}`
    );
  }
}

/**
 * Validate embedding consistency
 * 
 * INVARIANT: embedding metadata must be complete or absent
 * Never allow partial state (embedding exists but model missing)
 */
export interface EmbeddingConsistency {
  hasEmbedding: boolean;
  embedding?: number[];
  model?: string;
  dimension?: number;
  embeddedAt?: Date;
}

export function validateEmbeddingConsistency(node: EmbeddingConsistency): void {
  const hasAny = node.hasEmbedding || node.embedding || node.model || node.dimension;
  const hasAll = node.hasEmbedding && node.embedding && node.model && node.dimension;

  if (hasAny && !hasAll) {
    throw new Error(
      `Embedding metadata incomplete: ` +
      `embedding=${!!node.embedding}, model=${!!node.model}, dimension=${!!node.dimension}`
    );
  }
}
