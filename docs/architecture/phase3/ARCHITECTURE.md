# Architecture Evolution Log

**Purpose**: Track architectural pivots and lessons learned.

---

## 2026-07-18: Phase 3 Roadmap V3

### Architectural Refinement: Infrastructure Boundaries

**Changes:**

1. **Removed Queue from Architecture**
   - Queue is implementation detail, not architecture
   - Replaced with "Projection Runtime" concept
   - Runtime is replaceable infrastructure (BullMQ, Temporal, Kafka)

2. **Separated Concerns**
   - Projection Runtime (operational): retries, scheduling, batching, recovery
   - Projection Backend (domain): Knowledge → Graphiti mapping
   - Projection State (domain): knowledge_hash, projection_status, version

3. **Renamed projection_metadata → projection_state**
   - Metadata implies description
   - State implies runtime reality
   - Only domain state, not operational state

4. **Moved Retrieval to Phase 4**
   - Retrieval is product behavior, not infrastructure
   - Phase 3 ends at projection verification
   - Clean separation: Infrastructure vs Product

5. **Content-Addressable Events**
   - Events carry `knowledge_hash`, not mutable IDs
   - Consistent with Phase 1/2 philosophy
   - Idempotency trivial

6. **Removed Retry Counters from Canonical DB**
   - Operational state belongs in runtime (Temporal UI, etc.)
   - Domain state belongs in projection_state
   - Separation enables runtime swapping

7. **Six Critical Invariants**
   - G1: Deterministic projection
   - G2: Knowledge is source of truth
   - G3: Projection failures never affect Knowledge
   - G4: Projection events are signals
   - G5: Runtime is replaceable infrastructure
   - G6: Projection is idempotent

---

## Phase Progression

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

Each phase has exactly one responsibility.

---

## Architectural Principles

### Queue is NOT Architecture

Events are architecture. Queues are implementation.

**Wrong:**
```
Knowledge → Queue → Worker → Graph
```

**Right:**
```
Knowledge → Event → Runtime → Backend → Graph
```

Runtime is replaceable. Event is architecture.

---

### Operational vs Domain State

**Operational State (in Runtime):**
- retry_count
- last_error
- scheduled_at
- worker_id

**Domain State (in projection_state):**
- knowledge_hash
- projection_status
- projection_version
- projected_at

---

### Content-Addressable Philosophy

All three layers use content-addressable identity:
- Evidence: `evidence_hash`
- Knowledge: `knowledge_hash`
- Projection: carries `knowledge_hash`

Benefits:
- Deterministic
- Idempotent
- Replayable
- Auditable

---

## Lessons Learned

1. **Don't reinvent** - Use Graphiti instead of building custom graph engine
2. **Queue is detail** - Architecture defines events, not queues
3. **Separate concerns** - Runtime (operational) vs Backend (domain)
4. **Content-addressable** - Carries through all layers
5. **Phases are focused** - One responsibility per phase
6. **Operational state elsewhere** - Don't pollute canonical DB with retry counters

---

## Key Architect

User feedback was critical for refactoring:

1. **Graphiti pivot**: Stop building custom reasoning, use Graphiti
2. **Queue removal**: Queue is implementation detail
3. **State separation**: Domain vs operational state
4. **Phase boundaries**: End Phase 3 at verification, not retrieval
5. **Content-addressable events**: Use hashes, not IDs

---

## References

- Phase 1: Evidence Layer (Frozen)
- Phase 2: Knowledge Extraction (Frozen)
- Phase 3: Projection Infrastructure (Planning)
- `/archive/phase3-roadmap-custom-reasoning.md` - Custom reasoning approach (archived)
