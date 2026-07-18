# Phase 1: Evidence Layer

**Goal:** Capture everything. Never lose information.

---

## Verification Criteria (Must Pass Before Phase 2)

### ✓ Every event has provenance
- Source identified (git, terminal, test, etc.)
- Timestamp captured
- Repository tracked
- Session ID attached
- Unique ID assigned

### ✓ Duplicate rate < 2%
- Content hashing (SHA-256)
- Exact duplicates rejected
- Near-duplicates flagged

### ✓ SHA hash identical for identical evidence
- Same content → Same hash
- Deterministic hashing
- No random IDs in hash calculation

### ✓ No knowledge exists without evidence
- Foreign key constraint
- Evidence ID required
- Cascading deletes blocked

### ✓ Replay reconstructs identical evidence
- Run repository operations
- Collect evidence
- Replay same operations
- Evidence byte-identical

---

## Integration Test

```bash
# Test: Replay Reconstruction
1. Run repository: git add, git commit, npm test
2. Collect evidence from all sources
3. Store in database
4. Clear database
5. Replay same operations
6. Verify: Evidence identical (byte-for-byte)
```

---

## Implementation Plan

### Evidence Sources (8 total)

1. **Git Evidence** - Commits, diffs, branches
2. **Terminal Evidence** - Commands, stdout/stderr
3. **Test Evidence** - Pass/fail, coverage
4. **Build Evidence** - Compilation results
5. **Compiler Evidence** - Errors, warnings
6. **Runtime Evidence** - Errors, logs
7. **Conversation Evidence** - User messages
8. **System Evidence** - Filesystem state

### Storage Schema

```sql
CREATE TABLE evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  repository VARCHAR(255) NOT NULL,
  content JSONB NOT NULL,
  content_hash VARCHAR(64) NOT NULL UNIQUE,
  timestamp TIMESTAMPTZ NOT NULL,
  provenance JSONB NOT NULL,
  
  -- Indexes for queries
  INDEX idx_evidence_repo (repository),
  INDEX idx_evidence_type (type),
  INDEX idx_evidence_time (timestamp DESC),
  INDEX idx_evidence_hash (content_hash)
);
```

### Collectors Architecture

```
Evidence Source
      ↓
  Collector
      ↓
  Validator
      ↓
  Hash Calculator
      ↓
  Deduplication Check
      ↓
  PostgreSQL Store
```

---

## Success Metrics

| Metric | Target | Verification |
|--------|--------|--------------|
| Coverage | > 95% events captured | Log analysis |
| Duplicate Rate | < 2% | Database query |
| Hash Consistency | 100% | Same content → same hash |
| Provenance | 100% | Query check |
| Replay Accuracy | 100% byte-identical | Integration test |

---

## Phase 1 Exit Gate

Before proceeding to Phase 2, verify:

```bash
# Run integration test
npm run test:evidence

# Verify:
✓ Evidence collected from all 8 sources
✓ Duplicate rate < 2%
✓ Replay produces identical evidence
✓ No knowledge without evidence (constraint enforced)
✓ All hashes consistent
```

All 5 checks must pass. If any fail, fix before moving to Phase 2.
