/**
 * Correct sorting implementation using binary comparison
 * 
 * This should replace the sortKnowledge method in ExtractorRegistry
 */

import type { NewKnowledge } from '../types/knowledge-extraction';
import { KnowledgeSorter } from '../pipeline/knowledge-sorter';

/**
 * Sort knowledge using deterministic binary comparison
 * 
 * WRONG (current implementation):
 *   a.subject.localeCompare(b.subject)  // locale-dependent
 * 
 * RIGHT (fixed implementation):
 *   Use KnowledgeSorter which uses KnowledgeHasher.compareHashes()
 */
export class ExtractorRegistryFixed {
  
  /**
   * Sort knowledge in canonical order (FIXED)
   * Uses KnowledgeHasher.binaryComparison for determinism
   */
  private sortKnowledge(knowledge: NewKnowledge[]): NewKnowledge[] {
    // Delegate to KnowledgeSorter which uses binary comparison
    return KnowledgeSorter.sortByIdentity(knowledge);
  }
}

/**
 * Why this matters:
 * 
 * KnowledgeSorter internally uses:
 *   KnowledgeHasher.hash(identity) → deterministic hash
 *   KnowledgeHasher.compareHashes(hashA, hashB) → binary comparison
 * 
 * KnowledgeHasher.compareHashes implementation:
 *   if (a < b) return -1;
 *   if (a > b) return 1;
 *   return 0;
 * 
 * This is locale-independent and works identically in all environments.
 */
