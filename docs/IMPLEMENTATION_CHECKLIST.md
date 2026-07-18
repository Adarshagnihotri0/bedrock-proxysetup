# Memory Architecture Implementation Checklist

## Pre-Implementation: Approval Required

Before writing ANY production code:

- [ ] Review `MEMORY_ARCHITECTURE_DESIGN.md` completely
- [ ] Understand each layer's purpose and verification criteria
- [ ] Confirm 10-week timeline is acceptable
- [ ] Approve provider abstraction approach
- [ ] Approve knowledge types (8 types defined)
- [ ] Approve evidence sources (8 sources defined)
- [ ] Approve Neo4j graph schema
- [ ] Approve PostgreSQL for evidence storage
- [ ] Confirm LLM budget for extraction
- [ ] Approve token budget strategy (5000 tokens for memory context)

---

## Phase 0: Foundation (Week 1) ✅ COMPLETE

### Day 1-2: Provider Interfaces

- [x] Create `src/types/providers.ts`
  - [x] `KnowledgeProvider` interface
  - [x] `EvidenceProvider` interface
  - [x] `RetrievalProvider` interface
  - [x] `ContextProvider` interface
  - [x] Plus: EntityProvider, ReasoningProvider, StorageProvider, MemoryProvider

- [x] Create `src/types/knowledge.ts`
  - [x] `ArchitecturalDecision` type
  - [x] `RepositoryKnowledge` type
  - [x] `FailurePattern` type
  - [x] `SuccessfulFix` type
  - [x] `Dependency` type
  - [x] `Entity` type
  - [x] `Preference` type
  - [x] `CodingConvention` type
  - [x] Plus: Evidence (8 types), RetrievalQuery, ReasoningContext

### Day 3-4: Fake Provider

- [x] Create `src/adapters/fake-provider.ts`
  - [x] In-memory storage
  - [x] Mock retrieval
  - [x] Test doubles
  - [x] All 7 provider implementations

### Day 5: Verification

- [x] Run dependency check: `grep -r "from '../graphiti" src/services/`
  - [x] Expected: Empty (no imports) ✅ PASSED (0 matches)
- [x] Run TypeScript compilation: `npm run build`
  - [x] Expected: Success ✅ PASSED
- [x] Run verification: `npx ts-node scripts/verify-phase0.ts`
  - [x] Expected: All pass with FakeProvider ✅ PASSED (6/6 tests)

**Verification Results:**

```
✅ Provider interfaces compile
✅ Dependency graph is acyclic  
✅ Business logic imports no Graphiti modules
✅ Mock provider passes all tests
✅ Swap Graphiti with FakeProvider → System still runs
```

**Phase 0 Status:** ✅ COMPLETE (Completed in 1 day, estimated 5 days)

---

## Phase 1: Evidence Collection (Week 2) ⬅️ READY TO START

**Status:** All Phase 0 prerequisites met. Ready to begin.

### Day 6-7: Git Collector

- [ ] Create `src/evidence/git-collector.ts`
  - [ ] Parse `git diff` output
  - [ ] Extract file changes
  - [ ] Capture commit metadata

### Day 8-9: Terminal Collector

- [ ] Create `src/evidence/terminal-collector.ts`
  - [ ] Capture command execution
  - [ ] Capture stdout/stderr
  - [ ] Measure duration

### Day 10: Test Collector

- [ ] Create `src/evidence/test-collector.ts`
  - [ ] Parse test results
  - [ ] Extract pass/fail status
  - [ ] Capture coverage data

### Day 11: Evidence Store

- [ ] Create PostgreSQL migration: `migrations/003_create_evidence.sql`
  - [ ] Evidence table with JSONB content
  - [ ] Content hash unique constraint
  - [ ] Repository/timestamp indexes

- [ ] Create `src/adapters/postgres-evidence-provider.ts`
  - [ ] Insert evidence
  - [ ] Query by repository/type
  - [ ] Deduplication by hash

### Day 12: Verification

- [ ] Test evidence collection from real repository
  - [ ] Git diff produces evidence
  - [ ] Terminal commands captured
  - [ ] Test results stored
- [ ] Check deduplication
  - [ ] Same diff doesn't create duplicate
- [ ] Measure coverage
  - [ ] Target: > 95% of execution events produce evidence

---

## Phase 2: Knowledge Extraction (Week 3)

### Day 13-14: Candidate Extractor

- [ ] Create `src/services/knowledge-extraction.service.ts`
  - [ ] LLM-based candidate extraction
  - [ ] Map evidence to knowledge types
  - [ ] Confidence scoring

### Day 15: Entity Extractor

- [ ] Create `src/services/entity-extraction.service.ts`
  - [ ] NER for code entities
  - [ ] LLM enrichment
  - [ ] Entity normalization

### Day 16: Relation Extractor

- [ ] Create `src/services/relation-extraction.service.ts`
  - [ ] Extract relationships
  - [ ] Type relationships (DEPENDS_ON, CALLS, etc.)

### Day 17: Hallucination Check

- [ ] Implement `hasEvidenceBacking()` function
  - [ ] Check every knowledge property
  - [ ] Verify evidence links exist
  - [ ] Discard unsupported knowledge

### Day 18-19: Verification

- [ ] Test extraction on real evidence
  - [ ] Git diff → Repository knowledge
  - [ ] Test failure → Failure pattern
  - [ ] ADR doc → Architectural decision
- [ ] Check hallucination rate
  - [ ] Target: 0%
- [ ] Check evidence backing
  - [ ] Target: 100%

---

## Phase 3: Knowledge Validation (Week 4)

### Day 20: Schema Validator

- [ ] Create `src/services/validation.service.ts`
  - [ ] TypeScript type checking
  - [ ] Required field validation
  - [ ] Enum validation

### Day 21: Evidence Validator

- [ ] Implement evidence link validation
  - [ ] Check evidence IDs exist
  - [ ] Check evidence not too old
  - [ ] Check provenance complete

### Day 22: Conflict Detector

- [ ] Create `src/services/conflict-detection.service.ts`
  - [ ] Graph query for conflicting decisions
  - [ ] Entity conflict detection
  - [ ] Relationship conflict detection

### Day 23: Duplicate Detector

- [ ] Create `src/services/duplicate-detection.service.ts`
  - [ ] Content hash matching
  - [ ] Semantic similarity check
  - [ ] Merge strategy

### Day 24: Admission Policy

- [ ] Create `src/services/admission-policy.service.ts`
  - [ ] Importance scoring
  - [ ] Novelty scoring
  - [ ] Confidence scoring
  - [ ] Persistence scoring
  - [ ] Relevance scoring
  - [ ] Final weighted score

### Day 25: Verification

- [ ] Test rejection of:
  - [ ] Invalid schema
  - [ ] Missing evidence
  - [ ] Conflicting decisions
  - [ ] Duplicate knowledge
- [ ] Test admission scoring
  - [ ] High-score knowledge accepted
  - [ ] Low-score knowledge rejected

---

## Phase 4: Knowledge Store (Week 5)

### Day 26-27: Graph Schema

- [ ] Create Neo4j migration script
  - [ ] Create all node types
  - [ ] Create all relationship types
  - [ ] Create indexes
  - [ ] Create constraints

### Day 28-29: Graphiti Provider

- [ ] Create `src/adapters/graphiti-knowledge-provider.ts`
  - [ ] Implement `store()`
  - [ ] Implement `retrieve()`
  - [ ] Implement `queryGraph()`
  - [ ] Link evidence nodes
  - [ ] Link repository nodes

### Day 30: Integrity Checks

- [ ] Create `src/services/integrity-check.service.ts`
  - [ ] No dangling edges
  - [ ] No orphan evidence
  - [ ] No broken references

### Day 31: Verification

- [ ] Test store and retrieve
  - [ ] All knowledge types stored
  - [ ] Evidence links created
  - [ ] Repository links created
- [ ] Run integrity checks
  - [ ] All checks pass

---

## Phase 5: Retrieval Engine (Week 6)

### Day 32: Semantic Search

- [ ] Create `src/services/retrieval.service.ts`
  - [ ] Full-text search via Neo4j
  - [ ] Score results
  - [ ] Filter by repository/confidence

### Day 33: Graph Traversal

- [ ] Implement graph traversal
  - [ ] DEPENDS_ON traversal
  - [ ] CALLS traversal
  - [ ] Impact analysis

### Day 34: Entity Lookup

- [ ] Implement entity query
  - [ ] Name-based search
  - [ ] Path-based search
  - [ ] Related entities

### Day 35: Hybrid Retrieval

- [ ] Implement hybrid strategy
  - [ ] Parallel retrieval
  - [ ] Result merge
  - [ ] Deduplication

### Day 36: Ranking

- [ ] Implement ranking algorithm
  - [ ] Relevance score
  - [ ] Importance score
  - [ ] Usage score
  - [ ] Weighted combination

### Day 37: Verification

- [ ] Create benchmark queries
  - [ ] "How does authentication work?"
  - [ ] "Find Redis dependency"
  - [ ] "Previous migration"
- [ ] Measure metrics
  - [ ] Recall > 90%
  - [ ] Precision > 85%
  - [ ] P95 latency < 300ms

---

## Phase 6: Reasoning Layer (Week 7)

### Day 38: Explanation Reasoning

- [ ] Create `src/services/reasoning.service.ts`
  - [ ] Build explanations from knowledge
  - [ ] Link evidence
  - [ ] Identify risks

### Day 39: Dependency Reasoning

- [ ] Implement dependency analysis
  - [ ] Build dependency graph
  - [ ] Impact analysis
  - [ ] Critical path identification

### Day 40: Decision Reasoning

- [ ] Implement decision explanation
  - [ ] Trace decision history
  - [ ] Show alternatives
  - [ ] Show consequences

### Day 41: Failure Analysis

- [ ] Implement failure reasoning
  - [ ] Find similar failures
  - [ ] Suggest fixes
  - [ ] Rank by success rate

### Day 42: Verification

- [ ] Test reasoning outputs
  - [ ] Explanations evidence-backed
  - [ ] Dependency graphs accurate
  - [ ] Failure analysis helpful
  - [ ] User feedback > 80% positive

---

## Phase 7: Context Builder (Week 8)

### Day 43: Compression

- [ ] Create `src/services/context-builder.service.ts`
  - [ ] Summarize knowledge
  - [ ] Extract facts
  - [ ] Remove redundancy

### Day 44: Prioritization

- [ ] Implement prioritization
  - [ ] Rank by relevance
  - [ ] Rank by importance
  - [ ] Rank by recency

### Day 45: Formatting

- [ ] Implement context formatting
  - [ ] Markdown output
  - [ ] Structured sections
  - [ ] Evidence links

### Day 46: Token Budgeting

- [ ] Implement token budgeting
  - [ ] Count tokens
  - [ ] Limit to budget
  - [ ] Keep most useful

### Day 47: Verification

- [ ] Test context building
  - [ ] Knowledge → Context
  - [ ] Token reduction > 70%
  - [ ] Task success improvement > 20%

---

## Phase 8: Integration (Week 9)

### Day 48: Wire Components

- [ ] Create `src/pipelines/knowledge-pipeline.ts`
  - [ ] Wire extraction → validation → storage
- [ ] Create `src/pipelines/retrieval-pipeline.ts`
  - [ ] Wire retrieval → reasoning → context

### Day 49: Background Workers

- [ ] Create `src/workers/extraction-worker.ts`
  - [ ] Process evidence queue
  - [ ] Extract knowledge
  - [ ] Store results

### Day 50: Queues

- [ ] Set up Redis queues
  - [ ] Evidence queue
  - [ ] Extraction queue
  - [ ] Validation queue

### Day 51: Retry Logic

- [ ] Implement retry strategies
  - [ ] Exponential backoff
  - [ ] Dead-letter queue
  - [ ] Circuit breaker

### Day 52: Graceful Degradation

- [ ] Implement fallbacks
  - [ ] Neo4j down → skip memory
  - [ ] LLM timeout → use cached extraction
  - [ ] Queue full → process synchronously

### Day 53: Verification

- [ ] Test end-to-end flow
  - [ ] Evidence → Knowledge → Storage → Retrieval → Context
- [ ] Test failure scenarios
  - [ ] Memory failures don't crash agent
  - [ ] Request latency overhead < 50ms

---

## Phase 9: Production Readiness (Week 10)

### Day 54: Observability

- [ ] Create `src/monitoring/metrics.ts`
  - [ ] Knowledge metrics
  - [ ] Retrieval metrics
  - [ ] Quality metrics
  - [ ] Usage metrics

### Day 55: Dashboards

- [ ] Create Grafana dashboards
  - [ ] Knowledge count by type
  - [ ] Retrieval latency
  - [ ] Admission rate
  - [ ] Hallucination rate

### Day 56: Alerting

- [ ] Configure alerts
  - [ ] Hallucination detected
  - [ ] Neo4j unavailable
  - [ ] High latency
  - [ ] Low admission rate

### Day 57: Runbooks

- [ ] Create operational runbooks
  - [ ] How to diagnose retrieval issues
  - [ ] How to handle Neo4j failures
  - [ ] How to reset knowledge graph

### Day 58: Load Testing

- [ ] Run load tests
  - [ ] 100 concurrent requests
  - [ ] sustained for 1 hour
  - [ ] Check for memory leaks

### Day 59: Security Review

- [ ] Security review
  - [ ] No sensitive data in knowledge
  - [ ] Evidence access controls
  - [ ] API authentication

### Day 60: Production Launch

- [ ] Deploy to production
  - [ ] Migrate existing memory (if any)
  - [ ] Enable monitoring
  - [ ] Announce availability

---

## Post-Implementation: Continuous Verification

### Daily Checks

- [ ] Monitor hallucination rate (should be 0%)
- [ ] Check Neo4j health
- [ ] Review queue depth
- [ ] Check retrieval latency

### Weekly Checks

- [ ] Review knowledge growth
- [ ] Analyze admission rate
- [ ] Check for duplicates
- [ ] Review feedback scores

### Monthly Checks

- [ ] Prune archived knowledge
- [ ] Update ranking weights
- [ ] Review user feedback
- [ ] Optimize graph indexes

---

## Success Criteria Summary

**Must Pass Before Production:**
```
✅ Hallucination rate: 0%
✅ Evidence backing: 100%
✅ Recall > 90%
✅ Precision > 85%
✅ P95 latency < 300ms
✅ Token reduction > 70%
✅ Integrity checks: 100% pass
✅ Dependency isolation: 100%
✅ Load test: 100 concurrent
✅ Memory failures: no crashes
```

**After Launch:**
```
✅ Task success improvement > 20%
✅ User satisfaction > 80%
✅ Retrieval usefulness increasing
✅ System stable for 30 days
```
