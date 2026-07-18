# Stage 0: Domain ↔ Graphiti Compatibility Study

**Goal**: Map architecture concepts to Graphiti primitives before writing code  
**Duration**: 1-2 hours  
**Deliverable**: Compatibility report (this document)

---

## Domain Concept Mapping

| Architecture Concept | Graphiti Concept | Match? | Notes |
|---------------------|------------------|--------|-------|
| **Evidence** | ? | ✅/❌ | *fill during study* |
| **Knowledge** | ? | ✅/❌ | *fill during study* |
| **Subject** | ? | ✅/❌ | *fill during study* |
| **Predicate** | ? | ✅/❌ | *fill during study* |
| **Object** | ? | ✅/❌ | *fill during study* |
| **Support** | ? | ✅/❌ | *fill during study* |
| **Provenance** | ? | ✅/❌ | *fill during study* |
| **Version** | ? | ✅/❌ | *fill during study* |
| **Temporal Updates** | ? | ✅/❌ | *fill during study* |

**Match Criteria**:
- ✅ Clean 1:1 mapping (no translation layer)
- ⚠️ Mappable with translation (acceptable)
- ❌ No clean mapping (architecture risk)

---

## Graphiti Primitives Study

### Core Concepts

**Question**: What are Graphiti's fundamental building blocks?

**Sources to Study**:
- Graphiti documentation
- Graphiti API reference
- Graphiti examples
- Graphiti TypeScript types

**Document**:
```
Graphiti Primitives:
1. [primitive name] - [description]
2. [primitive name] - [description]
3. [primitive name] - [description]
```

---

### Entity Model

**Question**: How does Graphiti represent entities?

**Study**:
- Entity creation API
- Entity identity (IDs, hashes)
- Entity metadata
- Entity types/labels

**Map to**: Architecture's "Subject" and "Object"

**Potential Gaps**:
- Architecture uses content-hash for identity
- Does Graphiti support content-hash identity? Or UUIDs?
- Translation required?

---

### Relationship Model

**Question**: How does Graphiti represent relationships?

**Study**:
- Edge creation API
- Edge directionality
- Edge types (predicates)
- Edge metadata

**Map to**: Architecture's "Predicate"

**Potential Gaps**:
- Architecture has bidirectional "Support" relationship
- Does Graphiti support bidirectional? Or directed only?
- Edge properties vs. node properties?

---

### Temporal Model

**Question**: How does Graphiti handle time/versioning?

**Study**:
- Temporal indexing
- Version history
- Time-based queries
- Snapshot capabilities

**Map to**: Architecture's "Temporal Updates"

**Potential Gaps**:
- Architecture needs temporal replay
- Does Graphiti support temporal queries?
- How to implement "Knowledge at time T"?

---

### Provenance Model

**Question**: How does Graphiti track provenance?

**Study**:
- Metadata fields
- Custom properties
- Embedded provenance
- Query by provenance

**Map to**: Architecture's "Provenance" (Evidence sources, trace IDs)

**Potential Gaps**:
- Architecture has multi-source provenance (Evidence array)
- How to represent in Graphiti?
- Graphiti-specific types leak into domain?

---

### Search Model

**Question**: How does Graphiti search/query?

**Study**:
- Query API
- Traversal capabilities
- Filter capabilities
- Return types

**Map to**: Architecture's "Retrieval Contract" (related, timeline, neighborhood)

**Potential Gaps**:
- Architecture returns `Knowledge[]`
- Graphiti returns graph-specific types
- Translation required in Retrieval layer?

---

### Persistence Model

**Question**: How does Graphiti persist data?

**Study**:
- Backend storage (Neo4j, Memgraph)
- Schema constraints
- Indexing
- Unique constraints

**Map to**: Architecture's "projection_state"

**Potential Gaps**:
- Architecture needs content-hash uniqueness
- Does Graphiti support hash-based uniqueness?
- Or UUID-based only?

---

## Architecture Invariant Compatibility

| Invariant | Graphiti Support | Notes |
|-----------|-------------------|-------|
| **G1: Deterministic** | ✅/❌ | Can Graphiti produce deterministic projections? |
| **G2: Source of Truth** | ✅/❌ | Can graph be deleted and rebuilt from Knowledge? |
| **G3: Failure Isolation** | ✅/❌ | Can Graphiti errors be contained to projection layer? |
| **G4: Events as Signals** | ✅/❌ | Can Graphiti consume events without internal types? |
| **G5: Runtime Replaceable** | ✅/❌ | Is Graphiti independent of runtime infrastructure? |
| **G6: Idempotent** | ✅/❌ | Can Graphiti handle duplicate events (upsert)? |
| **G7: Ontology Preservation** | ✅/❌ | Does meaning survive projection? |
| **G8: Single Source** | ✅/❌ | No bypassing layers? |

**Pass Criteria**: All invariants preserved without weakening.

---

## Vocabulary Leak Detection

**Architecture Vocabulary** (keep pure):
- Evidence
- Knowledge
- Support
- Subject
- Predicate
- Object
- Projection

**Graphiti Vocabulary** (keep isolated):
- Episode
- Entity
- Edge
- Node
- [Any Graphiti-specific terms]

**Rule**: Graphiti vocabulary ONLY appears inside `GraphitiProjection`.

**Test**:
```
grep -r "Episode" src/projection/
# Should only match in graphiti-backend.ts

grep -r "from 'graphiti'" src/
# Should only appear in graphiti-backend.ts
```

---

## Type Compatibility

**Question**: Do Graphiti types leak into domain?

**Study**:
```typescript
// What does Graphiti return?
const entity = await graphiti.getEntity(id);

// Type inspection
type GraphitiEntity = {
  // List all fields
};

// Does it match our Knowledge?
interface Knowledge {
  hash: string;
  subject: Entity;
  predicate: Relation;
  object: Entity;
  support: Evidence[];
  provenance: Provenance;
}
```

**Gap Analysis**:
- Missing fields?
- Extra fields?
- Type mismatches?
- Translation layer needed where?

---

## API Surface Study

**Question**: What Graphiti APIs will we use?

**Document**:
```typescript
// Core APIs needed:
class GraphitiClient {
  // Entity operations
  createEntity(id, type, data): Entity;
  getEntity(id): Entity;
  updateEntity(id, data): Entity;
  deleteEntity(id): void;
  
  // Edge operations
  createEdge(from, to, type, data): Edge;
  getEdges(nodeId): Edge[];
  
  // Query operations
  search(query): Result[];
  traverse(startId, direction): Node[];
}

// Translation needed for each API?
```

---

## Acceptance Tests (Spike Validation)

**Before starting spike, define PASS/FAIL criteria**:

### Test 1: Entity Identity
```
Given: knowledge hash "k:abc123"
When: project twice
Expected: one entity in Graphiti
Pass: entity count === 1
Fail: entity count > 1
```

### Test 2: Relationship Semantics
```
Given: User-[CREATED]->Trace
When: retrieve relationship
Expected: semantic meaning preserved
Pass: user.created.includes(trace) or equivalent
Fail: meaning corrupted or lost
```

### Test 3: Provenance Preservation
```
Given: knowledge with evidence [e1, e2]
When: project to Graphiti
Expected: provenance queryable
Pass: getProvenance(k) returns [e1, e2]
Fail: provenance lost or incomplete
```

### Test 4: Rebuild Determinism
```
Given: knowledge graph G1
When: delete all, rebuild
Expected: graph G2 semantically equivalent
Pass: semantic_compare(G1, G2) === true
Fail: semantic drift detected
```

### Test 5: Idempotency
```
Given: same event applied 100 times
Expected: single projection
Pass: count === 1
Fail: count > 1
```

### Test 6: Temporal Query
```
Given: knowledge created at T1, updated at T2
When: query at T1
Expected: original state
Pass: state matches T1
Fail: returns T2 state or fails
```

### Test 7: No Type Leaks
```
Given: projection implementation
When: grep for Graphiti types outside backend
Expected: zero matches
Pass: no leaks found
Fail: Graphiti vocabulary detected in domain
```

---

## Compatibility Report Template

**Status**: In Progress  
**Date**: 2026-07-18

**Overall**: ✅ Compatible / ⚠️ Mappable / ❌ Incompatible

**Critical Gaps**:
1. [List any ❌ mappings]
2. [List any architecture risks]

**Acceptable Gaps** (translatable):
1. [List ⚠️ mappings with translation strategy]
2. [List workarounds]

**Recommendation**: 
- Proceed to spike / 
- Pivot architecture / 
- Reject Graphiti

---

## Exit Criteria

**Stage 0 succeeds only if**:
- [ ] Domain concepts cleanly map to Graphiti primitives
- [ ] No architectural invariant (G1-G8) must be weakened
- [ ] No Graphiti internal types leak into core domain
- [ ] Rebuild remains deterministic
- [ ] Projection remains idempotent

**If ANY criterion fails**: Document gap in `scratch/GRAPHITI_GAPS.md` and assess impact.

---

## Next Steps

**After study completion**:
1. Fill in all mapping tables
2. Document gaps (if any)
3. Write compatibility recommendation
4. Proceed to Stage 1 (spike) only if compatible

**Study Sources**:
- Graphiti GitHub repository
- Graphiti documentation
- Graphiti TypeScript type definitions
- Graphiti examples/tutorials

---

**Current Status**: Study not yet started. Need to examine Graphiti API documentation.
