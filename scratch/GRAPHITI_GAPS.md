# Graphiti Integration Gaps

**Purpose**: Document every mismatch between architecture and Graphiti  
**Status**: Empty (will be filled during Stage 0 study)

---

## Gap Template

```markdown
## Gap #N: [Gap Title]

**Domain Concept**: [What architecture needs]

**Graphiti Primitive**: [What Graphiti provides]

**Mismatch**: [Description of the gap]

**Impact**: 
- Which invariant is affected? (G1-G8)
- Does it weaken architecture?
- Can it be compensated?

**Decision**: 
- ACCEPT: [Translation strategy]
- COMPENSATE: [Workaround]
- REJECT: [If gap is fatal]

**Implementation**:
- Where does translation happen? (GraphitiProjection)
- Does it leak types? (Yes/No)
- Does it weaken invariants? (Yes/No)
```

---

## Gap Examples (Template Only)

### Gap #1: Entity Identity Mismatch

**Domain Concept**: Knowledge uses content-hash for identity (`knowledge:abc123`)

**Graphiti Primitive**: Uses UUIDs for entity identity

**Mismatch**: Architecture needs deterministic identity from content, Graphiti assigns random UUIDs

**Impact**:
- G1 (Deterministic) at risk
- G6 (Idempotency) harder to implement
- Search by hash requires custom index

**Decision**: ACCEPT with compensation
- Use content-hash as entity property
- Add unique constraint on hash property
- Translate UUID ↔ Hash inside GraphitiProjection

**Implementation**:
- Where: `GraphitiProjection.apply()` translates
- Leaks types: No (UUID never exposed to domain)
- Weakens invariants: No (determinism preserved through property)

---

### Gap #2: Temporal Query Limitation

**Domain Concept**: Architecture needs query-at-time-T for replay

**Graphiti Primitive**: No built-in temporal query support

**Mismatch**: Should support temporal queries for semantic verification

**Impact**:
- G1 (Rebuild) requires snapshot
- G7 (Semantic comparison) requires versioning

**Decision**: COMPENSATE
- Store timestamps on nodes/edges
- Implement custom temporal query logic
- May need additional metadata layer

**Implementation**:
- Where: `RetrievalContract.timeline()` implementation
- Leaks types: No
- Weakens invariants: No (temporal logic implemented correctly)

---

## Categories of Gaps

### Type 1: Identity & Determinism
- Content-hash vs UUID
- Idempotent creation
- Duplicate detection

### Type 2: Relationship Semantics
- Bidirectional vs unidirectional
- Edge properties vs node properties
- Relationship types

### Type 3: Provenance & Metadata
- Evidence array storage
- Provenance queryability
- Metadata preservation

### Type 4: Temporal & Versioning
- Version history
- Snapshot capabilities
- Temporal queries

### Type 5: Search & Retrieval
- Query capabilities
- Return types
- Traversal semantics

### Type 6: Type System Leaks
- Graphiti types in domain code
- API surface contamination
- Vocabulary mismatch

---

## Decision Framework

**ACCEPT**: Gap can be translated cleanly
- Translation isolated to GraphitiProjection
- No type leaks
- No invariant weakening
- Performance acceptable

**COMPENSATE**: Gap requires additional logic
- May need helper layer
- Performance impact acceptable
- Complexity manageable
- Invariants preserved

**REJECT**: Gap is fatal to architecture
- Invariant cannot be preserved
- Type system fundamentally incompatible
- Performance unacceptable
- Architecture must pivot

---

## Reporting

After study, report:

```
Total Gaps Found: X
  - ACCEPT: Y
  - COMPENSATE: Z
  - REJECT: W (architecture change needed)

Critical Gaps: [List REJECT items]
Acceptable Gaps: [List ACCEPT/COMPENSATE items]
```

---

## Links

- Compatibility Study: `scratch/COMPATIBILITY_STUDY.md`
- Spike Plan: `scratch/GRAPHITI_SPIKE_PLAN.md`
- Architecture: `phase3/ARCHITECTURE.md`
- Invariants: `phase3/INVARIANTS.md`
