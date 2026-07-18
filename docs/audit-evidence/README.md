# Audit Evidence Archive

**Purpose:** Code samples and experiments used to verify audit findings

## AUDIT-001: localeCompare Determinism Bug

### Files
- `code-samples/locale-test.js` - Turkish locale test proving localeCompare violation
- `code-samples/extractor-registry-fix.ts` - Binary comparison fix demonstration

### Evidence

**Problem:** `localeCompare()` produces different orderings based on system locale.

```javascript
// locale-test.js
'file_IMAGE'.localeCompare('file_image', 'en-US')  // → 1
'file_IMAGE'.localeCompare('file_image', 'tr-TR')  // → -1  (DIFFERENT!)
```

**Fix:** Replace with binary comparison.

```typescript
// extractor-registry-fix.ts
if (a.subject < b.subject) return -1;
if (a.subject > b.subject) return 1;
// Binary comparison for all fields
```

### Resolution
✅ **FIXED** - Commit 6bcf6db

---

## AUDIT-002: Confidence Aggregation Policy Missing

### Files
- `code-samples/confidence-problem.ts` - Demonstration of ambiguity

### Evidence

**Problem:** Multiple evidence with different confidence → no aggregation policy.

```typescript
// confidence-problem.ts
Knowledge: build failed
Supported by:
  - Evidence A (confidence=0.40)
  - Evidence B (confidence=0.95)

Question: What is knowledge.confidence?
Option 1: 0.40 (first evidence)
Option 2: 0.95 (max)
Option 3: 0.77 (average)
Option 4: VOTING-based
```

### Resolution
📅 **TODO** - Phase 3 (deferred in invariant K14)

---

## AUDIT-005: Evidence Race Condition

### Files
- `code-samples/race-condition-test.ts` - Race condition analysis
- `code-samples/check-evidence-constraints.sql` - Constraint verification query

### Evidence

**Problem:** Stored procedure has TOCTOU race.

```sql
CREATE FUNCTION insert_evidence(...) AS $$
BEGIN
  SELECT id INTO v_id FROM evidence WHERE content_hash = p_content_hash;
  IF FOUND THEN RETURN v_id; END IF;
  
  -- Race window
  INSERT INTO evidence (...) VALUES (...);
END;
$$;
```

**Mitigation:** UNIQUE constraint prevents corruption (PostgreSQL guarantees atomicity).

**Impact:** Low priority (zero production consumers, sequential collection).

### Resolution
📅 **TODO** - Low priority (no current usage)

---

## Summary

All audit evidence is preserved in this directory for:
- Future audits
- Reference implementation
- Teaching examples

**Active verification:** Run `npm run verify:audit` to check current state.
