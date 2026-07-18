# Phase 3: Complete Documentation Index

**Status**: Frozen  
**Date**: 2026-07-18

---

## Core Architecture Documents

### 1. ARCHITECTURE.md
**Purpose**: High-level architectural overview  
**Status**: Frozen  
**Key Content**:
- Layer structure
- Source of truth chain
- Event flow
- State separation
- Domain vocabulary

---

### 2. INVARIANTS.md
**Purpose**: Architectural contracts (G1-G8)  
**Status**: Frozen  
**Key Content**:
- G1: Deterministic projection
- G2: Knowledge is source of truth
- G3: Projection failures never affect Knowledge
- G4: Projection events are signals
- G5: Runtime is replaceable infrastructure
- G6: Projection is idempotent
- G7: Backend preserves ontology
- G8: Every layer has one upstream source

**Enforcement**: All implementations must preserve these invariants.

---

### 3. PROJECTION_SPEC.md
**Purpose**: Interface contracts and schemas  
**Status**: Frozen  
**Key Content**:
- `ProjectionEvent` interface
- `ProjectionBackend` interface
- `RetrievalContract` interface (Phase 4)
- Database schema (projection_state)
- Event types (Created, Supported, Archived)
- Monotonic projection principle

---

### 4. VERIFICATION.md
**Purpose**: Rebuild and drift detection strategy  
**Status**: Frozen  
**Key Content**:
- Semantic verification process
- Verification types (per-knowledge, full graph, drift detection)
- Rebuild algorithm
- Failure detection
- Backend-agnostic comparison

---

### 5. ADR-003.md
**Purpose**: Canonical domain boundary definition  
**Status**: Frozen  
**Key Content**:
- Seven layers, one responsibility each
- Domain boundaries
- Consequences
- Enforcement mechanism

---

### 6. FREEZE_CERTIFICATE.md
**Purpose**: Architecture freeze declaration  
**Status**: Frozen  
**Key Content**:
- Frozen invariants list
- Frozen vocabulary
- Frozen interfaces
- Change process
- Implementation philosophy

---

### 7. ROADMAP.md
**Purpose**: Implementation milestones  
**Status**: Active (implementation guide)  
**Key Content**:
- Phase 3.1-3.4 deliverables
- Timeline
- Success criteria
- Exit criteria

---

### 8. ARCHITECTURE_EVOLUTION.md (This document)
**Purpose**: Evolution log and history  
**Status**: Frozen  
**Key Content**:
- Design journey from custom reasoning to Graphiti projection
- Key pivots and decisions
- Lessons learned

---

## Document Relationships

```
FREEZE_CERTIFICATE.md
        │
        └─→ INVARIANTS.md (G1-G8)
                │
                └─→ ARCHITECTURE.md (layer structure)
                        │
                        └─→ PROJECTION_SPEC.md (interfaces)
                                │
                                └─→ VERIFICATION.md (testing)
```

---

## Implementation Checklist

**Pre-Implementation**:
- [x] Architecture frozen
- [x] Invariants documented
- [x] Interfaces specified
- [x] Domain boundaries established
- [x] Vocabulary standardized

**Implementation**:
- [ ] ProjectionEvent emission
- [ ] ProjectionBackend interface
- [ ] Graphiti implementation
- [ ] projection_state table
- [ ] Verification suite

**Post-Implementation**:
- [ ] All invariants tested
- [ ] Idempotency verified
- [ ] Rebuild succeeds
- [ ] Semantic verification working

---

## Vocabulary Enforcement

**Use**:
- Evidence (not "Memory")
- Knowledge (not "Facts")
- Projection (not "Graph view")
- Backend (not "Graphiti" in architecture)

**Code Review Checklist**:
- [ ] No Graphiti-specific terminology in domain code
- [ ] No Evidence imports in Reasoning layer
- [ ] No layer bypass
- [ ] Consistent domain vocabulary

---

## Change Process

**To modify architecture**:
1. Write ADR documenting problem
2. Demonstrate need with evidence
3. Update invariants if needed
4. Update all affected documents
5. Re-test all invariants
6. Update freeze certificate

**No ad-hoc changes.**

---

## References

- Phase 1: `phase1/` (Evidence Layer)
- Phase 2: `phase2/` (Knowledge Extraction)
- Phase 3: `phase3/` (This directory)
- ADRs: `phase1/ADR.md`, `phase2/ADR-002.md`, `phase3/ADR-003.md`

---

**Architecture is frozen. Implementation begins.**
