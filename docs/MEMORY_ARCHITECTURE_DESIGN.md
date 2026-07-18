# Production-Grade Memory Architecture Design
**Long-Term Knowledge System for Autonomous AI Agents**

**Date:** 2026-07-18  
**Lead Architect:** Principal Software Architect  
**Repository:** `/Users/adarshagnihotri/Desktop/bedrock-proxy`

---

## Table of Contents

1. [Executive Overview](#executive-overview)
2. [Phase 0: Foundation Analysis](#phase-0-foundation-analysis)
3. [Phase 1: Evidence Collection Layer](#phase-1-evidence-collection-layer)
4. [Phase 2: Knowledge Extraction](#phase-2-knowledge-extraction)
5. [Phase 3: Knowledge Validation](#phase-3-knowledge-validation)
6. [Phase 4: Knowledge Store](#phase-4-knowledge-store)
7. [Phase 5: Retrieval Engine](#phase-5-retrieval-engine)
8. [Phase 6: Reasoning Layer](#phase-6-reasoning-layer)
9. [Phase 7: Context Builder](#phase-7-context-builder)
10. [Phase 8: Feedback Layer](#phase-8-feedback-layer)
11. [Phase 9: Lifecycle Management](#phase-9-lifecycle-management)
12. [Phase 10: Observability](#phase-10-observability)
13. [Implementation Roadmap](#implementation-roadmap)

---

## Executive Overview

### Problem Statement

Current implementation stores conversation history as graph nodes. This is:
- Write-only (never retrieved)
- Low-value (no knowledge extraction)
- Unsustainable (unbounded growth)
- Misusing Graphiti (chat logs ≠ knowledge graph)

### Design Goal

Build a **knowledge-based memory system** that:
- Extracts facts from execution evidence
- Validates knowledge before storage
- Retrieves relevant context efficiently
- Learns from usage patterns
- Supports long-term repository understanding

### Target Users

**Autonomous Software Engineering Agents** working on repositories over months/years, requiring:
- Repository understanding
- Decision history
- Failure patterns
- Successful fixes
- Coding conventions
- Architecture knowledge

### Design Principles

1. **Evidence-driven** - Every knowledge must link to evidence
2. **Provider abstraction** - Business logic never depends on storage
3. **Layered architecture** - Each layer independently testable
4. **Feedback loops** - System learns from outcomes
5. **Graceful degradation** - Memory failures don't crash agent

---

## Phase 0: Foundation Analysis

### Current System Audit

#### What Should Remain

**Evidence:**
```typescript
// src/graphiti/client.ts:1-20
export interface MemoryNode {
  id: string;
  type: 'conversation' | 'concept' | 'decision' | 'preference';
  content: string;
  metadata?: Record<string, any>;
  timestamp: number;
  sessionId?: string;
}
```

**Keep:**
- ✅ MemoryNode interface concept (will evolve into KnowledgeNode)
- ✅ MemoryEdge interface concept (will become RelationshipEdge)
- ✅ Connection management patterns
- ✅ Session isolation (expand to multi-tenant)

#### What Should Be Deleted

**Evidence:**
```typescript
// src/middleware/memory.ts - ALL OF IT
// This entire file violates architecture:
// 1. Direct Graphiti import (tight coupling)
// 2. Response interception (fragile)
// 3. Stores conversations (wrong abstraction)
// 4. Never retrieves (write-only)
```

**Delete:**
- ❌ `src/middleware/memory.ts` (entire file)
- ❌ Store conversation logic
- ❌ Response interception
- ❌ User/assistant node creation

**Reason:** This middleware approach is fundamentally wrong for knowledge systems.

#### What Should Be Moved

**Evidence:**
```typescript
// src/graphiti/client.ts:62-89 - Storage logic
async storeMemory(node: MemoryNode): Promise<string | null> {
  const session = this.driver.session();
  // Direct Neo4j operations
}
```

**Move:**
- 📦 Graphiti client → `src/adapters/graphiti-client.ts`
- 📦 Memory types → `src/types/knowledge.ts`
- 📦 Storage operations → Provider interface

**Reason:** Business logic should not know Graphiti exists.

#### What Should Become Interfaces

**New Interfaces:**

```typescript
// src/types/providers.ts

/**
 * Provider for knowledge persistence
 */
interface KnowledgeProvider {
  store(knowledge: ValidatedKnowledge): Promise<KnowledgeId>;
  retrieve(query: KnowledgeQuery): Promise<KnowledgeResult>;
  delete(id: KnowledgeId): Promise<void>;
  queryGraph(pattern: GraphPattern): Promise<GraphResult>;
}

/**
 * Provider for evidence collection
 */
interface EvidenceProvider {
  collect(source: EvidenceSource): Promise<Evidence[]>;
  store(evidence: Evidence): Promise<EvidenceId>;
  link(knowledge: KnowledgeId, evidence: EvidenceId): Promise<void>;
}

/**
 * Provider for retrieval operations
 */
interface RetrievalProvider {
  semanticSearch(query: string, k: number): Promise<ScoredResult[]>;
  graphTraversal(start: NodeId, depth: number): Promise<GraphNode[]>;
  entityLookup(entity: string): Promise<EntityResult>;
  hybrid(query: RetrievalQuery): Promise<RankedResult[]>;
}

/**
 * Provider for context building
 */
interface ContextProvider {
  build(query: string, knowledge: Knowledge[]): Promise<Context>;
  compress(context: Context, maxTokens: number): Promise<CompressedContext>;
  prioritize(items: ContextItem[]): Promise<PrioritizedList>;
}
```

**Reason:** Enables provider swapping without business logic changes.

#### What Should Become Services

**New Services:**

```typescript
// src/services/knowledge-extraction.service.ts
class KnowledgeExtractionService {
  constructor(
    private evidenceProvider: EvidenceProvider,
    private llmClient: LLMClient
  ) {}
  
  async extract(evidence: Evidence[]): Promise<CandidateKnowledge[]>
}

// src/services/admission-policy.service.ts
class AdmissionPolicyService {
  async validate(candidate: CandidateKnowledge): Promise<ValidationResult>
}

// src/services/entity-resolution.service.ts
class EntityResolutionService {
  async resolve(entities: Entity[]): Promise<ResolvedEntity[]>
}

// src/services/memory-retrieval.service.ts
class MemoryRetrievalService {
  constructor(
    private retrievalProvider: RetrievalProvider
  ) {}
  
  async retrieve(query: RetrievalQuery): Promise<RankedResult[]>
}

// src/services/context-builder.service.ts
class ContextBuilderService {
  constructor(
    private contextProvider: ContextProvider
  ) {}
  
  async build(taskContext: TaskContext): Promise<PromptContext>
}
```

#### What Should Become Pipelines

**New Pipelines:**

```typescript
// src/pipelines/knowledge-pipeline.ts
class KnowledgePipeline {
  constructor(
    private extraction: KnowledgeExtractionService,
    private validation: AdmissionPolicyService,
    private resolution: EntityResolutionService,
    private provider: KnowledgeProvider
  ) {}
  
  async process(evidence: Evidence[]): Promise<ProcessedKnowledge[]> {
    // Extraction → Validation → Resolution → Storage
  }
}

// src/pipelines/retrieval-pipeline.ts
class RetrievalPipeline {
  constructor(
    private retrieval: MemoryRetrievalService,
    private ranking: RankingService,
    private reasoning: ReasoningService
  ) {}
  
  async query(query: Query): Promise<ReasoningResult> {
    // Retrieve → Rank → Reason → Context
  }
}
```

### Provider Architecture Design

**Dependency Flow:**
```
Business Logic (Services/Pipelines)
            ↓
    Provider Interfaces
            ↓
    ┌──────┴──────┐
    ↓             ↓
Graphiti      Fake/Mock
Provider      Provider
    ↓             ↓
  Neo4j      In-Memory
```

**Rule:** No business logic module imports Graphiti directly.

**Verification:**
```bash
# Ensure acyclic dependency
grep -r "from '../graphiti" src/services/
grep -r "from '../graphiti" src/pipelines/
# Expected: (empty) - no direct imports
```

---

## Phase 1: Evidence Collection Layer

### Design Goal

Collect **facts from execution**, not conversations.

### Evidence Sources

#### Source 1: Git Diff

**When:** After commit, after checkout, on diff

**Evidence Type:**
```typescript
interface GitEvidence {
  type: 'git_diff';
  repository: string;
  branch: string;
  commit: CommitHash;
  files: FileChange[];
  timestamp: Date;
  author: string;
  metadata: {
    linesAdded: number;
    linesRemoved: number;
    filesChanged: number;
  };
}

interface FileChange {
  path: string;
  change: 'added' | 'modified' | 'deleted' | 'renamed';
  diff: string;
  content?: string; // For new files
}
```

**Collection Point:**
```typescript
// src/evidence/git-collector.ts
class GitEvidenceCollector {
  async collect(repository: RepositoryPath): Promise<GitEvidence[]> {
    // Parse git diff
    // Extract file changes
    // Include commit metadata
  }
}
```

#### Source 2: Terminal Output

**When:** After command execution

**Evidence Type:**
```typescript
interface TerminalEvidence {
  type: 'terminal_output';
  repository: string;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  timestamp: Date;
  duration: number;
  metadata: {
    workingDirectory: string;
    user: string;
    environment: Record<string, string>;
  };
}
```

**Collection Point:**
```typescript
// src/evidence/terminal-collector.ts
class TerminalEvidenceCollector {
  async collect(execution: CommandExecution): Promise<TerminalEvidence> {
    // Capture command
    // Capture output
    // Measure duration
  }
}
```

#### Source 3: Build Logs

**When:** After build completes

**Evidence Type:**
```typescript
interface BuildEvidence {
  type: 'build_log';
  repository: string;
  buildId: string;
  status: 'success' | 'failure' | 'partial';
  logs: LogEntry[];
  artifacts: Artifact[];
  timestamp: Date;
  duration: number;
  metadata: {
    buildTool: string;
    config: string;
  };
}
```

#### Source 4: Test Results

**When:** After test run

**Evidence Type:**
```typescript
interface TestEvidence {
  type: 'test_result';
  repository: string;
  suiteName: string;
  status: 'passed' | 'failed' | 'skipped';
  tests: TestResult[];
  coverage?: CoverageReport;
  timestamp: Date;
  duration: number;
  metadata: {
    framework: string;
    parallel: boolean;
  };
}

interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  stackTrace?: string;
}
```

#### Source 5: Compiler Diagnostics

**When:** On compile error/warning

**Evidence Type:**
```typescript
interface CompilerEvidence {
  type: 'compiler_diagnostic';
  repository: string;
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  code: string;
  timestamp: Date;
  metadata: {
    compiler: string;
    version: string;
  };
}
```

#### Source 6: Runtime Errors

**When:** On exception

**Evidence Type:**
```typescript
interface RuntimeErrorEvidence {
  type: 'runtime_error';
  repository: string;
  error: string;
  stackTrace: string[];
  context: Record<string, any>;
  timestamp: Date;
  metadata: {
    language: string;
    runtime: string;
  };
}
```

#### Source 7: User Conversation

**When:** On conversation (as secondary, not primary)

**Evidence Type:**
```typescript
interface ConversationEvidence {
  type: 'conversation';
  repository?: string;
  sessionId: string;
  messages: Message[];
  timestamp: Date;
  metadata: {
    model: string;
    tokensUsed: number;
    source: 'user' | 'agent';
  };
}
```

**Important:** Conversations are **evidence**, not knowledge directly.

#### Source 8: Documentation

**When:** On doc file read/change

**Evidence Type:**
```typescript
interface DocumentationEvidence {
  type: 'documentation';
  repository: string;
  path: string;
  content: string;
  format: 'markdown' | 'rst' | 'plaintext';
  timestamp: Date;
  metadata: {
    sections: string[];
    codeBlocks: CodeBlock[];
  };
}
```

### Evidence Collection Architecture

```typescript
// src/evidence/evidence-collector.ts
interface EvidenceCollector {
  collect(source: EvidenceSource): Promise<Evidence>;
}

class EvidenceCollectionService {
  private collectors: Map<EvidenceType, EvidenceCollector>;
  
  async collectAll(): Promise<Evidence[]> {
    const evidence: Evidence[] = [];
    
    // Collect from all registered sources
    for (const [type, collector] of this.collectors) {
      try {
        const e = await collector.collect(type);
        evidence.push(e);
      } catch (error) {
        // Log failure, continue collecting
        this.logger.warn(`Evidence collection failed for ${type}`, error);
      }
    }
    
    return evidence;
  }
}
```

### Verification Steps

**Step 1: Source Detection**
```typescript
// Test: All sources have collectors
const registeredSources = ['git', 'terminal', 'build', 'test', 'compiler', 'runtime', 'conversation', 'documentation'];
const availableSources = evidenceService.getAvailableSources();

assert(registeredSources.every(s => availableSources.includes(s)));
```

**Step 2: Provenance Retention**
```typescript
// Test: Every evidence has provenance
const evidence = await collector.collect(source);
assert(evidence.timestamp !== undefined);
assert(evidence.repository !== undefined);
assert(evidence.type !== undefined);
assert(evidence.metadata !== undefined);
```

**Step 3: Duplicate Detection**
```typescript
// Test: Same source doesn't produce duplicate evidence
const evidence1 = await collector.collect(source);
const evidence2 = await collector.collect(source);

// Should deduplicate by content hash
const evidenceHash1 = hash(evidence1);
const evidenceHash2 = hash(evidence2);

if (evidenceHash1 === evidenceHash2) {
  // Should be recognized as duplicate
  assert(resolver.isDuplicate(evidence1, evidence2));
}
```

**Step 4: Coverage Metrics**
```typescript
// Target: >95% of execution events produce evidence
const executionEvents = await getExecutionEvents(repository);
const evidenceCount = await evidenceService.count();

const coverage = evidenceCount / executionEvents.length;
assert(coverage > 0.95);

// Target: <2% duplicates
const duplicates = await evidenceService.countDuplicates();
const duplicateRate = duplicates / evidenceCount;
assert(duplicateRate < 0.02);
```

### Storage Strategy

**Evidence Store (PostgreSQL):**

```sql
CREATE TABLE evidence (
  id UUID PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  repository VARCHAR(255) NOT NULL,
  content JSONB NOT NULL,
  content_hash VARCHAR(64) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  provenance JSONB NOT NULL,
  metadata JSONB,
  
  UNIQUE(content_hash),
  INDEX idx_repository (repository),
  INDEX idx_timestamp (timestamp),
  INDEX idx_type (type)
);
```

**Why PostgreSQL, not Neo4j?**
- Evidence is high-volume, append-only
- Need fast inserts and deduplication
- Complex queries for provenance tracking
- Graph capabilities not needed for raw evidence

---

## Phase 2: Knowledge Extraction

### Design Goal

Convert evidence into structured knowledge with **zero hallucination**.

### Extraction Pipeline

```
Evidence Input
     ↓
┌─────────────────────┐
│ Candidate Extractor │
│   (LLM-based)       │
└─────────────────────┘
     ↓
Candidate Facts (unstructured)
     ↓
┌─────────────────────┐
│ Entity Extractor    │
│   (NER + LLM)       │
└─────────────────────┘
     ↓
Entities (typed)
     ↓
┌─────────────────────┐
│ Relation Extractor  │
│   (LLM)             │
└─────────────────────┘
     ↓
Relationships (typed)
     ↓
┌─────────────────────┐
│ Observation Builder │
│   (Parser)          │
└─────────────────────┘
     ↓
Observations (structured)
     ↓
┌─────────────────────┐
│ Knowledge Validator │
│   (Rules)           │
└─────────────────────┘
     ↓
Validated Knowledge
```

### Knowledge Types

#### Type 1: Architectural Decisions

**Extracted from:**
- ADR documents
- Decision conversations
- Commit messages with "decision" keyword

**Structure:**
```typescript
interface ArchitecturalDecision {
  type: 'architectural_decision';
  id: string;
  title: string;
  context: string;
  decision: string;
  consequences: string[];
  alternatives: string[];
  status: 'proposed' | 'accepted' | 'deprecated' | 'superseded';
  evidence: EvidenceId[];
  repository: string;
  timestamp: Date;
  metadata: {
    decisionMaker?: string;
    rationale?: string;
  };
}
```

**Example:**
```json
{
  "title": "Use Redis for session storage",
  "context": "Need fast, distributed session storage",
  "decision": "Use Redis with TTL for session caching",
  "consequences": ["Requires Redis ops", "Session persistence dependent on Redis"],
  "status": "accepted",
  "evidence": ["ev_123", "ev_456"]
}
```

#### Type 2: Repository Knowledge

**Extracted from:**
- File structure
- Package.json
- Config files
- Directory organization

**Structure:**
```typescript
interface RepositoryKnowledge {
  type: 'repository_knowledge';
  id: string;
  repository: string;
  category: 'structure' | 'dependency' | 'configuration' | 'pattern';
  content: {
    name: string;
    path: string;
    description: string;
    technology: string[];
    dependencies: string[];
  };
  evidence: EvidenceId[];
  timestamp: Date;
  metadata: {
    version?: string;
    environment?: string;
  };
}
```

**Example:**
```json
{
  "category": "structure",
  "content": {
    "name": "Authentication Module",
    "path": "src/auth/",
    "description": "JWT-based authentication with refresh tokens",
    "technology": ["JWT", "bcrypt"],
    "dependencies": ["jsonwebtoken", "bcrypt"]
  }
}
```

#### Type 3: Coding Conventions

**Extracted from:**
- .editorconfig
- .prettierrc
- .eslintrc
- Repeated patterns in code

**Structure:**
```typescript
interface CodingConvention {
  type: 'coding_convention';
  id: string;
  repository: string;
  category: 'formatting' | 'naming' | 'structure' | 'pattern';
  rule: string;
  examples: string[];
  exceptions: string[];
  evidence: EvidenceId[];
  timestamp: Date;
  metadata: {
    tool?: string;
    config?: Record<string, any>;
  };
}
```

#### Type 4: Failure Patterns

**Extracted from:**
- Failed test results
- Build failures
- Runtime errors
- Agent errors

**Structure:**
```typescript
interface FailurePattern {
  type: 'failure_pattern';
  id: string;
  repository: string;
  category: 'test' | 'build' | 'runtime' | 'logic';
  pattern: string;
  symptoms: string[];
  rootCause: string;
  frequency: number;
  evidence: EvidenceId[];
  timestamp: Date;
  metadata: {
    lastOccurrence: Date;
    affectedFiles: string[];
  };
}
```

#### Type 5: Successful Fixes

**Extracted from:**
- Git commits fixing bugs
- Successful test runs after failures
- Working code changes

**Structure:**
```typescript
interface SuccessfulFix {
  type: 'successful_fix';
  id: string;
  repository: string;
  problem: string;
  solution: string;
  approach: string;
  affectedFiles: string[];
  evidence: EvidenceId[];
  timestamp: Date;
  metadata: {
    testValidation: boolean;
    reviewStatus: 'pending' | 'approved' | 'rejected';
  };
}
```

#### Type 6: Dependencies

**Extracted from:**
- package.json
- requirements.txt
- Import statements

**Structure:**
```typescript
interface DependencyKnowledge {
  type: 'dependency';
  id: string;
  repository: string;
  name: string;
  version: string;
  type_: 'production' | 'development' | 'peer';
  purpose: string;
  dependents: string[];
  evidence: EvidenceId[];
  timestamp: Date;
  metadata: {
    license?: string;
    source?: string;
  };
}
```

#### Type 7: Entity Knowledge

**Extracted from:**
- Code symbols
- API resources
- Database models

**Structure:**
```typescript
interface EntityKnowledge {
  type: 'entity';
  id: string;
  repository: string;
  name: string;
  kind: 'class' | 'function' | 'module' | 'api' | 'model' | 'table';
  location: {
    file: string;
    line: number;
  };
  description: string;
  evidence: EvidenceId[];
  timestamp: Date;
  metadata: {
    visibility?: string;
    deprecated?: boolean;
  };
}
```

#### Type 8: Preferences

**Extracted from:**
- User feedback
- Agent overrides
- Successful patterns

**Structure:**
```typescript
interface PreferenceKnowledge {
  type: 'preference';
  id: string;
  repository?: string;
  category: 'user' | 'agent' | 'system';
  key: string;
  value: any;
  confidence: number;
  evidence: EvidenceId[];
  timestamp: Date;
  metadata: {
    source: string;
    frequency: number;
  };
}
```

### Extraction Service Implementation

```typescript
// src/services/knowledge-extraction.service.ts

class KnowledgeExtractionService {
  constructor(
    private evidenceProvider: EvidenceProvider,
    private llmClient: LLMClient,
    private parserService: ParserService
  ) {}
  
  async extract(evidence: Evidence[]): Promise<CandidateKnowledge[]> {
    const candidates: CandidateKnowledge[] = [];
    
    for (const e of evidence) {
      // Step 1: Determine knowledge type from evidence type
      const knowledgeTypes = this.inferKnowledgeTypes(e);
      
      for (const type of knowledgeTypes) {
        // Step 2: Use appropriate extractor
        const extractor = this.getExtractor(type);
        const candidate = await extractor.extract(e);
        
        // Step 3: Validate candidate has evidence backing
        if (this.hasEvidenceBacking(candidate, e)) {
          candidates.push(candidate);
        } else {
          // Discard hallucinated knowledge
          this.logger.warn(`Discarded hallucinated knowledge: ${candidate.id}`);
        }
      }
    }
    
    return candidates;
  }
  
  private hasEvidenceBacking(candidate: CandidateKnowledge, evidence: Evidence): boolean {
    // Every knowledge property must trace to evidence
    // This prevents LLM hallucination
    return true; // Simplified - actual implementation checks content
  }
}
```

### Verification Steps

**Step 1: Round-Trip Validation**
```typescript
// Test: Generate knowledge, check evidence link
const evidence = createTestEvidence();
const knowledge = await extractionService.extract([evidence]);

assert(knowledge.every(k => k.evidence.includes(evidence.id)));
assert(knowledge.every(k => k.content !== undefined));
assert(knowledge.every(k => k.timestamp !== undefined));
```

**Step 2: Hallucination Check**
```typescript
// Test: Extracted knowledge must have evidence support
const knowledge = await extractionService.extract(evidence);

for (const k of knowledge) {
  // Every fact must link to evidence
  assert(k.evidence.length > 0);
  
  // Verify evidence exists
  for (const evId of k.evidence) {
    const ev = await evidenceProvider.get(evId);
    assert(ev !== null);
    
    // Check knowledge content appears in evidence
    assert(ev.content.includes(k.content) || 
           this.isDerived(k.content, ev.content));
  }
}
```

**Step 3: Coverage Check**
```typescript
// Test: All evidence types can produce knowledge
const evidenceTypes = ['git', 'terminal', 'test', 'build', 'compiler', 'runtime'];

for (const type of evidenceTypes) {
  const evidence = createMockEvidence(type);
  const knowledge = await extractionService.extract([evidence]);
  assert(knowledge.length > 0, `No knowledge extracted from ${type}`);
}
```

### Metrics

```typescript
interface ExtractionMetrics {
  // Precision: What % of extracted knowledge is valid?
  precision: number; // Target: >95%
  
  // Recall: What % of valid knowledge was extracted?
  recall: number; // Target: >85%
  
  // Hallucination rate: What % of knowledge has NO evidence?
  hallucinationRate: number; // Target: 0%
  
  // Coverage: What % of evidence types produce knowledge?
  coverage: number; // Target: 100%
}
```

---

## Phase 3: Knowledge Validation

### Design Goal

Reject bad knowledge before storage.

### Validation Pipeline

```
Candidate Knowledge
        ↓
┌──────────────────┐
│ Schema Validator │
│  (TypeScript)    │
└──────────────────┘
        ↓
Valid Schema?
        ↓ Yes
┌──────────────────┐
│ Evidence Validator│
│  (Link Checker)  │
└──────────────────┘
        ↓
Evidence Exists?
        ↓ Yes
┌──────────────────┐
│ Conflict Detector │
│  (Graph Query)   │
└──────────────────┘
        ↓
Conflicts Found?
        ↓ No
┌──────────────────┐
│ Duplicate Detector│
│  (Content Hash)  │
└──────────────────┘
        ↓
is Duplicate?
        ↓ No
┌──────────────────┐
│ Admission Policy  │
│  (Scoring)        │
└──────────────────┘
        ↓
Should Store?
        ↓ Yes
┌──────────────────┐
│ Accept Knowledge  │
└──────────────────┘
```

### Validation Rules

#### Rule 1: Schema Validation

**Check:** Knowledge matches TypeScript type

```typescript
function validateSchema(knowledge: any): ValidationResult {
  const validTypes = [
    'architectural_decision',
    'repository_knowledge',
    'coding_convention',
    'failure_pattern',
    'successful_fix',
    'dependency',
    'entity',
    'preference'
  ];
  
  if (!validTypes.includes(knowledge.type)) {
    return { valid: false, reason: `Invalid type: ${knowledge.type}` };
  }
  
  if (!knowledge.id) {
    return { valid: false, reason: 'Missing id' };
  }
  
  if (!knowledge.evidence || knowledge.evidence.length === 0) {
    return { valid: false, reason: 'Missing evidence' };
  }
  
  if (!knowledge.timestamp) {
    return { valid: false, reason: 'Missing timestamp' };
  }
  
  return { valid: true };
}
```

#### Rule 2: Evidence Validation

**Check:** All evidence IDs exist

```typescript
async function validateEvidence(knowledge: CandidateKnowledge, evidenceProvider: EvidenceProvider): Promise<ValidationResult> {
  for (const evidenceId of knowledge.evidence) {
    const evidence = await evidenceProvider.get(evidenceId);
    
    if (!evidence) {
      return { 
        valid: false, 
        reason: `Evidence not found: ${evidenceId}` 
      };
    }
    
    // Evidence must be recent (configurable window)
    const age = Date.now() - evidence.timestamp.getTime();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    
    if (age > maxAge) {
      return {
        valid: false,
        reason: `Evidence too old: ${evidenceId}`
      };
    }
  }
  
  return { valid: true };
}
```

#### Rule 3: Conflict Detection

**Check:** Knowledge doesn't contradict existing

```typescript
async function detectConflicts(knowledge: CandidateKnowledge, graph: KnowledgeProvider): Promise<ConflictResult> {
  const conflicts: Conflict[] = [];
  
  // Check for contradictory decisions
  if (knowledge.type === 'architectural_decision') {
    const existing = await graph.query({
      type: 'architectural_decision',
      repository: knowledge.repository,
      title: knowledge.title,
      status: 'accepted'
    });
    
    if (existing.length > 0) {
      conflicts.push({
        type: 'contradictory_decision',
        existing: existing[0].id,
        new: knowledge.id,
        resolution: 'requires_review'
      });
    }
  }
  
  // Check for entity conflicts
  if (knowledge.type === 'entity') {
    const existing = await graph.query({
      type: 'entity',
      name: knowledge.name,
      repository: knowledge.repository
    });
    
    if (existing.length > 0 && existing[0].location !== knowledge.location) {
      conflicts.push({
        type: 'entity_moved',
        existing: existing[0].id,
        new: knowledge.id,
        resolution: 'update_or_supersede'
      });
    }
  }
  
  return { hasConflicts: conflicts.length > 0, conflicts };
}
```

#### Rule 4: Duplicate Detection

**Check:** Knowledge not already stored

```typescript
async function detectDuplicates(knowledge: CandidateKnowledge, graph: KnowledgeProvider): Promise<DuplicateResult> {
  // Compute content hash
  const contentHash = hash(JSON.stringify({
    type: knowledge.type,
    repository: knowledge.repository,
    content: knowledge.content
  }));
  
  // Query by hash
  const existing = await graph.query({
    contentHash,
    type: knowledge.type
  });
  
  if (existing.length > 0) {
    return {
      isDuplicate: true,
      existingId: existing[0].id,
      similarity: 1.0
    };
  }
  
  // Semantic similarity check (slower)
  const similar = await graph.semanticSearch(knowledge.content, 5);
  const topSimilar = similar[0];
  
  if (topSimilar && topSimilar.score > 0.95) {
    return {
      isDuplicate: true,
      existingId: topSimilar.id,
      similarity: topSimilar.score
    };
  }
  
  return { isDuplicate: false };
}
```

#### Rule 5: Admission Policy Scoring

**Check:** Knowledge is important enough

```typescript
interface AdmissionScore {
  importance: number;    // 0-1
  novelty: number;       // 0-1
  confidence: number;    // 0-1
  persistence: number;  // 0-1
  relevance: number;     // 0-1
  final: number;         // Weighted average
}

async function scoreKnowledge(knowledge: CandidateKnowledge): Promise<AdmissionScore> {
  // Importance: How critical is this knowledge?
  const importance = await scoreImportance(knowledge);
  
  // Novelty: Is this new information?
  const novelty = await scoreNovelty(knowledge);
  
  // Confidence: How certain is this knowledge?
  const confidence = await scoreConfidence(knowledge);
  
  // Persistence: How long will this remain valid?
  const persistence = await scorePersistence(knowledge);
  
  // Relevance: How relevant to current repository context?
  const relevance = await scoreRelevance(knowledge);
  
  // Weighted average (configurable weights)
  const final = 
    0.3 * importance +
    0.2 * novelty +
    0.2 * confidence +
    0.2 * persistence +
    0.1 * relevance;
  
  return { importance, novelty, confidence, persistence, relevance, final };
}
```

#### Scoring Details

**Importance Score (0-1):**

```typescript
async function scoreImportance(knowledge: CandidateKnowledge): Promise<number> {
  switch (knowledge.type) {
    case 'architectural_decision':
      return 0.95; // Decisions are critical
    
    case 'failure_pattern':
      return 0.90; // Failures teach lessons
    
    case 'successful_fix':
      return 0.85; // Successful patterns valuable
    
    case 'repository_knowledge':
      return 0.80; // Structural knowledge important
    
    case 'dependency':
      return 0.70; // Dependencies moderately important
    
    case 'entity':
      return 0.60; // Entities are reference points
    
    case 'coding_convention':
      return 0.50; // Conventions somewhat important
    
    case 'preference':
      return 0.40; // Preferences lower priority
    
    default:
      return 0.5;
  }
}
```

**Novelty Score (0-1):**

```typescript
async function scoreNovelty(knowledge: CandidateKnowledge): Promise<number> {
  // Check how different from existing knowledge
  const existing = await graph.semanticSearch(knowledge.content, 10);
  
  if (existing.length === 0) {
    return 1.0; // Completely new
  }
  
  // Average similarity to top 10 existing
  const avgSimilarity = existing.reduce((sum, e) => sum + e.score, 0) / existing.length;
  
  // Novelty = 1 - similarity
  return 1 - avgSimilarity;
}
```

**Confidence Score (0-1):**

```typescript
async function scoreConfidence(knowledge: CandidateKnowledge): Promise<number> {
  // Based on evidence quality and quantity
  const evidenceCount = knowledge.evidence.length;
  
  // More evidence = higher confidence
  const countScore = Math.min(evidenceCount / 5, 1.0);
  
  // Check evidence sources
  const sources = await Promise.all(
    knowledge.evidence.map(id => evidenceProvider.get(id))
  );
  
  // Source diversity score
  const uniqueSources = new Set(sources.map(e => e.type));
  const diversityScore = uniqueSources.size / 8; // 8 possible sources
  
  // Weighted combination
  return 0.6 * countScore + 0.4 * diversityScore;
}
```

**Persistence Score (0-1):**

```typescript
async function scorePersistence(knowledge: CandidateKnowledge): Promise<number> {
  switch (knowledge.type) {
    case 'architectural_decision':
      return 0.95; // Decisions last years
    
    case 'coding_convention':
      return 0.90; // Conventions stable
    
    case 'repository_knowledge':
      return 0.85; // Structure changes slowly
    
    case 'dependency':
      return 0.70; // Dependencies update periodically
    
    case 'entity':
      return 0.80; // Entities evolve
    
    case 'preference':
      return 0.60; // Preferences can change
    
    case 'successful_fix':
      return 0.75; // Fixes remain valid until code changes
    
    case 'failure_pattern':
      return 0.70; // Failures may repeat
    
    default:
      return 0.5;
  }
}
```

**Relevance Score (0-1):**

```typescript
async function scoreRelevance(knowledge: CandidateKnowledge): Promise<number> {
  if (!knowledge.repository) {
    return 0.3; // Global knowledge less relevant
  }
  
  // Check if repository is currently active
  const recentActivity = await gitService.getRecentActivity(knowledge.repository);
  
  if (recentActivity.within(7, 'days')) {
    return 1.0;
  } else if (recentActivity.within(30, 'days')) {
    return 0.8;
  } else if (recentActivity.within(90, 'days')) {
    return 0.6;
  } else {
    return 0.4;
  }
}
```

### Admission Decision

```typescript
interface AdmissionDecision {
  decision: 'accepted' | 'deferred' | 'rejected';
  reason: string;
  score: AdmissionScore;
}

async function decideAdmission(knowledge: CandidateKnowledge): Promise<AdmissionDecision> {
  const score = await scoreKnowledge(knowledge);
  
  // Thresholds (configurable)
  const ACCEPT_THRESHOLD = 0.65;
  const DEFER_THRESHOLD = 0.45;
  
  if (score.final >= ACCEPT_THRESHOLD) {
    return { decision: 'accepted', reason: 'Score exceeds threshold', score };
  } else if (score.final >= DEFER_THRESHOLD) {
    return { decision: 'deferred', reason: 'Score insufficient, review later', score };
  } else {
    return { decision: 'rejected', reason: 'Score below minimum', score };
  }
}
```

### Verification Steps

```typescript
// Test: Bad knowledge rejected
describe('Knowledge Validation', () => {
  it('rejects knowledge without evidence', async () => {
    const knowledge = createKnowledge({ evidence: [] });
    const result = await validationService.validate(knowledge);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('evidence');
  });
  
  it('rejects knowledge with fake evidence', async () => {
    const knowledge = createKnowledge({ evidence: ['fake_id'] });
    const result = await validationService.validate(knowledge);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('not found');
  });
  
  it('detects conflicting decisions', async () => {
    const existing = createDecision({ title: 'Use Redis', status: 'accepted' });
    await store(existing);
    
    const newDecision = createDecision({ title: 'Use Redis', decision: 'Use Memcached' });
    const conflicts = await validationService.detectConflicts(newDecision);
    
    expect(conflicts.hasConflicts).toBe(true);
  });
  
  it('detects duplicates', async () => {
    const existing = createKnowledge({ content: 'Test content' });
    await store(existing);
    
    const duplicate = createKnowledge({ content: 'Test content' });
    const result = await validationService.detectDuplicates(duplicate);
    
    expect(result.isDuplicate).toBe(true);
  });
  
  it('scores knowledge correctly', async () => {
    const decision = createDecision();
    const score = await validationService.scoreKnowledge(decision);
    
    expect(score.importance).toBeGreaterThan(0.9); // Decisions important
    expect(score.persistence).toBeGreaterThan(0.9); // Decisions persist
    expect(score.final).toBeGreaterThan(0.65); // Should be accepted
  });
});
```

---

## Phase 4: Knowledge Store

### Design Goal

Persist validated knowledge in Graphiti with proper graph structure.

### Graph Schema

#### Node Types

**1. Knowledge Nodes**

```cypher
(:ArchitecturalDecision {
  id: UUID,
  title: String,
  context: String,
  decision: String,
  status: String, // 'proposed' | 'accepted' | 'deprecated' | 'superseded'
  repository: String,
  timestamp: DateTime,
  contentHash: String,
  confidence: Float,
  version: Integer,
  created: DateTime,
  updated: DateTime
})

(:RepositoryKnowledge {
  id: UUID,
  repository: String,
  category: String,
  name: String,
  path: String,
  description: String,
  technology: [String],
  timestamp: DateTime,
  contentHash: String,
  version: Integer
})

(:FailurePattern {
  id: UUID,
  repository: String,
  category: String,
  pattern: String,
  symptoms: [String],
  rootCause: String,
  frequency: Integer,
  lastOccurrence: DateTime,
  affectedFiles: [String],
  timestamp: DateTime,
  contentHash: String
})

(:SuccessfulFix {
  id: UUID,
  repository: String,
  problem: String,
  solution: String,
  approach: String,
  affectedFiles: [String],
  testValidation: Boolean,
  timestamp: DateTime,
  contentHash: String
})

(:Dependency {
  id: UUID,
  repository: String,
  name: String,
  version: String,
  type: String,
  purpose: String,
  license: String,
  timestamp: DateTime,
  contentHash: String
})

(:Entity {
  id: UUID,
  repository: String,
  name: String,
  kind: String,
  file: String,
  line: Integer,
  description: String,
  deprecated: Boolean,
  timestamp: DateTime,
  contentHash: String
})

(:Preference {
  id: UUID,
  repository: String,
  category: String,
  key: String,
  value: Any,
  confidence: Float,
  frequency: Integer,
  source: String,
  timestamp: DateTime,
  contentHash: String
})

(:CodingConvention {
  id: UUID,
  repository: String,
  category: String,
  rule: String,
  examples: [String],
  exceptions: [String],
  tool: String,
  timestamp: DateTime,
  contentHash: String
})
```

**2. Evidence Nodes**

```cypher
(:Evidence {
  id: UUID,
  type: String,
  repository: String,
  content: String,
  contentHash: String,
  timestamp: DateTime,
  provenance: Map
})
```

**3. Repository Context Nodes**

```cypher
(:Repository {
  name: String,
  path: String,
  url: String,
  lastActivity: DateTime,
  activeBranch: String
})

(:Branch {
  name: String,
  repository: String,
  lastCommit: String,
  timestamp: DateTime
})

(:Session {
  id: UUID,
  repository: String,
  branch: String,
  user: String,
  started: DateTime,
  ended: DateTime,
  status: String
})
```

#### Relationship Types

**1. Evidence Relationships**

```cypher
(:Knowledge)-[:SUPPORTED_BY {
  confidence: Float
}]->(:Evidence)

(:Evidence)-[:DERIVED_FROM {
  source: String
}]->(:Knowledge)
```

**Why:** Every knowledge must be traceable to evidence. This prevents hallucination.

**2. Knowledge Relationships**

```cypher
(:ArchitecturalDecision)-[:AFFECTS {
  scope: String
}]->(:Entity)

(:Entity)-[:DEPENDS_ON {
  type: String,
  version: String
}]->(:Dependency)

(:Entity)-[:CALLS]->(:Entity)

(:Entity)-[:INHERITS_FROM]->(:Entity)

(:SuccessfulFix)-[:FIXES]->(:FailurePattern)

(:FailurePattern)-[:OCCURS_IN {
  frequency: Integer
}]->(:Entity)

(:Knowledge)-[:RELATES_TO {
  strength: Float
}]->(:Knowledge)

(:Knowledge)-[:CONTRADICTS {
  reason: String
}]->(:Knowledge)

(:ArchitecturalDecision)-[:SUPERSEDES]->(:ArchitecturalDecision)

(:Knowledge)-[:DERIVED_FROM]->(:Knowledge)
```

**Why:** Knowledge graph traversals enable context expansion.

**3. Repository Context Relationships**

```cypher
(:Knowledge)-[:BELONGS_TO]->(:Repository)

(:Repository)-[:HAS_BRANCH]->(:Branch)

(:Session)-[:WORKS_ON]->(:Branch)

(:Session)-[:GENERATED]->(:Evidence)

(:Knowledge)-[:CREATED_IN]->(:Session)
```

**Why:** Multi-tenant isolation and session context.

**4. Temporal Relationships**

```cypher
(:Knowledge)-[:FOLLOWS]->(:Knowledge) // Only if temporal order matters

(:Knowledge)-[:VERSION_OF {
  version: Integer
}]->(:Knowledge)
```

**Why:** Knowledge evolution tracking.

#### Indexes

```cypher
// Performance indexes
CREATE INDEX knowledge_id IF NOT EXISTS FOR (n:Knowledge) ON (n.id);
CREATE INDEX knowledge_type IF NOT EXISTS FOR (n:Knowledge) ON (n.type);
CREATE INDEX knowledge_repo IF NOT EXISTS FOR (n:Knowledge) ON (n.repository);
CREATE INDEX knowledge_hash IF NOT EXISTS FOR (n:Knowledge) ON (n.contentHash);
CREATE INDEX knowledge_timestamp IF NOT EXISTS FOR (n:Knowledge) ON (n.timestamp);

CREATE INDEX evidence_id IF NOT EXISTS FOR (e:Evidence) ON (e.id);
CREATE INDEX evidence_type IF NOT EXISTS FOR (e:Evidence) ON (e.type);
CREATE INDEX evidence_hash IF NOT EXISTS FOR (e:Evidence) ON (e.contentHash);

CREATE INDEX repository_name IF NOT EXISTS FOR (r:Repository) ON (r.name);

// Full-text search indexes
CREATE FULLTEXT INDEX knowledge_text IF NOT EXISTS FOR (n:Knowledge) ON EACH [n.content, n.title, n.description];

// Constraint indexes
CREATE CONSTRAINT knowledge_unique_hash IF NOT EXISTS FOR (n:Knowledge) REQUIRE n.contentHash IS UNIQUE;
CREATE CONSTRAINT evidence_unique_hash IF NOT EXISTS FOR (e:Evidence) REQUIRE e.contentHash IS UNIQUE;
```

### Knowledge Provider Implementation

```typescript
// src/adapters/graphiti-provider.ts

class GraphitiKnowledgeProvider implements KnowledgeProvider {
  constructor(
    private driver: Driver,
    private logger: Logger
  ) {}
  
  async store(knowledge: ValidatedKnowledge): Promise<KnowledgeId> {
    const session = this.driver.session();
    
    try {
      // Create knowledge node
      const result = await session.run(
        `
        CREATE (k:${knowledge.type} {
          id: randomUUID(),
          content: $content,
          repository: $repository,
          timestamp: datetime(),
          contentHash: $contentHash,
          confidence: $confidence,
          version: 1
        })
        RETURN k.id as id
        `,
        knowledge
      );
      
      const knowledgeId = result.records[0].get('id');
      
      // Link to evidence
      for (const evidenceId of knowledge.evidence) {
        await session.run(
          `
          MATCH (k:Knowledge {id: $knowledgeId})
          MATCH (e:Evidence {id: $evidenceId})
          CREATE (k)-[:SUPPORTED_BY {confidence: 1.0}]->(e)
          `,
          { knowledgeId, evidenceId }
        );
      }
      
      // Link to repository
      await session.run(
        `
        MATCH (k:Knowledge {id: $knowledgeId})
        MERGE (r:Repository {name: $repository})
        CREATE (k)-[:BELONGS_TO]->(r)
        `,
        { knowledgeId, repository: knowledge.repository }
      );
      
      return knowledgeId;
    } finally {
      await session.close();
    }
  }
  
  async retrieve(query: KnowledgeQuery): Promise<KnowledgeResult> {
    const session = this.driver.session();
    
    try {
      let cypher = '';
      const params: any = {};
      
      if (query.text) {
        // Full-text search
        cypher = `
          CALL db.index.fulltext.queryNodes('knowledge_text', $text)
          YIELD node, score
          WHERE node.repository = $repository
          RETURN node, score
          ORDER BY score DESC
          LIMIT $limit
        `;
        params = { text: query.text, repository: query.repository, limit: query.limit || 10 };
      } else {
        // Type-based query
        cypher = `
          MATCH (k:${query.type})
          WHERE k.repository = $repository
          RETURN k
          ORDER BY k.timestamp DESC
          LIMIT $limit
        `;
        params = { repository: query.repository, limit: query.limit || 10 };
      }
      
      const result = await session.run(cypher, params);
      
      const knowledge = result.records.map(r => r.get('node').properties);
      
      return { knowledge, total: knowledge.length };
    } finally {
      await session.close();
    }
  }
  
  async queryGraph(pattern: GraphPattern): Promise<GraphResult> {
    const session = this.driver.session();
    
    try {
      const cypher = `
        MATCH path = ${pattern.query}
        RETURN path
        LIMIT $limit
      `;
      
      const result = await session.run(cypher, { limit: pattern.limit || 10 });
      
      const paths = result.records.map(r => r.get('path'));
      
      return { paths, nodes: [], edges: [] };
    } finally {
      await session.close();
    }
  }
}
```

### Verification

```typescript
// Test: Store and retrieve correctly
describe('Knowledge Store', () => {
  it('stores knowledge with evidence links', async () => {
    const evidence = await storeEvidence();
    const knowledge = createKnowledge({ evidence: [evidence.id] });
    
    const id = await provider.store(knowledge);
    const retrieved = await provider.retrieve({ id });
    
    expect(retrieved.evidence).toContain(evidence.id);
  });
  
  it('rejects knowledge without evidence', async () => {
    const knowledge = createKnowledge({ evidence: [] });
    
    await expect(provider.store(knowledge)).rejects.toThrow('evidence');
  });
  
  it('queries by repository', async () => {
    const k1 = await storeKnowledge({ repository: 'repo1' });
    const k2 = await storeKnowledge({ repository: 'repo2' });
    
    const result = await provider.retrieve({ repository: 'repo1' });
    
    expect(result.knowledge).toContainEqual(k1);
    expect(result.knowledge).not.toContainEqual(k2);
  });
  
  it('prevents duplicates', async () => {
    const content = hash('test content');
    await storeKnowledge({ contentHash: content });
    
    await expect(
      storeKnowledge({ contentHash: content })
    ).rejects.toThrow('unique');
  });
});

// Test: Integrity checks
describe('Graph Integrity', () => {
  it('has no dangling edges', async () => {
    const result = await session.run(`
      MATCH ()-[r]->()
      WHERE NOT (startNode(r) EXISTS AND endNode(r) EXISTS)
      RETURN r
    `);
    
    expect(result.records.length).toBe(0);
  });
  
  it('has no orphan evidence', async () => {
    const result = await session.run(`
      MATCH (e:Evidence)
      WHERE NOT (e)<-[:SUPPORTED_BY]-()
      RETURN e
    `);
    
    expect(result.records.length).toBe(0);
  });
  
  it('has no broken references', async () => {
    const result = await session.run(`
      MATCH (k:Knowledge)
      UNWIND k.evidence as evidenceId
      WHERE NOT (e:Evidence {id: evidenceId})
      RETURN k
    `);
    
    expect(result.records.length).toBe(0);
  });
});
```

---

## Phase 5: Retrieval Engine

### Design Goal

Retrieve the **smallest useful knowledge set** in < 300ms.

### Retrieval Query Types

```typescript
interface RetrievalQuery {
  type: 'semantic' | 'graph' | 'entity' | 'hybrid' | 'contextual';
  repository: string;
  branch?: string;
  session?: string;
  text?: string;
  entities?: string[];
  knowledgeTypes?: string[];
  maxTokens?: number;
  minConfidence?: number;
  timeRange?: TimeRange;
  expandGraph?: boolean;
}
```

### Retrieval Strategy

#### Strategy 1: Semantic Search

**When:** User asks a question, agent needs context

**Implementation:**
```typescript
async function semanticSearch(query: string, repository: string, k: number = 10): Promise<ScoredResult[]> {
  // Use Neo4j full-text search or vector index
  const results = await session.run(`
    CALL db.index.fulltext.queryNodes('knowledge_text', $query)
    YIELD node, score
    WHERE node.repository = $repository
    AND node.confidence >= 0.5
    RETURN node, score
    ORDER BY score DESC
    LIMIT $k
  `, { query, repository, k });
  
  return results.records.map(r => ({
    knowledge: r.get('node').properties,
    score: r.get('score')
  }));
}
```

#### Strategy 2: Graph Traversal

**When:** Understanding dependencies, impact analysis

**Implementation:**
```typescript
async function graphTraversal(startNode: string, depth: number = 2): Promise<GraphNode[]> {
  const results = await session.run(`
    MATCH path = (start:Entity {id: $startNode})-[:DEPENDS_ON|CALLS|INHERITS_FROM*1..${depth}]-(related)
    RETURN start, related, path
  `, { startNode });
  
  // Traverse from entity to related knowledge
  const nodes: GraphNode[] = [];
  for (const record of results.records) {
    const related = record.get('related').properties;
    const path = record.get('path');
    
    nodes.push({
      node: related,
      distance: path.length,
      relationship: path.relationships[0].type
    });
  }
  
  return nodes;
}
```

#### Strategy 3: Entity Lookup

**When:** Finding specific modules/functions

**Implementation:**
```typescript
async function entityLookup(entityName: string, repository: string): Promise<EntityResult> {
  const results = await session.run(`
    MATCH (e:Entity)
    WHERE e.name CONTAINS $entityName
    AND e.repository = $repository
    OPTIONAL MATCH (e)-[r]-(related)
    RETURN e, collect(related) as related
  `, { entityName, repository });
  
  return results.records.map(r => ({
    entity: r.get('e').properties,
    related: r.get('related')
  }));
}
```

#### Strategy 4: Hybrid Retrieval

**When:** Best results from multiple strategies

**Implementation:**
```typescript
async function hybridRetrieval(query: RetrievalQuery): Promise<RankedResult[]> {
  const results = new Map<string, RankedResult>();
  
  // Parallel retrieval
  const [semantic, graphTraversal, entities] = await Promise.all([
    this.semanticSearch(query.text, query.repository, 10),
    this.graphTraversal(query.startNode, query.depth),
    this.entityLookup(query.entity, query.repository)
  ]);
  
  // Merge and deduplicate
  for (const result of [...semantic, ...graphTraversal, ...entities]) {
    const id = result.knowledge.id;
    
    if (!results.has(id)) {
      results.set(id, {
        knowledge: result.knowledge,
        score: result.score,
        sources: [result.source],
        rank: 0
      });
    } else {
      // Boost score if found by multiple strategies
      const existing = results.get(id)!;
      existing.score += result.score;
      existing.sources.push(result.source);
    }
  }
  
  // Rank results
  return this.rankResults(Array.from(results.values()), query);
}
```

### Ranking Algorithm

**Score Components:**
```typescript
interface RelevanceScore {
  semantic: number;        // 0-1: How well text matches
  graphDistance: number;   // 0-1: How close in graph
  recency: number;         // 0-1: How recent
  importance: number;      // 0-1: Knowledge importance
  confidence: number;      // 0-1: Confidence level
  repositoryMatch: number; // 0-1: Same repository
  usageCount: number;      // 0-1: How often retrieved before
  final: number;           // Weighted combination
}

function computeFinalScore(scores: RelevanceScore): number {
  const weights = {
    semantic: 0.25,
    graphDistance: 0.15,
    recency: 0.10,
    importance: 0.20,
    confidence: 0.15,
    repositoryMatch: 0.10,
    usageCount: 0.05
  };
  
  return (
    weights.semantic * scores.semantic +
    weights.graphDistance * (1 - scores.graphDistance * 0.1) + // Closer = higher
    weights.recency * scores.recency +
    weights.importance * scores.importance +
    weights.confidence * scores.confidence +
    weights.repositoryMatch * scores.repositoryMatch +
    weights.usageCount * scores.usageCount
  );
}
```

### Retrieval Pipeline

```
Query Input
    ↓
┌────────────────────┐
│ Query Parsing      │
│ - Extract entities │
│ - Extract intent   │
│ - Parse time range │
└────────────────────┘
    ↓
┌────────────────────┐
│ Strategy Selection │
│ - Semantic?        │
│ - Graph?           │
│ - Entity?          │
│ - Hybrid?          │
└────────────────────┘
    ↓
┌────────────────────┐
│ Parallel Retrieval │
│ - Semantic search  │
│ - Graph traversal  │
│ - Entity lookup    │
│ - Recent memories  │
└────────────────────┘
    ↓
┌────────────────────┐
│ Merge & Dedupe     │
│ - Combine results  │
│ - Remove duplicates│
│ - Boost multi-hit  │
└────────────────────┘
    ↓
┌────────────────────┐
│ Ranking            │
│ - Relevance score  │
│ - Importance score │
│ - Usage score      │
└────────────────────┘
    ↓
┌────────────────────┐
│ Token Budgeting    │
│ - Limit tokens     │
│ - Keep most useful │
└────────────────────┘
    ↓
Ranked Results
```

### Performance Targets

```typescript
interface RetrievalMetrics {
  p50Latency: number;  // Target: < 100ms
  p95Latency: number;  // Target: < 300ms
  p99Latency: number;  // Target: < 500ms
  
  recall: number;      // Target: > 90%
  precision: number;   // Target: > 85%
  
  cacheHitRate: number;  // Target: > 40%
  indexUsage: number;    // Target: > 95%
}
```

### Caching Layer

**Why:** Reduce latency for common queries

```typescript
class RetrievalCache {
  private cache: LRUCache<string, CachedResult>;
  
  async get(query: RetrievalQuery): Promise<RankedResult[] | null> {
    const key = this.hashQuery(query);
    const cached = this.cache.get(key);
    
    if (cached && !this.isStale(cached)) {
      return cached.results;
    }
    
    return null;
  }
  
  async set(query: RetrievalQuery, results: RankedResult[]): Promise<void> {
    const key = this.hashQuery(query);
    this.cache.set(key, {
      results,
      timestamp: Date.now(),
      ttl: 5 * 60 * 1000 // 5 minutes
    });
  }
  
  private isStale(cached: CachedResult): boolean {
    return Date.now() - cached.timestamp > cached.ttl;
  }
}
```

---

## Phase 6: Reasoning Layer

### Design Goal

Turn retrieved knowledge into **actionable context** with evidence.

### Reasoning Types

#### 1. Explanation Reasoning

**Input:** "How does authentication work?"

**Process:**
```typescript
async function explainAuthentication(repository: string): Promise<Explanation> {
  // Retrieve knowledge
  const authKnowledge = await retrievalService.retrieve({
    repository,
    text: 'authentication',
    knowledgeTypes: ['architectural_decision', 'repository_knowledge', 'entity']
  });
  
  // Build explanation
  return {
    summary: 'Authentication uses JWT with refresh tokens',
    evidence: authKnowledge.map(k => k.evidence),
    components: [
      {
        name: 'auth/middleware.ts',
        role: 'JWT validation middleware',
        evidence: ['ev_123']
      },
      {
        name: 'auth/service.ts',
        role: 'Token generation logic',
        evidence: ['ev_456']
      }
    ],
    risks: [
      'Changing middleware breaks refresh tokens',
      'Redis dependency for token blacklist'
    ],
    confidence: 0.92
  };
}
```

#### 2. Dependency Reasoning

**Input:** "What depends on Redis?"

**Process:**
```typescript
async function findDependencies(entity: string, repository: string): Promise<DependencyGraph> {
  // Graph traversal from entity
  const graph = await retrievalService.graphTraversal(entity, repository);
  
  return {
    root: entity,
    dependencies: graph.filter(n => n.relationship === 'DEPENDS_ON'),
    dependents: graph.filter(n => n.relationship === 'DEPENDS_ON' && n.direction === 'incoming'),
    impactAnalysis: [
      'If Redis changes, affects: session storage, rate limiting, cache',
      'Critical path: authentication → Redis → session'
    ]
  };
}
```

#### 3. Decision Reasoning

**Input:** "Why did we choose Redis?"

**Process:**
```typescript
async function explainDecision(title: string, repository: string): Promise<DecisionExplanation> {
  const decision = await retrievalService.retrieve({
    repository,
    text: title,
    knowledgeTypes: ['architectural_decision']
  });
  
  return {
    decision: decision.title,
    reason: decision.decision,
    alternatives: decision.alternatives,
    evidence: decision.evidence,
    consequences: decision.consequences,
    currentStatus: decision.status,
    relatedDecisions: await findRelatedDecisions(decision.id)
  };
}
```

#### 4. Failure Analysis

**Input:** "Why is this failing?"

**Process:**
```typescript
async function analyzeFailure(error: Error, repository: string): Promise<FailureAnalysis> {
  // Find similar failures
  const patterns = await retrievalService.retrieve({
    repository,
    text: error.message,
    knowledgeTypes: ['failure_pattern']
  });
  
  // Find successful fixes
  const fixes = await retrievalService.retrieve({
    repository,
    text: patterns.map(p => p.problem).join(' '),
    knowledgeTypes: ['successful_fix']
  });
  
  return {
    error: error.message,
    similarFailures: patterns,
    possibleFixes: fixes.map(f => ({
      approach: f.approach,
      solution: f.solution,
      files: f.affectedFiles,
      evidence: f.evidence,
      successRate: await calculateSuccessRate(f.id)
    })),
    recommendation: fixes.length > 0 ? fixes[0].solution : 'No known fix'
  };
}
```

### Context Assembly

```typescript
interface ReasoningContext {
  repository: string;
  task: string;
  relevantKnowledge: Knowledge[];
  explanations: Explanation[];
  risks: Risk[];
  recommendations: Recommendation[];
  
  // Evidence backing
  evidence: Evidence[];
  
  // Confidence
  overallConfidence: number;
}

async function buildReasoningContext(task: string, repository: string): Promise<ReasoningContext> {
  // Step 1: Retrieve relevant knowledge
  const knowledge = await retrievalService.hybridRetrieval({
    text: task,
    repository,
    maxTokens: 2000
  });
  
  // Step 2: Build explanations
  const explanations = await reasoningService.explain(knowledge);
  
  // Step 3: Identify risks
  const risks = await reasoningService.assessRisks(knowledge);
  
  // Step 4: Generate recommendations
  const recommendations = await reasoningService.recommend(task, knowledge);
  
  // Step 5: Collect evidence
  const evidenceIds = new Set<string>();
  knowledge.forEach(k => k.evidence.forEach(e => evidenceIds.add(e)));
  const evidence = await evidenceProvider.getAll(Array.from(evidenceIds));
  
  return {
    repository,
    task,
    relevantKnowledge: knowledge,
    explanations,
    risks,
    recommendations,
    evidence,
    overallConfidence: computeConfidence(knowledge)
  };
}
```

---

## Phase 7: Context Builder

### Design Goal

Inject **only useful knowledge** within token budget.

### Token Budget Strategy

```typescript
interface TokenBudget {
  maxTokens: number;        // Total budget
  systemContext: number;    // Memory context
  taskContext: number;      // Current task
  historyContext: number;   // Conversation history
  response: number;         // Response space
}

const DEFAULT_BUDGET: TokenBudget = {
  maxTokens: 100000,        // Claude's limit
  systemContext: 5000,      // Memory system prompt
  taskContext: 10000,       // Retrieved knowledge
  historyContext: 20000,    // Recent conversation
  response: 65000           // Agent response
};
```

### Compression Pipeline

```
Raw Knowledge (10,000+ tokens)
        ↓
┌──────────────────┐
│ Deduplicate      │
│ - Remove exact   │
│   duplicates     │
│ - Merge similar  │
└──────────────────┘
        ↓
┌──────────────────┐
│ Prioritize       │
│ - Rank by score  │
│ - Keep top N     │
└──────────────────┘
        ↓
┌──────────────────┐
│ Compress         │
│ - Summarize      │
│ - Extract facts  │
│ - Remove fluff   │
└──────────────────┘
        ↓
┌──────────────────┐
│ Format           │
│ - Structured     │
│ - Itemized       │
│ - Labeled        │
└──────────────────┘
        ↓
Compressed Context (< 10,000 tokens)
```

### Context Formatting

**Example Output:**

```markdown
## Memory Context

### Architecture (3 items)
- authentication: JWT-based with refresh tokens [confidence: 0.95]
  - Decision ADR-4: Use Redis for session storage
  - Files: src/auth/{middleware,service}.ts
  - Risk: Changing middleware breaks refresh tokens
  
- database: PostgreSQL with connection pooling [confidence: 0.90]
  - Config: DATABASE_POOL_SIZE=10
  - Migrations in migrations/

- caching: Redis for rate limiting + session [confidence: 0.88]
  - Dependency: redis ^4.0.0

### Recent Failures (2 patterns)
- Build failing on TypeScript strict mode
  - Fix: Add proper type annotations in src/utils/
  - Evidence: test_run_123
  - Success rate: 95%

- Test timeouts in integration tests
  - Fix: Increase timeout to 30s for external APIs
  - Evidence: test_run_456

### Conventions (5 rules)
- Use camelCase for variables
- Use PascalCase for classes
- Prefer async/await over Promises
- Log errors with structured logger
- All functions need JSDoc comments

### Dependencies (top 10)
- express: ^4.18.0 (web framework)
- neo4j-driver: ^5.0.0 (graph database)
- redis: ^4.0.0 (caching)
- typescript: ^5.0.0 (language)
...

### Entities (relevant to task)
- UserService (src/services/user.service.ts:15)
  - Handles user CRUD operations
  - Depends on: Database, Logger
  - Used by: AuthController, UserController

### Evidence (12 sources)
- git_diff_abc123: Authentication refactor commit
- test_run_456: Integration test results
- build_log_789: TypeScript compilation
...
```

**Token Savings:**
- Raw knowledge: ~15,000 tokens
- Compressed context: ~3,000 tokens
- **Savings: 80%**

---

## Phase 8: Feedback Layer

### Design Goal

Learn what knowledge actually helps.

### Feedback Collection

```typescript
interface MemoryUsage {
  knowledgeId: string;
  retrieved: boolean;
  usedInResponse: boolean;  // Did agent reference it?
  helpful: boolean | null;   // User feedback
  overridden: boolean;        // Did agent ignore it?
  taskOutcome: 'success' | 'failure' | 'partial';
  timestamp: Date;
}

class FeedbackCollector {
  async trackUsage(knowledge: RankedResult, agentResponse: string): Promise<void> {
    // Check if knowledge appears in response
    const used = this.knowledgeUsedInResponse(knowledge, agentResponse);
    
    await db.insert('memory_usage', {
      knowledgeId: knowledge.knowledge.id,
      retrieved: true,
      usedInResponse: used,
      timestamp: Date.now()
    });
  }
  
  private knowledgeUsedInResponse(knowledge: RankedResult, response: string): boolean {
    // NLP check if agent referenced knowledge content
    return response.includes(knowledge.knowledge.content.slice(0, 50)) ||
           this.semanticMatch(knowledge.knowledge.content, response);
  }
}
```

### Learning from Feedback

```typescript
class FeedbackLearner {
  async updateScores(): Promise<void> {
    // Get usage stats for last N days
    const stats = await db.query(`
      SELECT 
        knowledgeId,
        COUNT(*) as total,
        SUM(CASE WHEN usedInResponse THEN 1 ELSE 0 END) as used,
        SUM(CASE WHEN helpful = true THEN 1 ELSE 0 END) as helpful
      FROM memory_usage
      WHERE timestamp > NOW() - INTERVAL '30 days'
      GROUP BY knowledgeId
    `);
    
    for (const stat of stats) {
      // Update usage count
      const usageScore = stat.used / stat.total;
      
      // Update helpfulness score
      const helpfulScore = stat.helpful / stat.used;
      
      // Store in knowledge metadata
      await graphitiClient.updateKnowledge(stat.knowledgeId, {
        usageCount: usageScore,
        helpfulness: helpfulScore
      });
    }
  }
}
```

---

## Phase 9: Lifecycle Management

### Knowledge States

```
┌───────────┐
│ Candidate │ ← Extracted, not validated
└─────┬─────┘
      │ Admission
      ↓
┌───────────┐
│  Verified  │ ← Validated, evidence-backed
└─────┬─────┘
      │ Time passes
      ↓
┌───────────┐
│   Active  │ ← Currently relevant
└─────┬─────┘
      │ Contradiction or update
      ↓
┌────────────┐
│ Superseded │ ← Replaced by newer
└─────┬──────┘
      │ No longer relevant
      ↓
┌───────────┐
│  Archived │ ← Historical record
└─────┬─────┘
      │ Data retention policy
      ↓
┌───────────┐
│  Deleted  │ ← Removed
└───────────┘
```

### State Transitions

```typescript
class KnowledgeLifecycle {
  async supersede(oldId: string, newId: string, reason: string): Promise<void> {
    // Mark old as superseded
    await session.run(`
      MATCH (old:Knowledge {id: $oldId})
      MATCH (new:Knowledge {id: $newId})
      SET old.status = 'superseded',
          old.supersededBy = $newId,
          old.supersededAt = datetime(),
          old.supersededReason = $reason
      CREATE (new)-[:SUPERSEDES]->(old)
    `, { oldId, newId, reason });
  }
  
  async archive(id: string): Promise<void> {
    await session.run(`
      MATCH (k:Knowledge {id: $id})
      SET k.status = 'archived',
          k.archivedAt = datetime()
    `, { id });
  }
  
  async prune(olderThan: Date): Promise<number> {
    // Delete archived knowledge older than threshold
    const result = await session.run(`
      MATCH (k:Knowledge)
      WHERE k.status = 'archived'
      AND k.archivedAt < datetime($threshold)
      DETACH DELETE k
      RETURN count(k) as deleted
    `, { threshold: olderThan.toISOString() });
    
    return result.records[0].get('deleted').toNumber();
  }
}
```

---

## Phase 10: Observability

### Metrics Dashboard

```typescript
interface MemoryMetrics {
  // Knowledge metrics
  totalKnowledge: number;
  knowledgeByType: Record<string, number>;
  knowledgeByRepository: Record<string, number>;
  avgConfidence: number;
  
  // Growth metrics
  extractionRate: number;        // Knowledge/hour
  admissionRate: number;         // Accepted/extracted
  rejectionRate: number;         // Rejected/extracted
  
  // Retrieval metrics
  avgRetrievalLatency: number;
  p95RetrievalLatency: number;
  cacheHitRate: number;
  avgResultsPerQuery: number;
  
  // Quality metrics
  duplicateRate: number;         // Duplicates/total
  conflictRate: number;           // Conflicts/total
  hallucinationRate: number;      // Unsupported/total
  
  // Usage metrics
  avgKnowledgeUsed: number;       // Knowledge used/task
  helpfulnessScore: number;       // Average helpfulness
  feedbackRate: number;           // Feedback received
  
  // System metrics
  neo4jConnections: number;
  evidenceStorageSize: number;
  queueDepth: number;
  workerHealth: 'healthy' | 'degraded' | 'down';
}
```

### Alerting

```typescript
const ALERTS = {
  // Critical alerts
  hallucination_detected: {
    condition: (m: MemoryMetrics) => m.hallucinationRate > 0,
    severity: 'critical',
    message: 'Knowledge without evidence detected'
  },
  
  neo4j_unavailable: {
    condition: (m: MemoryMetrics) => m.workerHealth === 'down',
    severity: 'critical',
    message: 'Graphiti backend unreachable'
  },
  
  // Warning alerts
  high_latency: {
    condition: (m: MemoryMetrics) => m.p95RetrievalLatency > 500,
    severity: 'warning',
    message: 'Retrieval P95 latency exceeds 500ms'
  },
  
  low_admission_rate: {
    condition: (m: MemoryMetrics) => m.admissionRate < 0.5,
    severity: 'warning',
    message: 'Less than 50% knowledge accepted'
  },
  
  high_duplicate_rate: {
    condition: (m: MemoryMetrics) => m.duplicateRate > 0.1,
    severity: 'warning',
    message: 'More than 10% duplicates detected'
  }
};
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1)

**Deliverables:**
- [ ] Define provider interfaces
- [ ] Create FakeProvider for testing
- [ ] Establish dependency rules
- [ ] Set up TypeScript project structure

**Verification:**
- Interfaces compile
- Dependency graph is acyclic
- Business logic imports no Graphiti

**Success Criteria:**
```
Swap Graphiti with FakeProvider → System still runs
```

---

### Phase 2: Evidence Collection (Week 2)

**Deliverables:**
- [ ] Implement Git evidence collector
- [ ] Implement Terminal evidence collector
- [ ] Implement Test evidence collector
- [ ] Create Evidence store (PostgreSQL)
- [ ] Add deduplication logic

**Verification:**
- Evidence from all sources collected
- Provenance retained
- Duplicate rate < 2%

**Success Criteria:**
```
Coverage > 95%
Duplicates < 2%
```

---

### Phase 3: Knowledge Extraction (Week 3)

**Deliverables:**
- [ ] Implement candidate extractor
- [ ] Implement entity extractor
- [ ] Implement relation extractor
- [ ] Add hallucination check
- [ ] Create knowledge types

**Verification:**
- Every knowledge links to evidence
- Hallucination rate = 0%
- Coverage across all evidence types

**Success Criteria:**
```
Hallucination rate: 0%
Evidence backing: 100%
```

---

### Phase 4: Knowledge Validation (Week 4)

**Deliverables:**
- [ ] Implement schema validator
- [ ] Implement evidence validator
- [ ] Implement conflict detector
- [ ] Implement duplicate detector
- [ ] Implement admission policy

**Verification:**
- Bad knowledge rejected
- Conflicts detected
- Duplicates identified

**Success Criteria:**
```
Conflict detection: > 95%
Duplicate detection: > 98%
```

---

### Phase 5: Knowledge Store (Week 5)

**Deliverables:**
- [ ] Implement Graphiti provider
- [ ] Create Neo4j schema
- [ ] Add indexes and constraints
- [ ] Implement storage operations
- [ ] Add integrity checks

**Verification:**
- Store and retrieve correctly
- No orphan nodes
- No broken references

**Success Criteria:**
```
Integrity checks: 100% pass
```

---

### Phase 6: Retrieval Engine (Week 6)

**Deliverables:**
- [ ] Implement semantic search
- [ ] Implement graph traversal
- [ ] Implement entity lookup
- [ ] Create hybrid retrieval
- [ ] Add ranking algorithm

**Verification:**
- Benchmark queries
- Recall/precision metrics
- Latency measurements

**Success Criteria:**
```
Recall > 90%
Precision > 85%
P95 latency < 300ms
```

---

### Phase 7: Reasoning Layer (Week 7)

**Deliverables:**
- [ ] Implement explanation reasoning
- [ ] Implement dependency reasoning
- [ ] Implement decision reasoning
- [ ] Implement failure analysis
- [ ] Add context assembly

**Verification:**
- Explanations are evidence-backed
- Dependency graphs accurate
- Failure analysis helpful

**Success Criteria:**
```
Evidence backing: 100%
Helpfulness rating: > 80%
```

---

### Phase 8: Context Builder (Week 8)

**Deliverables:**
- [ ] Implement compression pipeline
- [ ] Implement prioritization
- [ ] Implement formatting
- [ ] Add token budgeting
- [ ] Create context templates

**Verification:**
- Token reduction achieved
- Context improves outcomes
- Latency acceptable

**Success Criteria:**
```
Token reduction: > 70%
Task success improvement: > 20%
```

---

### Phase 9: Integration (Week 9)

**Deliverables:**
- [ ] Wire all components together
- [ ] Add background workers
- [ ] Implement queues
- [ ] Add retry logic
- [ ] Implement graceful degradation

**Verification:**
- End-to-end flow works
- Failures handled gracefully
- No request blocking

**Success Criteria:**
```
Memory failures don't crash agent
Request latency overhead < 50ms
```

---

### Phase 10: Production Readiness (Week 10)

**Deliverables:**
- [ ] Add observability
- [ ] Create dashboards
- [ ] Set up alerting
- [ ] Write runbooks
- [ ] Load testing
- [ ] Security review

**Verification:**
- Metrics captured
- Alerts firing correctly
- Load tests pass

**Success Criteria:**
```
All metrics available
Alerts validated
Load test: 100 concurrent requests
```

---

## Architecture Review

### Strengths

1. ✅ **Evidence-driven** - Every knowledge backed by evidence
2. ✅ **Provider abstraction** - Business logic decoupled from storage
3. ✅ **Layered architecture** - Each layer independently testable
4. ✅ **Scalable** - Background processing, caching, batching
5. ✅ **Observable** - Metrics at every layer
6. ✅ **Graceful degradation** - Memory failures don't crash agent
7. ✅ **Knowledge graph** - Uses Graphiti as intended
8. ✅ **Multi-tenant** - Repository/session isolation
9. ✅ **Feedback loops** - Learns from usage
10. ✅ **Production-ready** - Monitoring, alerting, runbooks

### Weaknesses

1. ❌ **Complex implementation** - 10 weeks estimated effort
2. ❌ **Token overhead** - Context injection adds latency
3. ❌ **Evidence storage** - PostgreSQL dependency
4. ❌ **LLM dependency** - Extraction requires LLM calls
5. ❌ **Graph complexity** - Neo4j expertise needed

### Comparison with Industry

**vs OpenHands:**
- ✅ More evidence-driven (OpenHands stores events)
- ✅ Better provider abstraction
- ❌ Less battle-tested

**vs Graphiti reference:**
- ✅ More structured knowledge types
- ✅ Better admission policy
- ❌ No entity resolution yet (Phase 11)

**vs Mem0:**
- ✅ Better graph structure
- ✅ More evidence backing
- ❌ No hosted service

**vs Cursor:**
- ✅ Broader scope (not just code)
- ✅ Knowledge graph vs vector search
- ❌ Higher latency

**vs Claude Code:**
- ✅ Long-term memory vs session-only
- ✅ Repository understanding
- ❌ Claude Code doesn't need it (prompt continuity)

### Verdict

**Architecture Score: 8.5/10**

**Production Readiness: Ready after 10-week implementation**

**Recommendation: APPROVED**

This architecture transforms the current proof-of-concept into a production-grade knowledge system suitable for autonomous AI agents working on repositories over years.
