# Documentation Maturity Model

From linting to evidence-backed documentation.

## Maturity Levels

### L1: Markdown Files
**Description:** Documentation exists as Markdown files.

**Verification:** Manual review.

**Example:**
```
README.md exists
CHANGELOG.md exists
```

**Limitations:** 
- No quality checks
- Links may be broken
- Information may be wrong

### L2: Link Validation
**Description:** Automated link checking.

**Verification:** Script checks file existence.

**Example:**
```
[Architecture](architecture.md) ← Does file exist?
```

**What it proves:**
- ✅ Referenced files exist
- ✅ Links aren't broken

**What it doesn't prove:**
- ❌ Documentation is accurate
- ❌ Documentation is useful

**Tools:** markdown-link-check, lychee

### L3: Information Architecture
**Description:** Graph-based documentation analysis.

**Verification:** Graph algorithms (BFS, DFS, Tarjan's SCC).

**Example:**
```
Connected components analysis
Orphan detection
Navigation density
Bus factor calculation
```

**What it proves:**
- ✅ Documentation graph structure
- ✅ Reachability and connectivity
- ✅ No unexpected isolation

**What it doesn't prove:**
- ❌ Documentation content quality
- ❌ Documentation accuracy

**Tools:** docs-health-v2

### L4: Documentation Governance
**Description:** Ownership, review cadence, coverage tracking.

**Verification:** Metadata validation, static analysis.

**Example:**
```
Owner: @platform-team
Status: stable
Last-reviewed: 2026-07-10
Type: reference
```

**What it proves:**
- ✅ Each doc has ownership
- ✅ Review process exists
- ✅ Documentation coverage metrics

**What it doesn't prove:**
- ❌ Documentation is correct
- ❌ Implementation matches docs

**Tools:** docs-health-v3

### L5: Evidence-Backed Documentation
**Description:** Documentation claims backed by evidence.

**Verification:** Conformance checks against observable repository facts.

**Example:**
```
README says: "Node 22"
package.json says: "node": ">=22"

Check: Do they conform? ✅
```

**What it proves:**
- ✅ Documentation conforms to repository observable state
- ✅ Internal consistency between docs and code
- ✅ ADRs claiming implementation have references

**What it doesn't prove:**
- ❌ Documentation is true (both could be wrong)
- ❌ System works as documented

**Key Distinction:**
```
CONFORMANCE: README agrees with package.json
≠
TRUTH: Both correctly describe reality
```

**Example where conformance ≠ truth:**
```
README: "API returns JSON"
package.json: type: module
Implementation: Returns XML

Conformance: ✅ (README and package.json don't contradict)
Truth: ❌ (Documentation wrong about API)
```

**Tools:** docs-health-v4

### L6: Executable Documentation
**Description:** Documentation is tested like code.

**Verification:** CI runs documented examples.

**Example:**
```markdown
## Example

\```bash
curl -X GET https://api.example.com/users
\```

Test: scripts/test-docs-example.sh runs this curl command
```

**What it proves:**
- ✅ Examples actually work
- ✅ API behavior matches documentation
- ✅ Commands are valid

**What it doesn't prove:**
- ❌ Documentation is complete
- ❌ Edge cases covered
- ❌ Conceptual correctness

**Tools:** 
- Kubernetes: e2e tests from docs
- Rust: doctests for code examples
- Terraform: terraform validate in docs
- Bazel: buildifier on examples

**Examples in practice:**
```
Rust: /// Examples are compiled and tested
Go: Examples run as tests
Python: doctest module
Kubernetes: e2e tests for tutorial steps
```

## Verification Hierarchy

```
Level    Trust Level    What's Verified
------   -----------     ----------------------------------
L1       None            File exists
L2       Low             Links work
L3       Low-Medium      Graph structure is healthy
L4       Medium          Governance processes exist
L5       Medium-High     Internal consistency verified
L6       High           Examples execute successfully
```

## Key Insight

**L5 (Evidence-Backed) is the boundary between:**
- Checking documentation properties (L1-L4)
- Checking documentation correctness (beginning at L5)

**But even L6 doesn't prove truth:**
- Examples work, but edge cases missing
- Commands execute, but wrong flags
- API responds, but semantics wrong

**True documentation verification requires:**
- Domain knowledge
- External validation
- Semantic understanding

This is beyond automated checking.

## What docs-health-v4 Proves

### Conformance, Not Truth

We prove:
```
✓ Docs conform to observable repository facts
✓ README consistent with package.json
✓ No contradictions between docs and code
✓ Internal logical consistency
```

We do NOT prove:
```
✗ Docs describe reality correctly
✗ System works as documented
✗ All behaviors documented
✗ No missing documentation
```

### Example: Node Version

**Case 1: Conformance ✅, Truth ❓**
```
README: "Requires Node 22"
package.json: "node": ">=22"

Check: ✅ Conforms
Truth: ❓ Unknown (may fail on Node 22 for other reasons)
```

**Case 2: Non-conformance ❌, Truth ❓**
```
README: "Requires Node 18"
package.json: "node": ">=22"

Check: ❌ Does not conform
Truth: ❓ Either README wrong or package.json wrong (or both)
```

**Case 3: Conformance ✅, Truth ✅**
```
README: "Requires Node 22"
package.json: "node": ">=22"
Actual: Works on Node 22

Check: ✅ Conforms
Truth: ✅ Correct (verified manually)
```

The conformance check reduces the search space for errors, but doesn't eliminate manual verification.

## The Next Frontier: Evidence Plugins

The real power comes from extensibility:

### OpenAPI Plugin
```javascript
checker.register({
  name: 'openapi-conformance',
  category: 'conformance',
  async run() {
    // 1. Parse OpenAPI spec
    // 2. Find documented endpoints
    // 3. Check if implementation exists
    // 4. Verify schemas match
    
    return {
      conformance: 'OpenAPI spec conforms to Express routes'
    };
  }
});
```

### Terraform Plugin
```javascript
checker.register({
  name: 'terraform-docs',
  category: 'conformance',
  async run() {
    // 1. Parse terraform-docs output
    // 2. Compare to main.tf
    // 3. Check all variables documented
    
    return {
      conformance: 'Terraform docs conform to .tf files'
    };
  }
});
```

### Docker Plugin
```javascript
checker.register({
  name: 'docker-compose',
  category: 'conformance',
  async run() {
    // 1. Parse architecture docs
    // 2. Parse docker-compose.yml
    // 3. Check for drift
    
    return {
      conformance: 'Architecture docs conform to compose config'
    };
  }
});
```

This transforms the tool from:
- "A documentation checker"
Into:
- "A framework for validating documentation conformance"

## Why Correctness Claims Are Dangerous

### The Problem

If your tool claims to verify "documentation correctness", users will:
- Trust documentation blindly
- Skip manual verification
- Be surprised when wrong docs pass checks

### The Solution

Be explicit about limitations:

**✓ What we verify:**
```
"Documentation conforms to observable repository facts"
```

**✗ What we don't verify:**
```
"Documentation is correct"
"System works as documented"
```

### Example Warning

```
================================================================================
DISCLAIMER
================================================================================
This tool verifies DOCUMENTATION CONFORMANCE (internal consistency),
not DOCUMENTATION TRUTH (external correctness).

A passing check means:
  ✓ Documentation is internally consistent
  ✓ Documentation conforms to observable repository facts

It does NOT prove:
  ✗ Documentation describes reality correctly
  ✗ System works as documented

For evidence-backed documentation, consider:
  • Executable examples (tested in CI)
  • Contract tests (OpenAPI ↔ implementation)
  • Integration tests (documented behaviors)
================================================================================
```

## Best Practices for L5+

### 1. Document Verification Method

For every check, show HOW it was verified:

```yaml
field: Node version
docs: Node 22
code: Node 22
verification: filesystem-check (package.json parsed)
conforms: true
```

This prevents overclaiming.

### 2. Use Caveats

When checks have limitations, state them:

```yaml
check: adr-implementation
result: warning
caveat: "Claims implementation but no code reference found. Manual verification recommended."
```

### 3. Separate Conformance Levels

```
Level 5a: File existence conformance
Level 5b: File content conformance
Level 5c: Behavioral conformance (needs execution)
Level 5d: Semantic conformance (needs domain knowledge)
```

### 4. Encourage Manual Verification

```
⚠️  ADR-001 claims "Implemented"
   No code reference found.
   Recommended: Manual review ADR-001 compliance
```

## Summary

**The maturity model:**

- **L1-L4:** Check documentation properties
- **L5:** Check documentation conformance
- **L6:** Check documentation executability

**L5 is the critical boundary:**
- Before L5: Metadata and structure
- L5+: Content and correctness

**L5 verifies conformance, not truth:**
- Conformance = Internal consistency
- Truth = External correctness

**To approach truth:**
- Need L6 (executable examples)
- Need domain-specific validation
- Need semantic understanding

**The goal:**
```
"The documentation is internally consistent and continuously validated 
against observable repository facts."
```

This is defensible. "The documentation is correct" is not.
