/**
 * Fake Provider
 * 
 * In-memory implementation of all provider interfaces for testing.
 * This allows us to test business logic without any external dependencies.
 * 
 * Usage:
 * ```typescript
 * const fakeProvider = new FakeMemoryProvider();
 * const memory = createMemorySystem(fakeProvider);
 * 
 * // Test retrieval without Neo4j/PostgreSQL
 * const context = await memory.context.build(query);
 * ```
 * 
 * Verification:
 * This file proves that business logic can run without Graphiti/Neo4j.
 * If tests pass with this provider, the architecture is correctly abstracted.
 */

import type {
  EvidenceProvider,
  KnowledgeProvider,
  EntityProvider,
  RetrievalProvider,
  ReasoningProvider,
  ContextProvider,
  StorageProvider,
  MemoryProvider,
} from '../types/providers';

import type {
  Evidence,
  Knowledge,
  Entity,
  RetrievalQuery,
  RetrievalResult,
  ReasoningContext,
  ContextOptions,
  RankedResult,
} from '../types/knowledge';

import { createHash } from 'crypto';
import { randomUUID } from 'crypto';

/**
 * In-memory storage with Maps
 */
class InMemoryStorage {
  evidence: Map<string, Evidence> = new Map();
  knowledge: Map<string, Knowledge> = new Map();
  entities: Map<string, Entity> = new Map();
  evidenceByHash: Map<string, string> = new Map();
  evidenceByRepository: Map<string, Set<string>> = new Map();
  knowledgeByRepository: Map<string, Set<string>> = new Map();
  entitiesByRepository: Map<string, Set<string>> = new Map();
}

/**
 * FakeEvidenceProvider - In-memory evidence storage
 */
export class FakeEvidenceProvider implements EvidenceProvider {
  private storage: InMemoryStorage;
  
  constructor(storage: InMemoryStorage = new InMemoryStorage()) {
    this.storage = storage;
  }

  async store(evidence: Omit<Evidence, 'id'>): Promise<string> {
    // Check for duplicates
    const exists = await this.exists(evidence.contentHash);
    if (exists) {
      return this.storage.evidenceByHash.get(evidence.contentHash)!;
    }

    // Create new evidence
    const id = randomUUID();
    const fullEvidence: Evidence = {
      ...evidence,
      id,
      timestamp: new Date(evidence.timestamp),
    };

    // Store in maps
    this.storage.evidence.set(id, fullEvidence);
    this.storage.evidenceByHash.set(evidence.contentHash, id);

    // Index by repository
    if (!this.storage.evidenceByRepository.has(evidence.repository)) {
      this.storage.evidenceByRepository.set(evidence.repository, new Set());
    }
    this.storage.evidenceByRepository.get(evidence.repository)!.add(id);

    return id;
  }

  async get(id: string): Promise<Evidence | null> {
    return this.storage.evidence.get(id) || null;
  }

  async query(params: {
    repository: string;
    type?: Evidence['type'];
    since?: Date;
    limit?: number;
  }): Promise<Evidence[]> {
    const repoEvidence = this.storage.evidenceByRepository.get(params.repository);
    if (!repoEvidence) return [];

    let results: Evidence[] = [];
    
    for (const id of repoEvidence) {
      const evidence = this.storage.evidence.get(id);
      if (!evidence) continue;

      // Filter by type
      if (params.type && evidence.type !== params.type) continue;

      // Filter by time
      if (params.since && evidence.timestamp < params.since) continue;

      results.push(evidence);
    }

    // Sort by timestamp descending
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply limit
    if (params.limit) {
      results = results.slice(0, params.limit);
    }

    return results;
  }

  async getAll(ids: string[]): Promise<Evidence[]> {
    const results: Evidence[] = [];
    for (const id of ids) {
      const evidence = await this.get(id);
      if (evidence) results.push(evidence);
    }
    return results;
  }

  async exists(contentHash: string): Promise<boolean> {
    return this.storage.evidenceByHash.has(contentHash);
  }
}

/**
 * FakeKnowledgeProvider - In-memory knowledge storage
 */
export class FakeKnowledgeProvider implements KnowledgeProvider {
  private storage: InMemoryStorage;
  
  constructor(storage: InMemoryStorage = new InMemoryStorage()) {
    this.storage = storage;
  }

  async store(knowledge: Omit<Knowledge, 'id'>): Promise<string> {
    const id = randomUUID();
    const fullKnowledge: Knowledge = {
      ...knowledge,
      id,
      createdAt: new Date(knowledge.createdAt),
      validatedAt: knowledge.validatedAt ? new Date(knowledge.validatedAt) : undefined,
      supersededAt: knowledge.supersededAt ? new Date(knowledge.supersededAt) : undefined,
    } as Knowledge;

    // Store in maps
    this.storage.knowledge.set(id, fullKnowledge);

    // Index by repository
    if (!this.storage.knowledgeByRepository.has(knowledge.repository)) {
      this.storage.knowledgeByRepository.set(knowledge.repository, new Set());
    }
    this.storage.knowledgeByRepository.get(knowledge.repository)!.add(id);

    return id;
  }

  async get(id: string): Promise<Knowledge | null> {
    return this.storage.knowledge.get(id) || null;
  }

  async query(params: {
    repository: string;
    type?: Knowledge['type'];
    status?: Knowledge['status'];
    limit?: number;
  }): Promise<Knowledge[]> {
    const repoKnowledge = this.storage.knowledgeByRepository.get(params.repository);
    if (!repoKnowledge) return [];

    let results: Knowledge[] = [];
    
    for (const id of repoKnowledge) {
      const knowledge = this.storage.knowledge.get(id);
      if (!knowledge) continue;

      // Filter by type
      if (params.type && knowledge.type !== params.type) continue;

      // Filter by status
      if (params.status && knowledge.status !== params.status) continue;

      results.push(knowledge);
    }

    // Sort by createdAt descending
    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply limit
    if (params.limit) {
      results = results.slice(0, params.limit);
    }

    return results;
  }

  async update(id: string, updates: Partial<Knowledge>): Promise<void> {
    const existing = this.storage.knowledge.get(id);
    if (!existing) return;

    const updated: Knowledge = {
      ...existing,
      ...updates,
    } as Knowledge;

    this.storage.knowledge.set(id, updated);
  }

  async linkEvidence(knowledgeId: string, evidenceIds: string[]): Promise<void> {
    const knowledge = this.storage.knowledge.get(knowledgeId);
    if (!knowledge) return;

    const updatedEvidence = [...new Set([...knowledge.evidence, ...evidenceIds])];
    await this.update(knowledgeId, { evidence: updatedEvidence } as Partial<Knowledge>);
  }

  async findConflicts(knowledge: Knowledge): Promise<Knowledge[]> {
    // Simple duplicate detection based on content similarity
    const allKnowledge = Array.from(this.storage.knowledge.values());
    
    return allKnowledge.filter(k => {
      if (k.id === knowledge.id) return false;
      if (k.repository !== knowledge.repository) return false;
      if (k.type !== knowledge.type) return false;
      
      // Check for content overlap
      const similarity = this.calculateSimilarity(k.content, knowledge.content);
      return similarity > 0.8;
    });
  }

  async findDuplicates(content: string, threshold: number = 0.95): Promise<Knowledge[]> {
    const allKnowledge = Array.from(this.storage.knowledge.values());
    
    return allKnowledge.filter(k => {
      const similarity = this.calculateSimilarity(k.content, content);
      return similarity >= threshold;
    });
  }

  private calculateSimilarity(a: string, b: string): number {
    // Simple Jaccard similarity for now
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
    const union = new Set([...wordsA, ...wordsB]);
    
    return intersection.size / union.size;
  }
}

/**
 * FakeEntityProvider - In-memory entity storage
 */
export class FakeEntityProvider implements EntityProvider {
  private storage: InMemoryStorage;
  
  constructor(storage: InMemoryStorage = new InMemoryStorage()) {
    this.storage = storage;
  }

  async upsert(entity: Omit<Entity, 'id'>): Promise<string> {
    // Try to find existing entity
    const existing = await this.findByName(entity.name, entity.repository);
    
    if (existing) {
      // Update existing
      await this.updateDependencies(existing.id, entity.dependencies);
      return existing.id;
    }

    // Create new
    const id = randomUUID();
    const fullEntity: Entity = {
      ...entity,
      id,
      createdAt: new Date(),
      status: 'active',
      confidence: 1.0,
      evidence: [],
    } as Entity;

    this.storage.entities.set(id, fullEntity);

    // Index by repository
    if (!this.storage.entitiesByRepository.has(entity.repository)) {
      this.storage.entitiesByRepository.set(entity.repository, new Set());
    }
    this.storage.entitiesByRepository.get(entity.repository)!.add(id);

    return id;
  }

  async get(id: string): Promise<Entity | null> {
    return this.storage.entities.get(id) || null;
  }

  async findByName(name: string, repository: string): Promise<Entity | null> {
    const repoEntities = this.storage.entitiesByRepository.get(repository);
    if (!repoEntities) return null;

    for (const id of repoEntities) {
      const entity = this.storage.entities.get(id);
      if (entity && entity.name === name) {
        return entity;
      }
    }

    return null;
  }

  async query(params: {
    repository: string;
    type?: Entity['entityType'];
    path?: string;
    limit?: number;
  }): Promise<Entity[]> {
    const repoEntities = this.storage.entitiesByRepository.get(params.repository);
    if (!repoEntities) return [];

    let results: Entity[] = [];
    
    for (const id of repoEntities) {
      const entity = this.storage.entities.get(id);
      if (!entity) continue;

      // Filter by type
      if (params.type && entity.entityType !== params.type) continue;

      // Filter by path
      if (params.path && !entity.path.includes(params.path)) continue;

      results.push(entity);
    }

    // Apply limit
    if (params.limit) {
      results = results.slice(0, params.limit);
    }

    return results;
  }

  async linkDependencies(entityId: string, dependencyIds: string[]): Promise<void> {
    await this.updateDependencies(entityId, dependencyIds);
  }

  async getDependencyGraph(entityId: string, depth: number = 2): Promise<Entity[]> {
    const visited = new Set<string>();
    const results: Entity[] = [];
    
    const traverse = async (id: string, currentDepth: number) => {
      if (currentDepth > depth) return;
      if (visited.has(id)) return;
      
      visited.add(id);
      const entity = await this.get(id);
      if (!entity) return;
      
      results.push(entity);
      
      for (const depId of entity.dependencies) {
        await traverse(depId, currentDepth + 1);
      }
    };

    await traverse(entityId, 0);
    return results;
  }

  private async updateDependencies(id: string, dependencies: string[]): Promise<void> {
    const entity = this.storage.entities.get(id);
    if (!entity) return;

    const updated: Entity = {
      ...entity,
      dependencies,
    };

    this.storage.entities.set(id, updated);
  }
}

/**
 * FakeRetrievalProvider - Simple retrieval implementation
 */
export class FakeRetrievalProvider implements RetrievalProvider {
  constructor(
    private knowledgeProvider: KnowledgeProvider,
    private entityProvider: EntityProvider,
    private evidenceProvider: EvidenceProvider
  ) {}

  async semanticSearch(query: string, repository: string, limit: number = 10): Promise<RetrievalResult[]> {
    // Simple keyword matching for now
    const allKnowledge = await this.knowledgeProvider.query({ repository });
    const queryWords = new Set(query.toLowerCase().split(/\s+/));
    
    const scored = allKnowledge.map(k => {
      const contentWords = new Set(k.content.toLowerCase().split(/\s+/));
      const intersection = [...queryWords].filter(w => contentWords.has(w)).length;
      const score = intersection / queryWords.size;
      
      return { knowledge: k, score, source: 'semantic' as const };
    });

    // Filter by score and sort
    const results = scored
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Attach evidence
    return Promise.all(results.map(async r => ({
      ...r,
      evidence: await this.evidenceProvider.getAll(r.knowledge.evidence),
    })));
  }

  async graphTraversal(entityId: string, repository: string, depth: number = 2): Promise<RetrievalResult[]> {
    const entities = await this.entityProvider.getDependencyGraph(entityId, depth);
    
    return entities.map(entity => ({
      knowledge: entity,
      score: 1.0 / (entity as any).distance || 1.0,
      source: 'graph' as const,
      evidence: [],
    }));
  }

  async entityLookup(query: string, repository: string): Promise<RetrievalResult[]> {
    const entities = await this.entityProvider.query({ repository });
    
    const matching = entities.filter(e => 
      e.name.toLowerCase().includes(query.toLowerCase()) ||
      e.path.toLowerCase().includes(query.toLowerCase())
    );

    return matching.map(entity => ({
      knowledge: entity,
      score: 1.0,
      source: 'entity' as const,
      evidence: [],
    }));
  }

  async hybrid(query: RetrievalQuery): Promise<RetrievalResult[]> {
    // Combine all strategies
    const results = new Map<string, RankedResult>();

    if (query.text) {
      const semantic = await this.semanticSearch(query.text, query.repository);
      semantic.forEach(r => {
        const existing = results.get(r.knowledge.id);
        if (existing) {
          existing.score += r.score;
          existing.sources.push(r.source);
        } else {
          results.set(r.knowledge.id, { ...r, sources: [r.source], rank: 0 });
        }
      });
    }

    if (query.entities) {
      for (const entityId of query.entities) {
        const graph = await this.graphTraversal(entityId, query.repository, query.depth);
        graph.forEach(r => {
          const existing = results.get(r.knowledge.id);
          if (existing) {
            existing.score += r.score;
            existing.sources.push(r.source);
          } else {
            results.set(r.knowledge.id, { ...r, sources: [r.source], rank: 0 });
          }
        });
      }
    }

    // Sort and rank
    const sorted = Array.from(results.values())
      .sort((a, b) => b.score - a.score)
      .map((r, i) => ({ ...r, rank: i + 1 }));

    // Apply limit
    const limit = query.maxTokens ? Math.min(sorted.length, Math.floor(query.maxTokens / 100)) : sorted.length;
    return sorted.slice(0, limit);
  }

  async getRecent(repository: string, limit: number = 10): Promise<RetrievalResult[]> {
    const recent = await this.knowledgeProvider.query({ repository, limit });
    
    return recent.map(knowledge => ({
      knowledge,
      score: 1.0,
      source: 'recent' as const,
      evidence: [],
    }));
  }
}

/**
 * FakeReasoningProvider - Simple reasoning implementation
 */
export class FakeReasoningProvider implements ReasoningProvider {
  constructor(
    private retrievalProvider: RetrievalProvider,
    private evidenceProvider: EvidenceProvider
  ) {}

  async explain(topic: string, repository: string): Promise<ReasoningContext> {
    const results = await this.retrievalProvider.semanticSearch(topic, repository);
    
    const evidence = await Promise.all(
      results.flatMap(r => r.knowledge.evidence.map(e => this.evidenceProvider.get(e)))
    );

    return {
      repository,
      task: `Explain ${topic}`,
      relevantKnowledge: results.map(r => r.knowledge),
      explanations: results.map(r => ({
        summary: r.knowledge.content,
        details: r.knowledge.content,
        evidence: r.knowledge.evidence,
        confidence: r.knowledge.confidence,
      })),
      risks: [],
      recommendations: [],
      evidence: evidence.filter((e): e is Evidence => e !== null),
      overallConfidence: results.length > 0 
        ? results.reduce((sum, r) => sum + r.score, 0) / results.length 
        : 0,
    };
  }

  async analyzeDependencies(entityId: string): Promise<ReasoningContext> {
    // Placeholder - real implementation would traverse graph
    return {
      repository: '',
      task: 'Dependency analysis',
      relevantKnowledge: [],
      explanations: [],
      risks: [],
      recommendations: [],
      evidence: [],
      overallConfidence: 1.0,
    };
  }

  async explainDecision(decisionTitle: string, repository: string): Promise<ReasoningContext> {
    return this.explain(decisionTitle, repository);
  }

  async analyzeFailure(error: Error, repository: string): Promise<ReasoningContext> {
    return this.explain(error.message, repository);
  }
}

/**
 * FakeContextProvider - Simple context formatting
 */
export class FakeContextProvider implements ContextProvider {
  async build(query: RetrievalQuery, options?: ContextOptions): Promise<string> {
    // Placeholder - real implementation would format properly
    const maxTokens = options?.maxTokens || 5000;
    return `Memory Context (max ${maxTokens} tokens)\n\nKnowledge would be formatted here.`;
  }

  async getTokenCount(context: string): Promise<number> {
    // Rough estimate: ~4 characters per token
    return Math.ceil(context.length / 4);
  }

  async compress(context: string, maxTokens: number): Promise<string> {
    const currentTokens = await this.getTokenCount(context);
    if (currentTokens <= maxTokens) return context;
    
    // Simple truncation
    const maxChars = maxTokens * 4;
    return context.slice(0, maxChars) + '\n\n[Context truncated]';
  }
}

/**
 * FakeStorageProvider - Combined storage
 */
export class FakeStorageProvider implements StorageProvider {
  evidence: FakeEvidenceProvider;
  knowledge: FakeKnowledgeProvider;
  entities: FakeEntityProvider;
  
  constructor(storage: InMemoryStorage = new InMemoryStorage()) {
    this.evidence = new FakeEvidenceProvider(storage);
    this.knowledge = new FakeKnowledgeProvider(storage);
    this.entities = new FakeEntityProvider(storage);
  }
}

/**
 * FakeMemoryProvider - Complete memory system
 */
export class FakeMemoryProvider implements MemoryProvider {
  storage: FakeStorageProvider;
  retrieval: FakeRetrievalProvider;
  reasoning: FakeReasoningProvider;
  context: FakeContextProvider;
  
  constructor(storage: InMemoryStorage = new InMemoryStorage()) {
    this.storage = new FakeStorageProvider(storage);
    this.retrieval = new FakeRetrievalProvider(
      this.storage.knowledge,
      this.storage.entities,
      this.storage.evidence
    );
    this.reasoning = new FakeReasoningProvider(
      this.retrieval,
      this.storage.evidence
    );
    this.context = new FakeContextProvider();
  }
}

/**
 * Create a fake memory system for testing
 */
export function createFakeMemory(): MemoryProvider {
  return new FakeMemoryProvider();
}
