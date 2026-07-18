# Projection Backend Exit Criteria

**Purpose:** Define "done" for projection layer, then shift to differentiated features.

## Exit Checklist

| Item | Status | Evidence |
|------|--------|----------|
| Replay correctness | ✅ | M1: 1001 rows → 1001 nodes |
| Replay metrics | ✅ | 206 facts/sec, reproducible |
| Canonical serialization check | ✅ | SHA-256 hash comparison |
| Idempotency | ✅ | Second replay produces identical hash |
| Unique constraints | ✅ | Database invariant enforced |
| Relationship preservation | ⏳ | Not yet tested |
| Crash recovery | ⏳ | Checkpoint designed, not implemented |
| Order independence | ⏳ | Not yet tested |
| 50k+ replay | ⏳ | Only tested 1001 |
| Continuous ingestion | ⏳ | Not yet tested |

## Next Validation Targets

### 1. Relationship Projection (HIGHEST PRIORITY)
Prove edges survive replay:
```
Knowledge A ──supports──► Knowledge B

After rebuild:
- Same nodes
- Same relationships  
- Same relationship properties
```

**Script:** `scripts/validate-relationships.ts`

---

### 2. Crash Recovery
Implement and test checkpoint resume:
```
1000 events → project 430 → save checkpoint → kill
restart → resume from 431 → verify graph hash
```

**Script:** `scripts/validate-crash-recovery.ts`

---

### 3. Order Independence
Shuffle replay order, verify hash match:
```
Run A: 1, 2, 3, 4, 5
Run B: 4, 1, 5, 2, 3

Expected: Same canonical hash
```

**Script:** `scripts/validate-order-independence.ts`

---

### 4. Scale Testing
10k, 50k, 100k events:
- Elapsed time
- Throughput degradation
- Peak RSS
- GC pauses
- Neo4j write time

**Script:** `scripts/benchmark-scale.ts`

---

### 5. Continuous Ingestion
Realistic production pattern:
```
Insert row → projection runs → verify graph → repeat (10k iterations)
```

**Script:** `scripts/validate-continuous-ingestion.ts`

---

## Stopping Condition

**Stop working on projection layer when:**
- ✅ 6 items in exit checklist validated
- ⏳ Remaining items documented as "future work"

**Then shift focus to:** Semantic search, reasoning, lineage, provenance, graph queries, agent memory.

---

## Diminishing Returns

Avoid further:
- Markdown report revisions
- Architecture documents
- Validation matrices
- Claim wording changes

Those don't increase confidence.

---

**Generated:** 2026-07-19
**Source:** User guidance on validation priorities
