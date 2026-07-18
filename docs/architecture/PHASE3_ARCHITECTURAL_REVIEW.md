# Phase 3 Architectural Review

**Date:** 2026-07-18  
**Reviewer:** Principal Engineer  
**Scope:** Projection Infrastructure Architecture

---

## Overview

Phase 3 introduces the **Projection Infrastructure** layer, which bridges knowledge storage (Phase 2) and product features (Retrieval, Reasoning, Planning).

This review focuses on architectural risks that the recent audit missed.

---

## ARCHITECTURAL RISK 1: `knowledgeSequence` is Not a Total Order

### Finding
Phase 3 invariants claim:
> G1: Same Knowledge always projects to same graph representation

But there is no documented mechanism ensuring `knowledgeSequence` is a **total order** across concurrent insertions.

### Evidence

```typescript
// Phase 3 uses knowledge_sequence for ordering
interface ProjectionEvent {
  type: 'KnowledgeCreated';
  knowledgeHash: string;
  knowledgeSequence: number;  // ← CRITICAL: How is this assigned?
}
```

**Question:** If two knowledge facts are inserted concurrently:
```
Thread A: knowledge.create(hash='abc', sequence=?)
Thread B: knowledge.create(hash='def', sequence=?)
```

How do we guarantee:
- Sequence A < Sequence B (or vice versa)
- All observers agree on ordering
- Replay produces same ordering

### Possible Implementations

**Option 1: Database sequence (PostgreSQL SERIAL)**
```sql
CREATE TABLE knowledge (
  id UUID PRIMARY KEY,
  hash TEXT UNIQUE NOT NULL,
  sequence SERIAL  -- Auto-increment
);
```

**Problem:** Database sequences are NOT guaranteed to be gapless or order-preserving under concurrent inserts.

**Option 2: Lamport timestamp**
```typescript
const sequence = Math.max(localCounter++, lastSeenSequence + 1);
```

**Problem:** Requires coordination between all inserters.

**Option 3: Total order broadcast (Kafka, Nan0)**
```typescript
await kafka.produce({ topic: 'knowledge', key: hash, value: knowledge });
const sequence = kafka.offset();
```

**Problem:** Introduces external dependency.

### Missing Architecture

**Current docs don't specify:**
- How `knowledgeSequence` is assigned
- Whether it's monotonic
- Whether it's total order or partial order
- How concurrent insertions are ordered

### Resolution
**NEEDS ARCHITECTURAL DECISION**

**Required:** Define `knowledgeSequence` assignment policy before Phase 3 implementation.

---

## ARCHITECTURAL RISK 2: `apply(event)` Semantics Undefined

### Finding
Phase 3 assumes:
> G6: Projection is idempotent

But `apply(event)` semantics are not defined.

### Evidence

```typescript
// Invariant G6: Applying same event multiple times produces same result
await backend.apply(event);
await backend.apply(event);  // Same event
await backend.apply(event);  // Same event
```

**Question:** What does "same event" mean?

**Scenario:**
```typescript
const event1: ProjectionEvent = {
  type: 'KnowledgeCreated',
  knowledgeHash: 'abc123',
  knowledgeSequence: 42,
  timestamp: new Date('2026-07-18T10:00:00Z')
};

const event2: ProjectionEvent = {
  type: 'KnowledgeCreated',
  knowledgeHash: 'abc123',  // Same content
  knowledgeSequence: 42,   // Same sequence
  timestamp: new Date('2026-07-18T10:00:05Z')  // Different timestamp!
};

// Are these "same events"?
await backend.apply(event1);
await backend.apply(event2);  // Idempotent? Or error?
```

### Possible Definitions

**Definition 1:** Event identity = knowledgeHash
- Same knowledge → same projection (idempotent)
- Timestamp irrelevant

**Definition 2:** Event identity = (knowledgeHash, sequence)
- Sequence matters for ordering
- Timestamp irrelevant

**Definition 3:** Event identity = full event content
- Timestamp matters
- Not truly idempotent

### Resolution
**NEEDS ARCHITECTURAL DECISION**

**Required:** Define event identity and idempotency semantics explicitly.

---

## ARCHITECTURAL RISK 3: Graphiti Ontology Leakage Not Verified

### Finding
Invariant G7 states:
> Backend Preserves Ontology

But there is no verification that Graphiti actually preserves the Phase 2 knowledge ontology.

### Evidence

**Phase 2 Ontology:**
```typescript
interface Knowledge {
  subject: string;
  predicate: string;
  object: string;
  type: 'fact' | 'relationship' | 'inference';
  confidence: number;
}
```

**Graphiti Ontology (assumed):**
```typescript
interface GraphitiNode {
  name: string;
  type: string;  // Is this 'fact' | 'relationship' | 'inference'?
  // ... other fields
}

interface GraphitiEdge {
  source: string;
  target: string;
  relation: string;  // Is this 'predicate'?
  // ... other fields
}
```

**Question:** Does Graphiti's ontology map 1:1 with Phase 2 knowledge?

**Risk:** If Graphiti's ontology is insufficient:
- Knowledge semantics may be lost
- Retrieval may return incomplete/wrong results
- Backend becomes source of truth (violates G2)

### Missing Architecture

- Mapping spec: `Knowledge → Graphiti` transformation
- Ontology verification tests
- Semantic preservation guarantee

### Resolution
**NEEDS VERIFICATION**

**Required:** Create Graphiti compatibility study (already started in `/scratch/GRAPHITI_GAPS.md`).

---

## ARCHITECTURAL RISK 4: Projection State Schema Not Defined

### Finding
Phase 3 mentions:
```
projection_state (domain state):
- knowledge_hash
- projection_status
- projection_version
- projected_at
```

But there is no migration or schema definition.

### Evidence

Searched for: `CREATE TABLE projection_state` → Not found  
Searched for: `migrations/008_*.sql` → Not found

### Resolution
**ACCEPT AS TODO**

This is expected since Phase 3 is in planning. However, the schema should be defined before implementation begins.

---

## ARCHITECTURAL RISK 5: Retrieval Contract Not Defined

### Finding
Phase 3 ends at projection verification, but the **retrieval contract** is not defined.

### Evidence

```
Phase 3: Projection Infrastructure
    ↓
Phase 4: Retrieval (NOT DEFINED)
```

**Question:** What must Phase 3 deliver to Phase 4?

**Options:**

**Option 1:** Retrieval queries Graphiti directly
```typescript
const results = await graphiti.search(query);
```

**Option 2:** Retrieval goes through abstraction layer
```typescript
const backend = new GraphitiBackend();
const results = await backend.retrieve(knowledgeHash);
```

**Option 3:** Retrieval only sees Knowledge types
```typescript
const results: Knowledge[] = await retrieval.query({ subject: 'build' });
```

### Why This Matters for Phase 3

If retrieval contract is Option 1:
- Phase 3 can use Graphiti-specific APIs
- Backend independence (G5) is violated

If retrieval contract is Option 3:
- Phase 3 must implement retrieval abstraction
- Backend replaceability is preserved

### Resolution
**NEEDS ARCHITECTURAL DECISION**

**Required:** Define retrieval contract before finalizing Phase 3 architecture.

---

## Summary of Findings

| Finding | Severity | Resolution |
|---------|----------|------------|
| `knowledgeSequence` not total order | HIGH | NEEDS ARCHITECTURAL DECISION |
| `apply(event)` semantics undefined | HIGH | NEEDS ARCHITECTURAL DECISION |
| Graphiti ontology leakage | HIGH | NEEDS VERIFICATION |
| Projection state schema missing | MEDIUM | ACCEPT AS TODO (expected) |
| Retrieval contract undefined | MEDIUM | NEEDS ARCHITECTURAL DECISION |

---

## Recommended Next Steps

1. **Define knowledge_sequence assignment policy**
   - Options: DB sequence, Lamport timestamp, Kafka offset
   - Document tradeoffs
   - Implement chosen approach

2. **Define event identity and idempotency**
   - What makes two events "same"?
   - How to handle retries?
   - Document in Phase 3 invariants

3. **Complete Graphiti compatibility study**
   - Map Phase 2 ontology → Graphiti schema
   - Identify gaps
   - Define transformation rules

4. **Define retrieval contract**
   - What abstractions does Phase 4 see?
   - How to preserve backend independence?

---

## Conclusion

The Phase 3 architecture documentation is **conceptually sound** but **incomplete in critical definitions**.

The invariants (G1-G8) are well-stated, but the mechanisms to enforce them are not specified.

**Overall assessment:** Phase 3 should not proceed to implementation until knowledge_sequence, event semantics, and retrieval contract are explicitly defined.
