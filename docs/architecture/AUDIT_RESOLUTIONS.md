# Audit Resolution Log

**Purpose:** Track architectural decisions made in response to audit findings.  
**Rule:** Every finding must resolve to one of: **Accept**, **Reject**, **Needs Experiment**, or **Accept as TODO**.

---

## AUDIT-001: localeCompare Determinism Bug

### Finding
`ExtractorRegistry.sortKnowledge()` uses `localeCompare()` which is locale-dependent, violating invariant K1 (Deterministic Extraction).

### Evidence
```typescript
// src/pipeline/knowledge-hasher.ts:102
* IMPORTANT: Never use localeCompare - it's locale-dependent

// src/pipeline/knowledge-sorter.ts:15
* IMPORTANT: Uses binary comparison (never localeCompare)

// src/extractors/extractor-registry.ts:80-92 (BEFORE FIX)
const subjectCmp = a.subject.localeCompare(b.subject);  // ← BUG
const predicateCmp = a.predicate.localeCompare(b.predicate);
const objectCmp = a.object.localeCompare(b.object);
return a.type.localeCompare(b.type);
```

**Test proving locale-sensitivity:**
```javascript
// Turkish locale reverses I/i ordering
'file_IMAGE'.localeCompare('file_image', 'en-US')  // → 1
'file_IMAGE'.localeCompare('file_image', 'tr-TR')  // → -1  (DIFFERENT!)
```

### Impact
If extractors produce knowledge with case-varying subjects (e.g., `file_IMAGE_upload`, `file_image_download`):
- Server in US: sorted as `[download, upload]`
- Server in Turkey: sorted as `[upload, download]`
- Different order → different replay → **audit trail broken**

### Resolution
**ACCEPT** - Fixed in commit TBD

### Implementation
Replaced `localeCompare()` with binary comparison:

```typescript
// AFTER FIX
private sortKnowledge(knowledge: NewKnowledge[]): NewKnowledge[] {
  return [...knowledge].sort((a, b) => {
    // Binary comparison (locale-independent)
    if (a.subject < b.subject) return -1;
    if (a.subject > b.subject) return 1;
    
    if (a.predicate < b.predicate) return -1;
    if (a.predicate > b.predicate) return 1;
    
    if (a.object < b.object) return -1;
    if (a.object > b.object) return 1;
    
    if (a.type < b.type) return -1;
    if (a.type > b.type) return 1;
    
    return 0;
  });
}
```

### Verification
- Build passes ✅
- Turkish locale test demonstrates the principle ✅
- Implementation now matches documented invariants in KnowledgeHasher and KnowledgeSorter ✅

---

## AUDIT-002: Confidence Aggregation Policy Missing

### Finding
Architecture stores `knowledge.confidence` and `knowledge_support.confidence` but defines no aggregation policy.

### Evidence
```typescript
// src/pipeline/knowledge-pipeline.ts:12-15
* - knowledge.confidence: Canonical confidence (aggregate across all evidence)
* - knowledge_support.confidence: Per-extraction confidence from THIS evidence
* - K14: Confidence nullable pending Phase 3 aggregation
```

**Test showing ambiguity:**
```typescript
// Same fact extracted 3 times:
support1.confidence = 0.4;
support2.confidence = 1.0;
support3.confidence = 0.9;

// What is knowledge.confidence?
// MAX: 1.00
// AVERAGE: 0.77
// LATEST: 0.90
// FIRST (current bug): 0.40
```

### Resolution
**ACCEPT AS TODO** - Document in Phase 3 requirements

### Rationale
This is a design gap, not a bug. The architecture explicitly defers aggregation to Phase 3 (see invariant K14). 

**Critical:** This does NOT mean confidence should be part of knowledge identity (rejected in AUDIT-003).

### Action Items
- [ ] Define confidence aggregation policy before Phase 3 implementation
- [ ] Document policy options (MAX, AVERAGE, BAYESIAN, VOTING, LATEST)
- [ ] Choose policy based on use case (audit? search? reasoning?)
- [ ] Implement aggregation function in knowledge-pipeline.ts

---

## AUDIT-003: Confidence Belongs in Knowledge Identity Hash

### Finding
Original audit claimed confidence should be part of knowledge identity hash because "confidence is epistemic certainty."

### Evidence
Original claim:
```
confidence=1.0: "I directly observed this"
confidence=0.3: "I weakly inferred this"
These are fundamentally different knowledge states and must be distinct entities.
```

### Resolution
**REJECT**

### Rationale
This would undermine the entire many-to-one architecture.

**Counter-example:**
```
Evidence A: build failed, confidence=0.4
Evidence B: build failed, confidence=0.95
```

Both describe the **same fact in reality**: "build failed".

Confidence describes the **extractor's belief**, not the fact itself.

If confidence is part of identity, these become two different knowledge facts:
- Knowledge 1: build failed (0.4)
- Knowledge 2: build failed (0.95)

This destroys deduplication and explodes the knowledge graph.

**Correct design:**
```
Knowledge: build failed
Supported by:
  - Evidence A (confidence=0.4)
  - Evidence B (confidence=0.95)
```

This allows:
1. Deduplication of facts
2. Tracking of extractor confidence over time
3. Uncertainty quantification
4. Confidence updates without creating new facts

**The architecture is correct.** Invariant K4 (confidence excluded from hash) is the right design.

---

## AUDIT-004: Canonical Serialization Undefined

### Finding
Canonical protocol has undecided decisions (DECISION-002, DECISION-007, DECISION-009) which may break replay.

### Evidence
```markdown
| DECISION-007 | FOUNDATIONAL | 🔴 UNDECIDED | Number domain (integer vs float) |
| DECISION-002 | CRITICAL | 🔴 UNDECIDED | Number representation |
| DECISION-009 | CRITICAL | 🔴 UNDECIDED | String escaping |
```

### Resolution
**ACCEPT AS TODO** - Partial finding

### Rationale
**Correct:** The specification is incomplete.

**Incorrect:** The report jumps to "replay will fail" without evidence.

Current implementation uses:
```typescript
// Key sorting: UTF-8 byte order (algorithm complete)
const keys = Object.keys(value).sort((a, b) => {
  return Buffer.from(a, 'utf8').compare(Buffer.from(b, 'utf8'));
});
```

This IS deterministic for keys.

**The gap:** Number and string serialization may have edge cases (1.0 vs 1, escaping rules).

**Action Items:**
- [ ] Run canonical protocol test vectors against current implementation
- [ ] Document which test vectors pass/fail
- [ ] Define policy: "Node.js JSON.stringify" OR "RFC 8785 canonical JSON"
- [ ] If Node.js: document engine version requirement
- [ ] If RFC 8785: implement proper canonical serializer

**Priority:** Medium (not blocking Phase 2, but required before production).

---

## AUDIT-005: Evidence Deduplication Race Condition

### Finding
Stored procedure `insert_evidence()` has TOCTOU race condition.

### Evidence
```sql
-- migrations/003_create_evidence.sql:75-103
BEGIN
  -- Check if already exists
  SELECT id INTO v_id FROM evidence WHERE content_hash = p_content_hash;
  
  -- Return existing if found
  IF FOUND THEN
    RETURN v_id;
  END IF;
  
  -- Insert new
  INSERT INTO evidence (...) VALUES (...);
  RETURN v_id;
END;
```

**Race scenario:**
```
Thread A: SELECT (none found)
Thread B: SELECT (none found)
Thread A: INSERT (wins)
Thread B: INSERT → UNIQUE violation → exception raised
```

**Provider code:**
```typescript
// src/adapters/postgres-evidence-provider.ts:27-62
const result = await client.query<{
  insert_evidence: string;
}>(
  `SELECT insert_evidence($1, $2, $3, $4, $5, $6) as insert_evidence`,
  [...]
);
return result.rows[0].insert_evidence;  // No retry on error
```

### Resolution
**ACCEPT AS TODO** - Low priority design issue

### Rationale

**The race exists** in the stored procedure, but:

1. **Current usage pattern:** Evidence collectors (terminal, git, test) are **sequential**, not parallelized
2. **Hash collision probability:** Same evidence hash collected simultaneously is extremely rare
3. **Impact:** If race occurs, provider throws error → evidence collection fails → can retry
4. **No data corruption:** UNIQUE constraint prevents duplicates

**This is NOT critical because:**
- Evidence collection is intentional, user-triggered (not high-throughput ingestion)
- Failed collection can be retried
- No silent data loss (error is visible)

**However, should fix for robustness:**

### Recommended Fix

Replace stored procedure with idempotent SQL:

```sql
-- Option 1: INSERT ... ON CONFLICT (PostgreSQL 9.5+)
INSERT INTO evidence (type, repository, content, content_hash, provenance, timestamp)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (content_hash) DO NOTHING
RETURNING id;

-- If no rows returned, query for existing:
SELECT id FROM evidence WHERE content_hash = $4;
```

Or in provider (TypeScript):

```typescript
async store(evidence: Omit<Evidence, 'id'>): Promise<string> {
  try {
    return await this.insertEvidence(evidence);
  } catch (error) {
    if (error.code === '23505') {  // UNIQUE violation
      // Race condition - another thread won, retrieve their ID
      const existing = await this.findByHash(evidence.contentHash);
      if (existing) return existing;
    }
    throw error;
  }
}
```

### Action Items
- [ ] Determine if evidence collection will ever be parallelized
- [ ] If yes, implement retry logic in provider
- [ ] If no, document that collection is sequential in architecture docs
- [ ] Consider replacing stored procedure with `INSERT ... ON CONFLICT` for simplicity

---

## Template for New Findings

```markdown
## AUDIT-XXX: [Title]

### Finding
[Description]

### Evidence
[Code references]

### Resolution
[ACCEPT | REJECT | NEEDS EXPERIMENT | ACCEPT AS TODO]

### Rationale
[Why this resolution?]

### Action Items
- [ ] [Specific next steps]
```
