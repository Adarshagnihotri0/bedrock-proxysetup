/**
 * Provider Interfaces
 * 
 * These interfaces define the contract between business logic and storage backends.
 * All business logic should depend on these interfaces, NOT on concrete implementations
 * like Graphiti, Neo4j, or PostgreSQL.
 * 
 * Architecture Rule: No storage-specific code outside adapters/
 */

import { 
  Knowledge, 
  Evidence, 
  Entity, 
  RetrievalQuery, 
  RetrievalResult,
  ReasoningContext,
  ContextOptions 
} from './knowledge';

/**
 * EvidenceProvider - Stores and retrieves raw execution evidence
 * 
 * Evidence is the foundational layer - all knowledge must be backed by evidence.
 * This provider handles the "audit trail" of what actually happened.
 */
export interface EvidenceProvider {
  /**
   * Store evidence with automatic deduplication
   * Returns the stored evidence ID (existing if duplicate, new otherwise)
   */
  store(evidence: Omit<Evidence, 'id'>): Promise<string>;

  /**
   * Retrieve evidence by ID
   */
  get(id: string): Promise<Evidence | null>;

  /**
   * Query evidence by repository and type
   */
  query(params: {
    repository: string;
    type?: Evidence['type'];
    since?: Date;
    limit?: number;
  }): Promise<Evidence[]>;

  /**
   * Get all evidence by IDs (used for knowledge validation)
   */
  getAll(ids: string[]): Promise<Evidence[]>;

  /**
   * Check if evidence with this content hash exists
   */
  exists(contentHash: string): Promise<boolean>;
}

/**
 * KnowledgeProvider - Stores and retrieves structured knowledge
 * 
 * Knowledge is extracted from evidence and stored in the graph database.
 * Every knowledge must have evidence backing.
 */
export interface KnowledgeProvider {
  /**
   * Store knowledge with evidence links
   */
  store(knowledge: Omit<Knowledge, 'id'>): Promise<string>;

  /**
   * Retrieve knowledge by ID
   */
  get(id: string): Promise<Knowledge | null>;

  /**
   * Query knowledge by repository and type
   */
  query(params: {
    repository: string;
    type?: Knowledge['type'];
    status?: Knowledge['status'];
    limit?: number;
  }): Promise<Knowledge[]>;

  /**
   * Update knowledge status and properties
   */
  update(id: string, updates: Partial<Knowledge>): Promise<void>;

  /**
   * Link knowledge to evidence
   */
  linkEvidence(knowledgeId: string, evidenceIds: string[]): Promise<void>;

  /**
   * Find conflicting knowledge
   */
  findConflicts(knowledge: Knowledge): Promise<Knowledge[]>;

  /**
   * Find potential duplicates
   */
  findDuplicates(content: string, threshold?: number): Promise<Knowledge[]>;
}

/**
 * EntityProvider - Manages entities (modules, functions, classes, etc.)
 * 
 * Entities are discovered from evidence and linked to knowledge.
 * They form the graph structure for dependency analysis.
 */
export interface EntityProvider {
  /**
   * Create or update entity
   */
  upsert(entity: Omit<Entity, 'id'>): Promise<string>;

  /**
   * Retrieve entity by ID
   */
  get(id: string): Promise<Entity | null>;

  /**
   * Find entity by name and repository
   */
  findByName(name: string, repository: string): Promise<Entity | null>;

  /**
   * Query entities in repository
   */
  query(params: {
    repository: string;
    type?: Entity['entityType'];
    path?: string;
    limit?: number;
  }): Promise<Entity[]>;

  /**
   * Link entity to dependencies
   */
  linkDependencies(entityId: string, dependencyIds: string[]): Promise<void>;

  /**
   * Get entity dependency graph
   */
  getDependencyGraph(entityId: string, depth?: number): Promise<Entity[]>;
}

/**
 * RetrievalProvider - Retrieves knowledge with ranking
 * 
 * Handles the retrieval strategies (semantic, graph, entity, hybrid)
 * and returns ranked results.
 */
export interface RetrievalProvider {
  /**
   * Semantic search on knowledge content
   */
  semanticSearch(query: string, repository: string, limit?: number): Promise<RetrievalResult[]>;

  /**
   * Graph traversal from entity
   */
  graphTraversal(
    entityId: string, 
    repository: string, 
    depth?: number
  ): Promise<RetrievalResult[]>;

  /**
   * Entity lookup by name or path
   */
  entityLookup(query: string, repository: string): Promise<RetrievalResult[]>;

  /**
   * Hybrid retrieval (combines all strategies)
   */
  hybrid(query: RetrievalQuery): Promise<RetrievalResult[]>;

  /**
   * Get recent knowledge for repository
   */
  getRecent(repository: string, limit?: number): Promise<RetrievalResult[]>;
}

/**
 * ReasoningProvider - Builds reasoning from knowledge
 * 
 * Takes retrieved knowledge and builds explanations, dependency analysis,
 * decision traces, and failure analysis.
 */
export interface ReasoningProvider {
  /**
   * Build explanation from knowledge
   */
  explain(topic: string, repository: string): Promise<ReasoningContext>;

  /**
   * Analyze dependencies for an entity
   */
  analyzeDependencies(entityId: string): Promise<ReasoningContext>;

  /**
   * Explain an architectural decision
   */
  explainDecision(decisionTitle: string, repository: string): Promise<ReasoningContext>;

  /**
   * Analyze failure and suggest fixes
   */
  analyzeFailure(error: Error, repository: string): Promise<ReasoningContext>;
}

/**
 * ContextProvider - Builds context for agent injection
 * 
 * The final layer that takes reasoning and formats it for token budget.
 */
export interface ContextProvider {
  /**
   * Build context for a query
   */
  build(query: RetrievalQuery, options?: ContextOptions): Promise<string>;

  /**
   * Get token count for context
   */
  getTokenCount(context: string): Promise<number>;

  /**
   * Compress context to fit budget
   */
  compress(context: string, maxTokens: number): Promise<string>;
}

/**
 * StorageProvider - Convenience interface combining all storage operations
 * 
 * Used for dependency injection in services that need multiple providers.
 */
export interface StorageProvider {
  evidence: EvidenceProvider;
  knowledge: KnowledgeProvider;
  entities: EntityProvider;
}

/**
 * MemoryProvider - Full memory system interface
 * 
 * Complete interface for the memory system - used by agents.
 */
export interface MemoryProvider {
  storage: StorageProvider;
  retrieval: RetrievalProvider;
  reasoning: ReasoningProvider;
  context: ContextProvider;
}
