# Cross-Repository Dependencies

## Overview

Bedrock-proxy depends on external repositories that are not visible in single-repo audits. This document tracks these dependencies to prevent future auditors from reaching incorrect conclusions.

---

## Dependency 1: Canonical Serialization Protocol

**Repository:** `canonical-protocol`  
**Location:** `/Users/adarshagnihotri/Desktop/Projects/whyAI references/canonical-protocol/`  
**Purpose:** Defines deterministic, cross-language canonical serialization

### Components

| Component | Path | Purpose |
|-----------|------|---------|
| RFC-0001 | `protocol/rfc/Documents/RFC-0001-canonical-serialization-protocol.md` | Formal specification |
| Test Vectors | `test-vectors/serialization/` | Conformance testing (SER-0001 through SER-0260) |
| Implementations | `implementations/` | Cross-language validation |

### Implementations

- **typescript/** - Node.js implementation
- **javascript/** - Browser implementation
- **python/** - Python implementation
- **go/** - Go implementation
- **java/** - JVM implementation
- **rust/** - Rust implementation

### Integration Point

Bedrock-proxy implements RFC-0001 in:
- `src/pipeline/admission-pipeline.ts:255-275` - `canonicalSerialize()`
- `src/pipeline/admission-pipeline.ts:277-301` - `sortKeys()`

### Verification

Test vectors are validated in:
- `scratch/canonical-test.ts` - Runs 6 test vectors
- Result: 6/6 PASSED (2026-07-18)

### Why This Matters

**Single-repo audits cannot see this dependency.**

AUDIT-004 originally concluded:
> "Canonical serialization is undefined and may produce different hashes across implementations."

This conclusion was valid from bedrock-proxy's visible code (DECISION-002/007/009 marked UNDECIDED), but invalid from the complete architecture (RFC-0001 exists with test vectors and cross-language implementations).

---

## Audit Implications

### Visibility Bias

When auditing bedrock-proxy alone, the reviewer:
- ✅ Can see implementation details
- ✅ Can see repository-specific invariants
- ❌ Cannot see external specifications
- ❌ Cannot see cross-repo validations

### Category 1 Findings

Findings in this category are:
> **Correct conclusion from partial visibility, incorrect conclusion from complete architecture.**

Example: AUDIT-004

---

## Future Audit Protocol

When conducting architectural audits:

### Step 1: Identify Cross-Repo Dependencies
```
grep -r "canonicalSerialize\|RFC-0001\|canonical-protocol" src/
```

### Step 2: Locate External Repositories
Check parent directories, sibling projects, and referenced specs.

### Step 3: Verify Integration
- Run test vectors against current implementation
- Check for divergence from specification
- Document policy decisions

### Step 4: Update This Document
Add new cross-repo dependencies as they are integrated.

---

## Dependency Status

| Repository | Status | Last Verified | Test Vectors |
|------------|--------|---------------|--------------|
| canonical-protocol | ✅ Active | 2026-07-18 | 6/6 PASSED |

---

## Review Schedule

Cross-repo dependencies should be re-verified:
- When canonical-protocol releases new test vectors
- When bedrock-proxy changes serialization logic
- Before major production releases
- During security audits

---

## References

- AUDIT_RESOLUTIONS.md - AUDIT-004 (rejected due to invisible dependency)
- AUDIT_FINAL_REPORT.md - Category 1 findings (visibility bias)
- canonical-protocol RFC-0001 - Formal specification
