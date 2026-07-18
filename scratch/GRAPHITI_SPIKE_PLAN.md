# Stage 1: Graphiti Spike - Validation Plan

**Goal**: Validate Graphiti assumptions before architecture implementation  
**Duration**: 1-2 days  
**Approach**: Throwaway spike code

---

## Questions to Answer

### 1. Deterministic Entity Creation (G1)

**Question**: Can Graphiti create entities deterministically using our knowledge hash?

**Test**:
```typescript
// Given same hash
const hash1 = 'knowledge:abc123';
const hash2 = 'knowledge:abc123';

// When creating entities
const entity1 = await graphiti.createEntity(hash1, data);
const entity2 = await graphiti.createEntity(hash2, data);

// Then should be equivalent
assert(entity1.id === entity2.id || entity1.data === entity2.data);
```

**Pass Criteria**: Same hash → Same/Equivalent entity.

---

### 2. Content-Addressable Upsert (G1, G6)

**Question**: Can we upsert using knowledge hash?

**Test**:
```typescript
const hash = 'knowledge:xyz789';

// First insert
await graphiti.upsertEntity(hash, data_v1);

// Update (upsert)
await graphiti.upsertEntity(hash, data_v2);

// Should have ONE entity, not two
const count = await graphiti.countEntities({ hash });
assert(count === 1);
```

**Pass Criteria**: Upsert works. No duplicates.

---

### 3. Provenance Preservation (G7)

**Question**: Can we preserve Knowledge provenance?

**Test**:
```typescript
const knowledge = {
  hash: 'k:123',
  evidenceSources: ['e:1', 'e:2'],
  traceId: 'trace-abc'
};

await graphiti.createEntity(knowledge.hash, {
  provenance: {
    knowledgeHash: knowledge.hash,
    evidenceSources: knowledge.evidenceSources,
    traceId: knowledge.traceId
  }
});

const retrieved = await graphiti.getEntity(knowledge.hash);
assert(retrieved.provenance.knowledgeHash === knowledge.hash);
assert(retrieved.provenance.traceId === knowledge.traceId);
```

**Pass Criteria**: Provenance survives projection.

---

### 4. Relationship Updates (G7)

**Question**: Can we update relationships while preserving semantics?

**Test**:
```typescript
// Knowledge v1
await graphiti.createRelationship('user:alice', 'CREATED', 'trace:123');

// Support added (Knowledge v2)
await graphiti.createRelationship('user:bob', 'SUPPORTS', 'trace:123');

// Should preserve both relationships
const edges = await graphiti.getEdges('trace:123');
assert(edges.some(e => e.type === 'CREATED'));
assert(edges.some(e => e.type === 'SUPPORTS'));
```

**Pass Criteria**: Semantic relationships preserved.

---

### 5. Graph Rebuild (G2)

**Question**: Can we delete and rebuild from Knowledge?

**Test**:
```typescript
// Setup: Create some Knowledge
await createKnowledge(...);

// Project
await graphiti.project(knowledge);

// Verify exists
const before = await graphiti.getAll();

// Delete all
await graphiti.deleteAll();

// Verify empty
assert(await graphiti.countEntities() === 0);

// Rebuild
await graphiti.rebuild();

// Should be equivalent
const after = await graphiti.getAll();
assert(equivalent(before, after));
```

**Pass Criteria**: Rebuild produces equivalent graph.

---

### 6. Complete Deletion (G2)

**Question**: Can we delete everything?

**Test**:
```typescript
// Create entities
await graphiti.createEntity('test:1', {});
await graphiti.createEntity('test:2', {});

// Delete all
await graphiti.deleteAll();

// Verify
const count = await graphiti.countEntities();
assert(count === 0);
```

**Pass Criteria**: Clean slate achievable.

---

### 7. Search Semantics (Phase 4 Preview)

**Question**: Can Graphiti search how we expect?

**Test**:
```typescript
// Create knowledge graph
await graphiti.createEntity('user:alice', { type: 'User' });
await graphiki.createEntity('trace:123', { type: 'Trace' });
await graphiti.createRelationship('user:alice', 'CREATED', 'trace:123');

// Search: related
const related = await graphiti.related('trace:123', 'CREATED');
assert(related.some(r => r.id === 'user:alice'));

// Search: neighborhood
const neighborhood = await graphiti.neighborhood('trace:123', depth: 1);
assert(neighborhood.length > 0);

// Search: timeline
await graphiti.createEntity('trace:456', { created_at: '2026-07-18' });
const timeline = await graphiti.timeline('trace:123', 'after');
assert(timeline.some(t => t.id === 'trace:456'));
```

**Pass Criteria**: Search matches our retrieval contract.

---

## Spike Structure

```
scratch/
    graphiti-spike.ts       # Main spike code
    graphiti-test-utils.ts  # Test helpers
    spike-results.md        # Document findings
```

---

## Success Criteria

**Pass**: Graphiti satisfies all 7 tests  
**Fail**: Graphiti fails one or more tests (requires architecture adjustment)

---

## If Tests Fail

**Fail Mode 1**: Non-deterministic
- Impact: G1 violated
- Mitigation: Find deterministic mode or change backend

**Fail Mode 2**: Cannot upsert
- Impact: G6 violated (duplicates)
- Mitigation: Manual deduplication layer

**Fail Mode 3**: Provenance lost
- Impact: G7 violated
- Mitigation: Embed provenance in entity data

**Fail Mode 4**: Rebuild fails
- Impact: G2 violated
- Mitigation: Export/import strategy

**Fail Mode 5**: Search doesn't match
- Impact: Phase 4 design
- Mitigation: Adjust retrieval contract to match Graphiti capabilities

---

## What This Spike Is NOT

- NOT production code (throwaway)
- NOT using our architecture (direct Graphiti calls)
- NOT worrying about performance (correctness first)
- NOT implementing runtime (no queues, no workers)

---

## What This Spike IS

- Validation of architectural assumptions
- Direct test of external dependency
- Evidence gathering for architecture decisions
- Risk mitigation before implementation

---

## Spike Exit Decision

**If all tests pass**: Proceed to Stage 2 (ProjectionBackend implementation)

**If tests fail**: 
1. Document failures in `spike-results.md`
2. Assess whether architecture can adapt
3. Consider alternative backends (Neo4j, Memgraph)
4. Write ADR if architecture needs adjustment

---

## Timeline

- Day 1: Tests 1-4 (creation, upsert, provenance, relationships)
- Day 2: Tests 5-7 (rebuild, deletion, search)
- End of Day 2: Document results, proceed to Stage 2

---

**Next Step**: Create `scratch/graphiti-spike.ts`
