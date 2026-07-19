# Phase 3 Invariants: Projection Infrastructure

**Status**: Frozen  
**Date**: 2026-07-18  
**Enforcement**: All implementations must preserve these invariants

**System Context:** Phase 3 invariants complement the [System-Wide Invariants](../INVARIANTS.md). Both must be upheld.

---

## G1: Deterministic Projection

**Statement**: Same Knowledge always projects to same graph representation.

**Implication**: Given identical Knowledge, any backend (Graphiti, Neo4j, Memgraph) produces semantically equivalent projections.

**Test**: 
```typescript
const k1 = await knowledge.create(e1, e2);
const k2 = await knowledge.create(e1, e2); // same inputs
assert(k1.hash === k2.hash);
// Backend.apply(k1.event) === Backend.apply(k2.event)
```

**Violation**: Non-deterministic projection.

---

## G2: Knowledge is Source of Truth

**Statement**: Graph is disposable. Knowledge is permanent.

**Implication**: 
- Graph can be deleted and rebuilt from Knowledge
- Knowledge never depends on projection state
- Projection failures never affect Knowledge correctness

**Test**:
```typescript
await backend.rebuild();
const verification = await backend.verify();
assert(verification.valid);
```

**Violation**: Knowledge depending on graph state.

---

## G3: Projection Failures Never Affect Knowledge

**Statement**: Projection errors are contained to projection layer.

**Implication**: If backend crashes, Knowledge transactions succeed. Retries happen in projection runtime, not Knowledge layer.

**Test**:
```typescript
// Backend is down
const knowledge = await createKnowledge(e1, e2);
assert(knowledge.status === 'committed');
// Projection state is 'stale', not Knowledge
```

**Violation**: Knowledge transaction failing due to projection error.

---

## G4: Projection Events are Signals

**Statement**: Events describe WHAT happened. Backends decide HOW to project.

**Implication**: Events don't contain backend-specific instructions. Backends are free to implement projection however they choose.

**Test**:
```typescript
const event: ProjectionEvent = {
  type: 'KnowledgeCreated',
  knowledgeHash: 'abc123',
  knowledgeSequence: 1
  // No: graphitiNodeId, neo4jLabel, etc.
};
await backend.apply(event);
```

**Violation**: Events containing backend implementation details.

---

## G5: Runtime is Replaceable Infrastructure

**Statement**: Queue, workers, scheduling are operational concerns, not architecture.

**Implication**: Can swap BullMQ → Temporal → Kafka without changing backend interface or domain logic.

**Test**:
```typescript
// Runtime swap
const runtime1 = new BullMQBackend();
const runtime2 = new TemporalBackend();
// Both use same Backend.apply(event) interface
```

**Violation**: Backend depending on specific runtime implementation.

---

## G6: Projection is Idempotent

**Statement**: Applying same event multiple times produces same result.

**Implication**: Safe to retry on failure. Safe to replay for rebuild. Deduplication at backend layer.

**Test**:
```typescript
await backend.apply(event);
await backend.apply(event); // same event
await backend.apply(event); // same event
const state = await backend.getState(event.knowledgeHash);
assert(state.count === 1); // only one projection
```

**Violation**: Duplicate events creating duplicate nodes.

---

## G7: Backend Preserves Ontology

**Statement**: Knowledge meaning survives projection.

**Implication**: 
- User → created → Trace (Knowledge) equals User-[CREATED]->Trace (Projection)
- Retrieval returns Knowledge-equivalent meaning
- Semantic verification compares ontology, not storage internals

**Test**:
```typescript
const knowledge = parseKnowledge(knowledgeHash);
const retrieved = await retrieval.related(knowledgeId);
assert(retrieved.meaning === knowledge.meaning);
```

**Violation**: Projection losing or corrupting semantic relationships.

---

## G8: Every Layer Has One Upstream Source (NEW)

**Statement**: Each layer consumes exactly one layer beneath it.

**Implication**: No shortcuts. No bypassing. No Reading Evidence directly from Reasoning.

**Layer Sources**:
```
Evidence      ← Reality
Knowledge     ← Evidence
Projection    ← Knowledge
Retrieval     ← Projection
Reasoning     ← Retrieval
Planning      ← Reasoning
Execution     ← Planning
```

**Test**: Architecture review checks import boundaries.

**Violation**: 
```typescript
// In Reasoning layer
import { evidence } from './evidence'; // ❌ WRONG
import { retrieval } from './retrieval'; // ✅ CORRECT
```

---

## Invariant Enforcement

**Code Review Checklist**:
- [ ] All 8 invariants preserved
- [ ] No layer bypass
- [ ] No backend-specific concepts in events
- [ ] No operational state in canonical DB

**Testing Requirements**:
- Unit tests per invariant
- Integration tests for rebuild scenarios
- Property-based tests for idempotency

**Failure Modes**:
- If G1 violated: Non-deterministic bugs
- If G2 violated: Data loss on graph rebuild
- If G3 violated: Cascading failures
- If G4 violated: Backend lock-in
- If G5 violated: Runtime lock-in
- If G6 violated: Duplicate projections
- If G7 violated: Meaning drift
- If G8 violated: Spaghetti architecture

---

## References

- Phase 1/2: `phase2/INVARIANTS.md` (K1-K14)
- Phase 3: This document (G1-G8)
- Domain Boundaries: `ADR-003.md`
