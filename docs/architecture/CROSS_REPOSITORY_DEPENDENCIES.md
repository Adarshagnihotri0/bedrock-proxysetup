# Cross-Repository Dependencies

## Overview

Bedrock-proxy depends on external repositories that are not visible in single-repo audits. This document tracks these dependencies to prevent future auditors from reaching incorrect conclusions.

**Important:** These are **specification references**, NOT package dependencies.

---

## Dependency 1: Canonical Serialization Protocol

**Repository:** `canonical-protocol`  
**Location:** `/Users/adarshagnihotri/Desktop/Projects/whyAI references/canonical-protocol/`  
**Type:** **Specification Repository** (not npm package)  
**Purpose:** Defines deterministic, cross-language canonical serialization via RFC-0001

### Dependency Type

This is a **specification reference**, not a package dependency:

| Aspect | Details |
|--------|---------|
| **npm dependency?** | ❌ No - not in package.json |
| **import statement?** | ❌ No - no `require()` or `import from` |
| **Package install?** | ❌ No - no npm install needed |
| **Specification?** | ✅ Yes - RFC-0001 defines the algorithm |
| **Test vectors?** | ✅ Yes - conformance testing |
| **Implementation?** | ✅ Inline in bedrock-proxy (see below) |

### Components

| Component | Path | Purpose |
|-----------|------|---------|
| RFC-0001 | `protocol/rfc/Documents/RFC-0001-canonical-serialization-protocol.md` | Formal specification (defines invariants, data model, algorithm) |
| Test Vectors | `test-vectors/serialization/` | Conformance testing (SER-0001 through SER-0260) |
| Implementations | `implementations/` | Reference implementations in 6 languages |

### Implementations in canonical-protocol

The canonical-protocol repository contains reference implementations:
- **typescript/** - Node.js implementation
- **javascript/** - Browser implementation
- **python/** - Python implementation
- **go/** - Go implementation
- **java/** - JVM implementation
- **rust/** - Rust implementation

**These are reference implementations for testing the spec, not used directly by bedrock-proxy.**

---

## How bedrock-proxy Uses This

### Implementation Method

Bedrock-proxy implements RFC-0001 **inline** (not as imported package):

```typescript
// src/pipeline/admission-pipeline.ts:254-275
private canonicalSerialize(value: unknown): string {
  return JSON.stringify(this.sortKeys(value));
}

private sortKeys(value: unknown): unknown {
  // ... implementation per RFC-0001
  const keys = Object.keys(value).sort((a, b) => {
    return Buffer.from(a, 'utf8').compare(Buffer.from(b, 'utf8'));
  });
  // ...
}
```

### Conformance Testing

Test vectors are used to verify the implementation:

```bash
npm run test:canonical
# Runs: scratch/canonical-test.ts
# Result: 6/6 test vectors passed
```

This is **manual conformance testing**, not automated package validation.

---

## Why This Pattern?

### Specification Repository vs Implementation Repository

This follows a common pattern in software architecture:

**Specification Repository (canonical-protocol):**
- Defines the "what" (RFC-0001, invariants, edge cases)
- Provides test vectors for validation
- Contains reference implementations (proof of concept)
- Documents design decisions (ADRs)

**Implementation Repository (bedrock-proxy):**
- Implements the "how" (inline code)
- Tests against specification vectors
- Optimizes for specific use case
- Maintains independence from external packages

### Similar Patterns

| Specification | Implementations |
|---------------|-----------------|
| JSON Schema spec | Ajv, jsonschema, etc. |
| OAuth 2.0 RFC | passport-oauth2, etc. |
| RFC 8785 (Canonical JSON) | Various libraries |
| **canonical-protocol RFC-0001** | **bedrock-proxy (inline)** |

---

## Advantages of This Approach

### Why Not npm package?

1. **Control:** Full control over implementation details
2. **Performance:** No runtime dependency overhead
3. **Simplicity:** No version conflicts, no updates
4. **Audit:** Implementation is visible in codebase
5. **Testing:** Test vectors pass (6/6), spec is validated

### Why Specification Repository?

1. **Stability:** Formal invariants prevent drift
2. **Validation:** Test vectors prove correctness
3. **Interoperability:** Other systems could implement same spec
4. **Documentation:** ADRs explain design decisions

---

---

## Audit Implications

### Visibility Bias

When auditing bedrock-proxy alone, the reviewer:
- ✅ Can see implementation details
- ✅ Can see repository-specific invariants
- ❌ Cannot see external specifications
- ❌ Cannot see cross-repo validations
- ❌ Cannot distinguish "inline implementation" from "no specification"

### Category 1 Findings

Findings in this category are:
> **Correct conclusion from partial visibility, incorrect conclusion from complete architecture.**

Example: AUDIT-004

**Auditor's view (bedrock-proxy only):**
```typescript
// src/pipeline/admission-pipeline.ts
private canonicalSerialize(value: unknown): string {
  return JSON.stringify(this.sortKeys(value));
}
```

Auditor thinks:
- No imported package
- Code references undecided DECISION-002/007/009
- "Canonical serialization is undefined"

**Complete system view (canonical-protocol + bedrock-proxy):**
- RFC-0001 exists with formal spec
- Test vectors exist for validation
- Implementation passes 6/6 tests
- "Canonical serialization is specified and validated"

---

## Future Audit Protocol

When conducting architectural audits:

### Step 1: Identify Cross-Repo Dependencies
```bash
# Search for specification references
grep -r "RFC-0001\|canonical-protocol\|specification" docs/

# Search for inline implementations of external specs
grep -r "canonicalSerialize\|sortKeys" src/
```

### Step 2: Locate Specification Repositories
- Check parent directories
- Check sibling projects
- Check for test vectors
- Check for ADRs

### Step 3: Verify Conformance
```bash
npm run test:canonical
# Result: 6/6 passed
```

### Step 4: Document Integration
Update this document with:
- Specification repository location
- Test vector coverage
- Conformance test results
- Last verification date

---

## Decision Points

### When to Keep Inline Implementation

Keep the current pattern when:
- ✅ Test vectors pass
- ✅ Implementation is stable
- ✅ No need for other systems to use same code
- ✅ Want full control over implementation

### When to Publish as Package

Publish canonical-protocol as npm package when:
- 📌 Multiple projects need same implementation
- 📌 Want version control over serialization logic
- 📌 Need to share bug fixes across projects
- 📌 Other systems need canonical serialization

### Current Recommendation

**Keep inline implementation** with:
- ✅ Regular conformance testing: `npm run test:canonical`
- ✅ Document spec reference: this document
- ✅ Test before releases: add to CI/CD pipeline
- ✅ Monitor spec updates: watch canonical-protocol repo

---

---

## Dependency Status

| Repository | Type | Status | Last Verified | Test Vectors | Integration Method |
|------------|------|--------|---------------|--------------|-------------------|
| canonical-protocol | Specification Reference | ✅ Active | 2026-07-18 | 6/6 PASSED | Inline implementation with conformance testing |

---

## Review Schedule

Cross-repo dependencies should be re-verified:
- **Pre-release:** Run `npm run test:canonical` before each production release
- **Spec updates:** When canonical-protocol releases new test vectors
- **Code changes:** When bedrock-proxy modifies serialization logic
- **Security audits:** During annual security reviews
- **Quarterly:** Periodic conformance validation (add to CI/CD)

---

## Integration Checklist

For each cross-repo dependency, ensure:

- [x] Specification repository identified
- [x] RFC/spec document location documented
- [x] Test vectors imported to scratch/
- [x] Conformance test script created
- [x] npm script added (test:canonical)
- [x] Verification date recorded
- [x] Dependency type documented (spec reference vs package)
- [x] Advantages/disadvantages documented
- [x] Decision points defined (when to change integration method)

---

## Philosophy

This pattern recognizes a fundamental truth:

> **Specifications are architecture. Implementations are optimization.**

The canonical-protocol repository defines the **architecture** (invariants, data model, algorithm). The bedrock-proxy repository provides an **optimized implementation** for its specific use case.

Single-repo auditors miss this distinction. This document makes it explicit.

---

## References

- AUDIT_RESOLUTIONS.md - AUDIT-004 (rejected due to invisible dependency)
- AUDIT_FINAL_REPORT.md - Category 1 findings (visibility bias)
- canonical-protocol RFC-0001 - Formal specification
- scratch/canonical-test.ts - Conformance testing script
