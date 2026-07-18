/**
 * Knowledge Sorting Utilities
 * 
 * Separated from KnowledgeHasher to preserve Single Responsibility Principle.
 * KnowledgeHasher: Produces deterministic identity
 * KnowledgeSorter: Orders knowledge items
 */

import type { KnowledgeIdentity } from './knowledge-hasher';
import { KnowledgeHasher } from './knowledge-hasher';

/**
 * Knowledge sorting utilities
 * 
 * IMPORTANT: Uses binary comparison (never localeCompare)
 * to ensure replay determinism across all locales
 */
export class KnowledgeSorter {
  /**
   * Sort knowledge identities using deterministic binary comparison
   */
  static sortByIdentity<T extends KnowledgeIdentity>(items: T[]): T[] {
    return [...items].sort((a, b) => {
      const hashA = KnowledgeHasher.hash(a);
      const hashB = KnowledgeHasher.hash(b);
      return KnowledgeHasher.compareHashes(hashA, hashB);
    });
  }
  
  /**
   * Sort knowledge items by hash using binary comparison
   */
  static sortByHash<T extends { hash: string }>(items: T[]): T[] {
    return [...items].sort((a, b) => {
      return KnowledgeHasher.compareHashes(a.hash, b.hash);
    });
  }
}
