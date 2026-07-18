# Phase 3: Projection Infrastructure - Roadmap

**Status**: Ready for Freeze  
**Version**: 4 (Final Architecture)  
**Depends On**: Phase 2 Knowledge Extraction (Frozen)  
**ADR**: [ADR-003: Canonical Domain Boundary](./ADR-003.md)

---

## Goal

Build infrastructure for projecting deterministic Knowledge into rebuildable graph views while maintaining Knowledge as the single source of truth.

---

## Architectural Layers

```
Reality
    │
    ▼
Evidence (Immutable)
    │
    ▼
Knowledge (Canonical)
    │
    ▼
Projection Events
    │
    ▼
Projection Runtime
    │
    ▼
Projection Backend
    │
    ▼
Graph View (Disposable)
```

**Critical property:**
- Evidence is the immutable record of reality
- Knowledge is the canonical interpretation
- Projection events are signals (not instructions)
- Graph is disposable and rebuildable
- Runtime is operational infrastructure (replaceable)

---

## Problem Statement

Phase 2 provides structured knowledge with:
- Content-addressable knowledge (hash-based identity)
- Many-to-one relationships (evidence → knowledge)
- Extractor provenance (name + version)
- Deterministic extraction (replayable)

We need to **project** this knowledge into graphs for efficient traversal. The projection must be:
- Asynchronous and eventually consistent
- Idempotent (safe to retry)
- Disposable (graph can be rebuilt)
- Backend-agnostic (swap Graphiti for Neo4j without changing Knowledge)

---

## Architectural Principles

### G1: Deterministic Projection (CRITICAL)

```
Same Knowledge → Same Graph Representation
```

Deleting the graph and rebuilding from Knowledge produces an equivalent graph.

**Implementation**: Projection function is pure, deterministic, and versioned.

---

### G2: Knowledge is Source of Truth (CRITICAL)

```
Graph = Projection(Knowledge)
```

Graph is NEVER a source of truth. It is a disposable, rebuildable view.

**Consequence**: We can delete the graph and rebuild it at any time.

---

### G3: Projection Failures Never Affect Knowledge (CRITICAL)

```
Knowledge committed → Projection fails → Retry later
```

**NOT**:
```
Knowledge committed → Projection fails → Rollback Knowledge
```

Knowledge must remain authoritative. Projection is eventually consistent.

---

### G4: Projection Events are Signals

```
Knowledge → Event → Runtime → Backend
```

Events signal that something happened. They do NOT instruct how to handle it.

**Consequence**: Queue implementation is operational detail, not architecture.

---

### G5: Runtime is Replaceable Infrastructure

```
Projection Runtime
    ├── PostgreSQL LISTEN/NOTIFY
    ├── BullMQ
    ├── Kafka
    ├── Temporal
    └── RabbitMQ
```

The architecture defines **events**, not **queues** or **workers**.

**Runtime responsibilities:**
- Retries
- Scheduling
- Batching
- Backpressure
- Concurrency
- Recovery

These are operational concerns, not architectural.

---

### G6: Projection is Idempotent (CRITICAL)

```
project(Knowledge) called N times = same graph
```

**Projection events carry:**
- `knowledge_hash` (content-addressable)
- `projection_version`

**Idempotency guarantee:**
```
KnowledgeCreated → Project → Project again → Equivalent graph
```

Retries become trivial. Duplicates harmless.

---

## Separation of Concerns

### Projection Runtime (Operational)

Responsible for:
- Retries
- Scheduling
- Batching
- Concurrency
- Recovery
- Queue management

**Implementation**: BullMQ, Temporal, Kafka, etc.

**Key insight**: Queue is NOT part of architecture.

---

### Projection Backend (Domain)

Responsible for:
```
Knowledge → Graphiti
Knowledge → Neo4j
Knowledge → Memgraph
```

**Implementation**: Graphiti adapter, Neo4j adapter, etc.

**Key insight**: Backend is swappable.

---

## Phase 3 Deliverables

### Phase 3.1: Projection Events

**Goal**: Define event schema and emission.

**Deliverables:**
- [ ] Projection event schema
  ```typescript
  interface ProjectionEvent {
    type: 'KnowledgeCreated' | 'KnowledgeSupported' | 'KnowledgeArchived';
    knowledgeHash: string;       // Content-addressable
    knowledgeSequence: number;   // Deterministic ordering
    knowledgeId: string;
    timestamp: Date;
  }
  ```
  **Event ordering**: knowledgeSequence ensures deterministic replay.
- [ ] Event emission on Knowledge creation
- [ ] Event schema validation
- [ ] No queue implementation yet (just events)

---

### Phase 3.2: Projection Backend Interface

**Goal**: Define backend-agnostic projection contract.

**Deliverables:**
- [ ] Projection backend contract (domain language)
  ```typescript
  /**
   * Projection Backend Contract
   * 
   * Event-driven backend. Consumes projection events.
   * Doesn't know if event came from realtime, replay, rebuild, or migration.
   */
  interface ProjectionBackend {
    /**
     * Apply projection event (idempotent)
     */
    apply(event: ProjectionEvent): Promise<void>;
    
    /**
     * Rebuild graph from Knowledge
     */
    rebuild(): Promise<void>;
    
    /**
     * Verify projection integrity
     */
    verify(): Promise<VerificationReport>;
  }
  ```
- [ ] Graphiti backend implementation
- [ ] Backend verification tests

---

### Phase 3.3: Projection State

**Goal**: Track projection status (domain state, not operational).

**Deliverables:**
- [ ] Projection state table
  ```sql
  CREATE TABLE projection_state (
    knowledge_id UUID PRIMARY KEY REFERENCES knowledge(id),
    knowledge_hash TEXT NOT NULL,
    projection_status TEXT NOT NULL 
      CHECK (projection_status IN ('projected', 'stale')),
    projection_version INTEGER NOT NULL,
    projected_at TIMESTAMPTZ NOT NULL
  );
  
  CREATE INDEX idx_projection_hash ON projection_state(knowledge_hash);
  ```
- [ ] State tracking (projected vs stale)
- [ ] No retry counters (operational state)

**Key insight**: Only domain state, not operational state.

---

### Phase 3.4: Projection Verification

**Goal**: Verify projection integrity.

**Deliverables:**
- [ ] Semantic verification (compare meaning, not storage)
  - Extract expected triples from Knowledge
  - Traverse actual graph for projected meaning
  - Compare semantic equivalence
  
  **G7 constraint**: Backend must preserve ontology.
- [ ] Full graph rebuild
- [ ] Drift detection
- [ ] Rebuild verification suite

**End of Phase 3.**

---

## What's NOT in Phase 3

- ❌ Retrieval API (Phase 4)
- ❌ Reasoning (Phase 5)
- ❌ Queue implementation (operational detail)
- ❌ Worker implementation (operational detail)
- ❌ Retry counters (operational state)

**Retrieval is Phase 4** because it's product behavior, not infrastructure.

---

## Operational State Maintained Elsewhere

The projection runtime (Temporal, BullMQ, Kafka, etc.) tracks operational concerns:

```
Runtime State:
- retry_count
- last_error
- scheduled_at
- worker_id
```

**Canonical Database (projection_state):**
```
- knowledge_hash
- projection_status (projected | stale)
- projection_version
- projected_at
```

**Why separate?**
- Runtime can be swapped without losing domain state
- Operational tools (Temporal UI) see operational state
- Domain queries see domain state

---

## Projection Architecture

### Event Flow

```
Knowledge (Committed)
          │
          ▼
  Projection Event
          │
          ▼
  Projection Runtime
    (BullMQ/Temporal/Kafka)
          │
          ▼
  Projection Backend
          │
          ▼
  Graph View
```

**Key insight**: Runtime is replaceable infrastructure.

---

### Backend Contract

```typescript
/**
 * Knowledge Projection Backend
 * 
 * Event-driven. Consumes projection events.
 * Backend decides HOW to project. Event describes WHAT happened.
 */
interface ProjectionBackend {
  /**
   * Apply projection event
   * Idempotent: safe to call multiple times
   * Monotonic: only adds (never deletes unless rebuilding)
   */
  apply(event: ProjectionEvent): Promise<void>;
  
  /**
   * Rebuild entire graph from Knowledge
   * Only operation that deletes
   */
  rebuild(): Promise<void>;
  
  /**
   * Verify projection integrity (semantic comparison)
   */
  verify(): Promise<VerificationReport>;
}
```

---

### Content-Addressable Events

Events carry hashes, not mutable IDs:

```typescript
interface ProjectionEvent {
  type: 'KnowledgeCreated' | 'KnowledgeSupported' | 'KnowledgeArchived';
  knowledgeHash: string;       // Content-addressable
  knowledgeSequence: number;   // Deterministic ordering
  timestamp: Date;
}
```

**Event ordering**: knowledgeSequence ensures events apply in correct order during replay.

**Backend owns projection version**: Event doesn't carry projectionVersion. Backend decides mapping.

**Why?**
- Events describe WHAT happened
- Backends decide HOW to project it
- Different backends may use different projection versions
- Consistent with Evidence/Knowledge content-addressable philosophy

---

## Failure Recovery

### Runtime Failure

```
Runtime crashes
    │
    ▼
Runtime restarts
    │
    ▼
Resume from last checkpoint
    │
    ▼
Retry pending events
    │
    ▼
Idempotent projection succeeds
```

**Key invariant**: G6 - Projection is idempotent.

---

### Backend Unavailable

```
Backend down
    │
    ▼
Projection fails
    │
    ▼
Runtime marks as retryable
    │
    ▼
Knowledge remains correct
    │
    ▼
Retry when backend recovers
```

**Key invariant**: G3 - Projection failures never affect Knowledge.

---

## Verification Strategy

### Semantic Verification

For each Knowledge:
1. Extract expected meaning triples (subject, predicate, object)
2. Traverse actual graph for projected meaning
3. Compare semantic equivalence

**Report:**
- Missing relationships
- Incorrect entities
- Broken connections
- Wrong attribute values

**Why semantic comparison?**
- Graphiti internals may change (upgrades, optimizations)
- Ontology is stable (your domain model)
- Verification survives backend swaps
- Example: User→created-at-trace vs User-[CREATED]->Trace.

---

### Rebuild Verification

```bash
npm run projection:rebuild    # Delete graph, rebuild from Knowledge
npm run projection:verify     # Verify every Knowledge projected correctly
npm run projection:report     # Generate integrity report
```

---

## Milestones

### Milestone A: Graphiti Spike Complete
**Goal**: Validate Graphiti can satisfy projection contract  
**Evidence**: All 7 spike tests pass (see `scratch/GRAPHITI_SPIKE_PLAN.md`)  
**Exit**: Proceed to Milestone B or pivot architecture

---

### Milestone B: Projection Backend Working
**Goal**: Implement minimal `ProjectionBackend` interface  
**Evidence**: All 3 integration tests pass:
- Test 1: Semantic equivalence (Knowledge → Graph → Retrieve)
- Test 2: Rebuild correctness (Delete → Rebuild → Equivalent)
- Test 3: Idempotency (100x project → 1 graph)

**Exit**: Proceed to Milestone C

---

### Milestone C: Verification Working
**Goal**: Validate semantic comparison  
**Evidence**: 
- G1 verified (deterministic)
- G6 verified (idempotent)
- G7 verified (ontology preserved)

**Exit**: Proceed to Milestone D

---

### Milestone D: Runtime Connected
**Goal**: Events flow from Knowledge to Backend  
**Evidence**: End-to-end flow working:
- Knowledge committed
- Event emitted
- Backend applied
- State tracked

**Exit**: Proceed to Milestone E

---

### Milestone E: Phase 3 Freeze
**Goal**: All invariants verified in implementation  
**Evidence**:
- All G1-G8 invariants tested
- Integration tests pass
- Architecture validated by code
- Documentation updated

**Exit**: Phase 3 complete

---

## Success Criteria

- [ ] Projection events defined
- [ ] Backend contract backend-agnostic
- [ ] Projection idempotent (G6)
- [ ] Graph rebuildable from Knowledge
- [ ] Verification detects drift
- [ ] Operational state separated from domain state
- [ ] All invariants documented and tested

---

## Monotonic Projection Principle

During normal operations, projection is **monotonic**:
- Always adds nodes/edges
- Always updates metadata
- Never deletes (unless explicit rebuild or archival)

**Why?**
- Prevents accidental data loss during concurrent operations
- Simplifies reasoning about projection state
- Aligns with content-addressable philosophy (add-only)

**When can projection delete?**
- Explicit `rebuild()` call
- KnowledgeArchived event (tombstone)
- Migration with explicit deletion

---

## Phase 4+ Roadmap

```
Phase 3: Projection Infrastructure
    ↓
Phase 4: Retrieval
    ↓
Phase 5: Reasoning
    ↓
Phase 6: Planning
    ↓
Phase 7: Execution
```

**Phase progression:**
```
Reality
    ↓
Evidence (Phase 1)
    ↓
Knowledge (Phase 2)
    ↓
Projection Infrastructure (Phase 3)
    ↓
Retrieval (Phase 4)
    ↓
Reasoning (Phase 5)
    ↓
Planning (Phase 6)
    ↓
Execution (Phase 7)
```

Each layer has exactly one responsibility.

### Retrieval Contract (Phase 4 Preview)

Even though retrieval is Phase 4, we define the contract here because it constrains Phase 3 backends.

```typescript
/**
 * Retrieval Contract (Phase 4)
 * 
 * Returns domain objects, not graph nodes.
 */
interface RetrievalContract {
  /**
   * Find related knowledge (traversal)
   */
  related(knowledgeId: string, relationType?: string): Promise<Knowledge[]>;
  
  /**
   * Timeline traversal (temporal)
   */
  timeline(knowledgeId: string, direction: 'before' | 'after'): Promise<Knowledge[]>;
  
  /**
   * Neighborhood search (spatial)
   */
  neighborhood(knowledgeId: string, depth: number): Promise<Knowledge[]>;
}
```

**Key insight**: Retrieval returns Knowledge domain objects, never graph internals.

**Why define now?**
- Phase 3 backends must support this contract
- Tests retrieval contract before building retrieval layer
- Ensures backend freedom (Graphiti, Neo4j, Memgraph)

---

## Key Architectural Boundaries

1. **Queue is NOT architecture** - Implementation detail
2. **Runtime is operational** - Replaceable infrastructure
3. **Backend is domain** - Swappable implementation
4. **State is domain** - projection_state tracks correctness
5. **Operational elsewhere** - Retry counters in runtime, not DB
6. **Events carry hashes** - Content-addressable philosophy
7. **Projection is monotonic** - Only adds (never deletes unless rebuilding)

---

## Invariant Summary

- **G1**: Deterministic projection
- **G2**: Knowledge is source of truth
- **G3**: Projection failures never affect Knowledge
- **G4**: Projection events are signals
- **G5**: Runtime is replaceable infrastructure
- **G6**: Projection is idempotent
- **G7**: Backend preserves ontology (Knowledge meaning survives projection)

---

## Exit Criteria

- [ ] Projection events defined
- [ ] Backend contract implemented
- [ ] Projection idempotent
- [ ] Graph rebuildable from Knowledge
- [ ] Domain state separated from operational state
- [ ] All invariants documented and tested
- [ ] Phase 3 frozen

---

## References

- Phase 1: Evidence Layer (Frozen)
- Phase 2: Knowledge Extraction (Frozen)  
- Phase 2 INVARIANTS.md: 14 invariants enforced
- ADR-003: Canonical Domain Boundary
- Axiom: "Graph is a projection, never a source of truth."
- Axiom: "Projection failures never affect Knowledge correctness."
- Axiom: "Projection is idempotent."
- Axiom: "Backend preserves ontology (G7)."
