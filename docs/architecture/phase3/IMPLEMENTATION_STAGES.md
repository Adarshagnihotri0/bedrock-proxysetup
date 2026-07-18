# Phase 3 Implementation Stages

**Status**: Ready to implement  
**Approach**: Validate assumptions, then build incrementally

---
## Stage 0: Domain ↔ Graphiti Compatibility Study (1-2 hours)

**Goal**: Map architecture concepts to Graphiti primitives before writing code

**What to do**:
- Study Graphiti API documentation
- Study Graphiti TypeScript types
- Map domain concepts to Graphiti primitives
- Fill in `scratch/COMPATIBILITY_STUDY.md` tables
- Document gaps in `scratch/GRAPHITI_GAPS.md`

**Deliverables**:
- Domain concept mapping table (Evidence, Knowledge, Subject, Predicate, Object, etc.)
- Graphiti primitives compatibility matrix
- Invariant compatibility check (G1-G8)
- Vocabulary leak detection plan

**Exit Criteria**:
- [ ] Domain concepts cleanly map to Graphiti primitives (or have ACCEPT/COMPENSATE strategy)
- [ ] No architectural invariant must be weakened
- [ ] No Graphiti internal types leak into core domain
- [ ] Rebuild remains deterministic
- [ ] Projection remains idempotent

**Pass**: Proceed to Stage 1  
**Fail**: Document gaps as REJECT, pivot architecture

**See**: `scratch/COMPATIBILITY_STUDY.md`, `scratch/GRAPHITI_GAPS.md`

---
## Stage 1: Graphiti Validation Spike (1-2 days)

**Goal**: Validate Graphiti can satisfy projection contract

**What to build**:
- Throwaway spike code in `scratch/graphiti-spike.ts`
- No architecture, no layers, direct Graphiti calls
- Tests 7 critical assumptions

**Questions**:
1. Can Graphiti create entities deterministically?
2. Can it upsert using knowledge hash?
3. Can it preserve provenance?
4. Can it update relationships?
5. Can it rebuild from scratch?
6. Can it delete everything?
7. Can it search as expected?

**Success**: All 7 tests pass → Proceed to Stage 2  
**Failure**: Document failures, consider alternative backends

**See**: `scratch/GRAPHITI_SPIKE_PLAN.md`

---

## Stage 2: Minimal Projection Backend (2-3 days)

**Goal**: Implement only the interface, nothing else

**What to build**:
```
src/projection/
    backend.ts              # ProjectionBackend interface
    graphiti-backend.ts    # Graphiti implementation
```

**What NOT to build**:
- ❌ No runtime
- ❌ No queue
- ❌ No workers
- ❌ No retries
- ❌ No batching

**Flow**:
```
Knowledge
    ↓
GraphitiProjection.apply(event)
    ↓
Graphiti
```

**Integration Tests**:

### Test 1: Projection Semantic Equivalence
```
Knowledge → Projection → Graphiti → Retrieve → Equivalent semantics
```

### Test 2: Rebuild Correctness
```
Delete Graph → Rebuild → Equivalent graph
```

### Test 3: Idempotency
```
Project same knowledge 100 times → Still exactly one representation
```

**Success**: All 3 tests pass → Proceed to Stage 3  
**Failure**: Debug backend, fix implementation

---

## Stage 3: Minimal Runtime (2-3 days)

**Goal**: Connect Knowledge events to backend

**What to build**:
```
src/projection/
    runtime.ts              # Minimal event processor
    state-tracker.ts        # Update projection_state
```

**Responsibilities**:
```
subscribe()
    ↓
receive event
    ↓
call backend.apply(event)
    ↓
update projection_state
```

**What NOT to build** (yet):
- ❌ No Kafka
- ❌ No BullMQ
- ❌ No Temporal
- ❌ No complex scheduling
- ❌ No batching optimization

**Just enough**: Prove architecture works end-to-end.

**Success**: Events flow → Graph projects → State tracked  
**Failure**: Debug runtime, event flow

---

## Milestones (Not Timelines)

### Milestone 0: Compatibility Study Complete
**Goal**: Validate domain concepts map to Graphiti  
**Evidence**: `scratch/COMPATIBILITY_STUDY.md` complete, gaps documented  
**Exit**: All gaps have ACCEPT/COMPENSATE decisions, proceed to Milestone A

---

### Milestone A: Spike Complete
**Criteria**: Graphiti can satisfy projection contract  
**Evidence**: `scratch/spike-results.md` documents all tests pass

---

### Milestone B: Backend Working
**Criteria**: `GraphitiProjection.apply(event)` works  
**Evidence**: All 3 integration tests pass

---

### Milestone C: Verification Working
**Criteria**: Semantic verification succeeds  
**Evidence**: Rebuild test passes, idempotency test passes

---

### Milestone D: Runtime Connected
**Criteria**: Knowledge → Event → Backend → Graph  
**Evidence**: End-to-end flow works

---

### Milestone E: Phase 3 Freeze
**Criteria**: All invariants tested, implementation working  
**Evidence**: 
- All G1-G8 invariants verified
- Integration tests pass
- Architecture validated

---

## What to Postpone

### Retrieval API (Phase 4)

**Why**: 
- Even though interface is designed, implementation should wait
- Discover what Graphiti is actually good at
- Experience should inform retrieval API

**When**: After Phase 3 frozen

---

## Risk Mitigation

### Biggest Risk: Graphiti

**Current State**: 
- Elegant architecture built around assumption: "Graphiti can faithfully represent our ontology"
- Assumption NOT yet validated

**Mitigation**:
1. Spike validates Graphiti FIRST
2. If Graphiti fails, know now (not after thousands of lines)
3. Alternative backends considered only if needed

---

## Implementation Order

```
0. ✅ Domain ↔ Graphiti compatibility study (Stage 0)
1. ✅ Graphiti spike with PASS/FAIL tests (Stage 1)
2. ✅ Document gaps and decisions (Stage 2)
3. ✅ Implement ProjectionBackend if architecture holds (Stage 3)
4. ✅ Add minimal runtime (Stage 4)
5. ✅ Freeze Phase 3 after invariants verified (Stage 5)
```

**Sequence minimizes risk**: Validate dependency first → Prove contract → Add operations

---

## Files to Create

### scratch/
```
scratch/
    GRAPHITI_SPIKE_PLAN.md  # Spike plan
    graphiti-spike.ts       # Spike implementation
    spike-results.md        # Spike findings
```

### src/projection/
```
src/projection/
    backend.ts              # ProjectionBackend interface
    graphiti-backend.ts     # Graphiti implementation
    runtime.ts              # Minimal runtime
    state-tracker.ts        # projection_state updates
```

### tests/integration/
```
tests/integration/
    projection.test.ts      # 3 core integration tests
```

---

## Success Philosophy

**Architecture is a hypothesis**. Implementation proves it.

**Perfection is the enemy of good**. Build minimal, validate, iterate.

**Evidence over elegance**. Real implementations reveal real problems.

---

## Next Action

Start Stage 1: Graphiti Spike.

**Goal**: "Does Graphiti fit our architecture?"  
**Not**: "Can we make our architecture fit Graphiti?"

If Graphiti fails, pivot architecture. If Graphiti works, prove architecture.

---

**Status**: Ready to create `scratch/graphiti-spike.ts`
