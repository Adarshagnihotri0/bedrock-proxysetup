/**
 * Extractor Registry
 * 
 * Routes evidence to all matching extractors (one-to-many)
 * Merges outputs and guarantees sorted order for determinism
 */

import type { Evidence } from '../types/knowledge';
import type { NewKnowledge } from '../types/knowledge-extraction';
import type { KnowledgeExtractor } from '../types/extractors';
import { TerminalOutputExtractor } from './terminal-output-extractor';

/**
 * Registry of all knowledge extractors
 */
export class ExtractorRegistry {
  private extractors: KnowledgeExtractor[];
  
  constructor() {
    // Register extractors
    this.extractors = [
      new TerminalOutputExtractor(),
      // Future extractors:
      // new GitDiffExtractor(),
      // new GitCommitExtractor(),
      // new BuildLogExtractor(),
      // new ErrorExtractor(),
      // etc.
    ];
  }
  
  /**
   * Get all extractors that support a given evidence type
   */
  getExtractors(evidenceType: string): KnowledgeExtractor[] {
    return this.extractors.filter(extractor => extractor.supports(evidenceType));
  }
  
  /**
   * Extract knowledge from evidence (one-to-many)
   * 
   * Flow:
   * 1. Find all matching extractors
   * 2. Run ALL extractors
   * 3. Collect all knowledge
   * 4. Sort for determinism
   */
  extract(evidence: Evidence): NewKnowledge[] {
    const matchingExtractors = this.getExtractors(evidence.type);
    
    if (matchingExtractors.length === 0) {
      return [];
    }
    
    // Run all extractors
    const allKnowledge: NewKnowledge[] = [];
    
    for (const extractor of matchingExtractors) {
      try {
        const knowledge = extractor.extract(evidence);
        allKnowledge.push(...knowledge);
      } catch (error) {
        // Log error but continue with other extractors
        console.error(`Extractor ${extractor.constructor.name} failed:`, error);
      }
    }
    
    // Sort for deterministic output
    // Sort by (subject, predicate, object, type) to guarantee stable ordering
    return this.sortKnowledge(allKnowledge);
  }
  
  /**
   * Sort knowledge in canonical order
   * Ensures same logical knowledge always produces same array order
   * 
   * CRITICAL: Uses binary comparison (locale-independent) for replay determinism.
   * Never use localeCompare() - it's locale-dependent and breaks replay across
   * different environments (e.g., Turkish locale handles I/i differently).
   * 
   * Invariant: K1 (Deterministic Extraction)
   */
  private sortKnowledge(knowledge: NewKnowledge[]): NewKnowledge[] {
    return [...knowledge].sort((a, b) => {
      // Binary comparison (locale-independent)
      // Compare by subject first
      if (a.subject < b.subject) return -1;
      if (a.subject > b.subject) return 1;
      
      // Then predicate
      if (a.predicate < b.predicate) return -1;
      if (a.predicate > b.predicate) return 1;
      
      // Then object
      if (a.object < b.object) return -1;
      if (a.object > b.object) return 1;
      
      // Finally type
      if (a.type < b.type) return -1;
      if (a.type > b.type) return 1;
      
      return 0;
    });
  }
  
  /**
   * Batch extraction from multiple evidence items
   * Maintains determinism across batch
   */
  extractBatch(evidenceItems: Evidence[]): NewKnowledge[] {
    const allKnowledge: NewKnowledge[] = [];
    
    for (const evidence of evidenceItems) {
      const knowledge = this.extract(evidence);
      allKnowledge.push(...knowledge);
    }
    
    // Sort entire batch
    return this.sortKnowledge(allKnowledge);
  }
  
  /**
   * Register custom extractor (for future evidence types)
   */
  register(extractor: KnowledgeExtractor): void {
    this.extractors.push(extractor);
  }
  
  /**
   * Get list of supported evidence types
   */
  getSupportedTypes(): string[] {
    const types = new Set<string>();
    
    for (const extractor of this.extractors) {
      // Extractors determine types they support via canExtract
      // We check common types
      const commonTypes = [
        'terminal_output',
        'git_diff',
        'git_commit',
        'build_log',
        'test_result',
        'compiler_diagnostic',
        'runtime_error',
        'user_conversation',
        'documentation',
        'system_state'
      ];
      
      for (const type of commonTypes) {
        if (extractor.supports(type)) {
          types.add(type);
        }
      }
    }
    
    return Array.from(types).sort();
  }
}
