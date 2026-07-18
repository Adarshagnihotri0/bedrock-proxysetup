# Phase 3 Architecture Decisions

**Status:** Architecture Definition Required  
**Priority:** HIGH - Blocks Phase 3 implementation  
**Date:** 2026-07-18

---

## Overview

Phase 3 (Projection Infrastructure) requires architectural decisions before implementation can proceed. This document tracks open decisions, requirements, and options.

---

## DECISION-001: Knowledge Sequence Assignment Policy

### Context

Knowledge facts need a sequence number for replay ordering.

**Requirement:** All observers must agree on the same total order.

### Options

| Option | Pros | Cons | Dependencies |
|--------|------|------|--------------|
| **A: PostgreSQL SERIAL** | Simple, built-in | Not gapless, breaks under concurrent inserts | None |
| **B: Lamport Timestamps** | Monotonic, distributed-friendly | Requires coordination | View maintenance |
| **C: Total Order Broadcast (Kafka)** | Strong ordering guarantees | External dependency | Kafka cluster |
| **D: Hybrid (PostgreSQL + logical timestamp)** | Gapless within session | Complex logic | None |

### Requirements

1. **Total order:** All observers agree on ordering
2. **Monotonic:** Sequence numbers never decrease
3. **Persistent:** Survives restart
4. **Replayable:** Same sequence on replay

### Recommendation

**TODO: Requires experiment**

Create a test scenario:
1. 10 concurrent knowledge insertions
2. Verify sequence ordering is deterministic
3. Verify replay produces same sequence

### Decision Owner

TBD

---

## DECISION-002: `apply(event)` Semantics

### Context

Projection layer needs to apply events to graph state.

**Current architecture:**
```typescript
interface GraphitiClient {
  addEpisode(event: ProjectionEvent): Promise<GraphState>;
}
```

**Question:** What does `apply(event)` mean?

### Open Questions

1. **Event Identity:** What makes two events "the same"?
   - By hash? By sequence? By (hash, sequence)?
   
2. **Idempotency:** Is `apply(event)` idempotent?
   - If same event applied twice, does graph state change?
   
3. **Event Evolution:** Can events change over time?
   - If knowledge confidence updates, does event change?
   
4. **Compensation:** How to handle event retraction?

### Requirements

1. **Deterministic:** Same events → same graph
2. **Idempotent OR Explicit:** Must define behavior for duplicate events
3. **Compensatable:** Must define compensation semantics

### Recommendation

Define event schema:

```typescript
interface ProjectionEvent {
  // Identity (immutable)
  hash: string;                 // SHA-256 of knowledge fact
  sequence: number;             // Total order position
  
  // Payload (immutable)
  type: KnowledgeType;
  subject: string;
  predicate: string;
  object: string;
  
  // Metadata (mutable?)
  confidence?: number;          // QUESTION: Can this change?
  evidence: string[];           // QUESTION: Can this change?
}

// OR separate:
interface EventIdentity {
  hash: string;
  sequence: number;
}

interface EventPayload {
  knowledge: Knowledge;
}
```

### Decision Owner

TBD

---

## DECISION-003: Graphiti Ontology Compatibility

### Context

Phase 3 uses Graphiti as projection backend.

**Risk:** Graphiti may have ontology assumptions that conflict with bedrock-proxy's knowledge model.

### Open Questions

1. **Node Identity:** How does Graphiti identify nodes?
   - By UUID? By properties? By hash?
   
2. **Edge Semantics:** How does Graphiti model relationships?
   - As edges? As nodes? Both?
   
3. **Temporal Modeling:** How does Graphiti handle temporal facts?
   - Valid time? Transaction time? Both?
   
4. **Query Model:** What queries does Graphiti support?
   - Pattern matching? Path queries? Aggregations?

### Evidence Needed

**Compatibility Study Required:**

1. Map bedrock-proxy knowledge ontology to Graphiti graph model
2. Identify mismatches
3. Define transformation layer (if needed)
4. Test with representative dataset

### Recommendation

Create `docs/architecture/GRAPHITI_COMPATIBILITY_STUDY.md`:

```markdown
## Knowledge Model → Graph Model Mapping

| Bedrock-Proxy | Graphiti | Transformation |
|---------------|----------|----------------|
| Knowledge(subject, predicate, object) | Edge(subject, object, predicate) | Direct? |
| Knowledge type | Node type? Edge type? | TBD |
| Knowledge confidence | Edge weight? Property? | TBD |
| Evidence provenance | Edge metadata? Node? | TBD |

## Ontology Constraints

- Bedrock-Proxy: Subject-Predicate-Object triples
- Graphiti: [WRITE GRAPHITI MODEL HERE]

## Compatibility Gaps

1. [GAP 1]
2. [GAP 2]
```

### Decision Owner

TBD

---

## DECISION-004: Projection State Schema

### Context

Phase 3 needs to track projection state for recovery and monitoring.

**Question:** What state needs to be persisted?

### Options

**Option A: Full State**
```sql
CREATE TABLE projection_state (
  knowledge_hash TEXT PRIMARY KEY,
  node_id UUID NOT NULL,
  edge_ids UUID[] NOT NULL,
  projected_at TIMESTAMPTZ NOT NULL,
  projection_version INTEGER NOT NULL
);
```

**Pros:** Complete recovery state  
**Cons:** Large storage, state explosion

**Option B: Minimal State (Event Log)**
```sql
CREATE TABLE projection_checkpoint (
  last_sequence INTEGER NOT NULL,
  checkpoint_time TIMESTAMPTZ NOT NULL
);
```

**Pros:** Minimal storage, replay from checkpoint  
**Cons:** Replay cost, state reconstruction

**Option C: Hybrid (Checkpoint + Snapshot)**
```sql
CREATE TABLE projection_snapshot (
  id UUID PRIMARY KEY,
  snapshot_sequence INTEGER NOT NULL,
  snapshot_time TIMESTAMPTZ NOT NULL,
  graph_state JSONB NOT NULL
);

CREATE TABLE projection_checkpoint (
  id INTEGER PRIMARY KEY,
  last_sequence INTEGER NOT NULL,
  last_snapshot UUID REFERENCES projection_snapshot
);
```

**Pros:** Fast recovery (snapshot) + minimal storage (checkpoint)  
**Cons:** Complexity, snapshot management

### Requirements

1. **Recoverable:** Can restart projection from persisted state
2. **Queryable:** Can determine current projection status
3. **Minimal:** Storage overhead should be bounded

### Recommendation

**Option C (Hybrid)** with:
- Snapshot every N events (configurable)
- Checkpoint after each event batch
- TTL-based snapshot retention

### Decision Owner

TBD

---

## DECISION-005: Retrieval Contract

### Context

Phase 3 provides a retrieval interface for downstream layers (Reasoning, Planning).

**Question:** What queries must the retrieval layer support?

### Options

**Query Type 1: Pattern Matching**
```typescript
interface PatternQuery {
  subject?: string | Pattern;
  predicate?: string | Pattern;
  object?: string | Pattern;
  confidence?: Range;
}

// Example: "Find all facts about file X"
await retrieval.query({ subject: "file_X", predicate: "*", object: "*" });
```

**Query Type 2: Neighbor Expansion**
```typescript
interface NeighborQuery {
  node: string;
  direction: "incoming" | "outgoing" | "both";
  depth: number;
}

// Example: "Find all facts connected to 'build' node"
await retrieval.neighbors({ node: "build", direction: "both", depth: 2 });
```

**Query Type 3: Path Finding**
```typescript
interface PathQuery {
  from: string;
  to: string;
  maxLength: number;
}

// Example: "How is 'error_X' connected to 'test_Y'?"
await retrieval.path({ from: "error_X", to: "test_Y", maxLength: 5 });
```

**Query Type 4: Context Assembly**
```typescript
interface ContextQuery {
  focus: string;
  relevance: (fact: Knowledge) => number;
  budget: number;  // Token budget
}

// Example: "Give me context for debugging error_X"
await retrieval.context({ focus: "error_X", budget: 4000 });
```

### Requirements

1. **Efficient:** Sub-second for common queries
2. **Composable:** Queries can be combined
3. **Ranked:** Results should be ranked by relevance/confidence

### Recommendation

Define minimal interface for Phase 3:

```typescript
interface RetrievalClient {
  // Core query
  query(pattern: PatternQuery): Promise<Knowledge[]>;
  
  // Graph navigation
  neighbors(query: NeighborQuery): Promise<GraphPath[]>;
  
  // Context assembly (Phase 4+)
  context(query: ContextQuery): Promise<Knowledge[]>;
}
```

### Decision Owner

TBD

---

## Decision Tracking

| Decision | Status | Owner | Deadline |
|----------|--------|-------|----------|
| DECISION-001 | 🔴 TODO | TBD | Before Phase 3 implementation |
| DECISION-002 | 🔴 TODO | TBD | Before Phase 3 implementation |
| DECISION-003 | 🔴 TODO | TBD | Before Graphiti integration |
| DECISION-004 | 🔴 TODO | TBD | Before Phase 3 implementation |
| DECISION-005 | 🔴 TODO | TBD | Before Phase 3 implementation |

---

## Dependencies

**Phase 3 implementation should NOT proceed until:**
1. DECISION-001 resolved (sequence assignment)
2. DECISION-002 resolved (apply semantics)
3. DECISION-003 resolved (Graphiti compatibility)

**Phase 4 implementation should NOT proceed until:**
4. DECISION-004 resolved (projection state)
5. DECISION-005 resolved (retrieval contract)

---

## Next Steps

1. **Assign decision owners** (who is responsible for each decision?)
2. **Schedule design sessions** (one per decision)
3. **Create experiments** (for decisions requiring validation)
4. **Document decisions** in ADR (Architecture Decision Record) format
5. **Update Phase 3 invariants** once decisions are made

---

## References

- `docs/architecture/PHASE3_ARCHITECTURAL_REVIEW.md` - Risk identification
- `docs/architecture/phase3/INVARIANTS.md` - Phase 3 invariants (need updates)
- `scratch/GRAPHITI_GAPS.md` - Graphiti compatibility notes (needs expansion)
