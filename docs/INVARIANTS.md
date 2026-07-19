# System Invariants

**Purpose:** Document all assumptions the system is built on.

**Definition:** An invariant is a property that must always hold. If it doesn't, the system fails explicitly (not silently).

---

## Invariant Categories

### Layer 1: Runtime Invariants (Always Enforced)

These run in production code. If violated, the operation fails immediately.

| Invariant | Enforced | Tested | Notes |
|-----------|----------|--------|-------|
| Knowledge.id unique | Neo4j constraint | ✅ | `knowledge_id_unique` prevents duplicates |
| Embedding dimension matches provider | Runtime check | ⏳ | Rejects invalid embeddings before persistence |
| Embedding metadata complete-or-absent | Runtime check | ⏳ | Never allow partial states (embedding exists, model missing) |
| Hydration returns exactly one row | Runtime check | ⏳ | Neo4j hit must exist in PostgreSQL |

---

### Layer 2: Integration Tests (CI)

These run in automated test suite. If failed, build fails.

| Test | Location | Status | Notes |
|------|----------|--------|-------|
| Retrieval pipeline | `tests/integration/retrieval.spec.ts` | ⏳ TODO | PostgreSQL → Neo4j → Hydration |
| Backfill idempotency | `tests/integration/backfill.spec.ts` | ⏳ TODO | Run twice, measure 0 changes |
| Projection replay | `tests/integration/projection.spec.ts` | ⏳ TODO | Delete, replay, hash match |

---

### Layer 3: Operational Validation (Scripts)

These run by engineers. Not in CI. Produce evidence for architecture decisions.

| Script | Purpose | Evidence Produced |
|--------|---------|-------------------|
| `embeddings-backfill.ts` | Populate embeddings | Node count, throughput |
| `test-backfill-properties.ts` | Validate properties | Idempotency, resumability |
| `test-retrieval-integration.ts` | End-to-end validation | Query → Knowledge[] |
| `benchmark-retrieval.ts` | Performance baseline | Latency, throughput |

---

## Invariant Details

### 1. Knowledge.id Uniqueness

**What:** Every Knowledge node has exactly one unique identifier.

**Why:** Prevents duplicate knowledge in graph. Enables idempotent replay.

**Enforcement:** Neo4j constraint `knowledge_id_unique`

**Validation:** `scripts/milestone-3-constraint.ts`

```cypher
CREATE CONSTRAINT knowledge_id_unique IF NOT EXISTS
FOR (k:Knowledge)
REQUIRE k.id IS UNIQUE
```

---

### 2. Embedding Dimension Validation

**What:** Generated embeddings must match provider dimension.

**Why:** Prevents dimension mismatches between provider and vector index.

**Enforcement:** Runtime check in backfill script

**Code:**
```typescript
if (embedding.length !== provider.dimension) {
  throw new Error(`Expected ${provider.dimension}, got ${embedding.length}`);
}
```

**Effect:** Rejects invalid embeddings before persistence.

---

### 3. Embedding Metadata Completeness

**What:** Embedding metadata must be complete or absent.

**Why:** Prevents partial states that break migrations.

**Enforcement:** Runtime check in validation function

**Allowed states:**
- ✅ No embedding, no model, no dimension (not yet embedded)
- ✅ embedding + model + dimension + embeddedAt (complete)
- ❌ embedding exists, model missing (incomplete)

**Code:**
```typescript
export function validateEmbeddingConsistency(node: EmbeddingConsistency): void {
  const hasAny = node.hasEmbedding || node.embedding || node.model || node.dimension;
  const hasAll = node.hasEmbedding && node.embedding && node.model && node.dimension;
  
  if (hasAny && !hasAll) {
    throw new Error(`Embedding metadata incomplete`);
  }
}
```

---

### 4. Hydration Uniqueness

**What:** Every Neo4j hit must hydrate exactly one PostgreSQL row.

**Why:** Ensures PostgreSQL-Neo4j consistency.

**Enforcement:** Runtime check in retrieval service

**Code:**
```typescript
const pgCheck = await pgPool.query('SELECT hash FROM knowledge WHERE hash = $1', [result.id]);
if (pgCheck.rows.length !== 1) {
  throw new Error(`Expected 1 row, got ${pgCheck.rows.length}`);
}
```

---

### 5. Replay Idempotency

**What:** Replaying identical input produces identical canonical serialization.

**Why:** Enables safe rebuild from source of truth.

**Reference:** [Canonical Protocol Specification](CANONICAL_PROTOCOL_INTEGRATION.md)

**Enforcement:** Property test

**Validation:** `scripts/milestone-2-semantic-v2.ts`

**Evidence:**
- First run hash: `aa99493ab5c85d632...`
- Second run hash: `aa99493ab5c85d632...`
- Match: ✅

---

### 6. Projection Determinism

**What:** Canonical serialization is preserved after delete + replay.

**Why:** Proves graph can be rebuilt from PostgreSQL.

**Reference:** [Canonical Protocol Specification](CANONICAL_PROTOCOL_INTEGRATION.md)

**Enforcement:** Canonical serialization test

**Validation:** `scripts/milestone-1-replay.ts` + `scripts/milestone-2-semantic-v2.ts`

**Evidence:**
- Delete graph → Replay → Hash matches original
- SHA-256 comparison proves content preservation

---

## Adding New Invariants

When adding a new invariant:

1. **Define it here** (what, why, how enforced)
2. **Enforce it** (runtime check or constraint)
3. **Test it** (unit, integration, or script)
4. **Document status** (✅ validated, ⏳ needs evidence, ❌ violated)

---

## Invariant Violations

If an invariant is violated:

1. **Fail fast** - throw error, reject operation
2. **Log context** - include relevant IDs, values, state
3. **Don't silent-fail** - never allow partial/inconsistent state
