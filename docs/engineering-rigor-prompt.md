# Training Prompt: Engineering Rigor in Documentation Governance

## Core Philosophy

**Replace opinion with evidence.**

Every metric, finding, and recommendation must be:
1. **Formally specified** - Define what you measure, how, and why
2. **Evidence-backed** - Show the data that supports each finding
3. **Confidence-rated** - Acknowledge uncertainty (not all checks are equal)
4. **Owner-accountable** - Assign responsibility for maintenance
5. **Historically tracked** - Show trajectory, not just state

## The Conformance vs Truth Distinction

### What We Verify

✅ **Conformance** (internal consistency)

Examples:
- README claims "Node 22", package.json says "engines.node": ">=22"
- OpenAPI spec defines `/users` route, Express implements `/users`
- Architecture diagram shows `module-a`, codebase has `src/module-a`
- ADR says "use PostgreSQL", config has `DATABASE_URL` pointing to Postgres

**Proof method:** Compare repository artifacts against each other.

### What We Do NOT Verify

❌ **Truth** (external correctness)

Examples:
- README says "Node 22" - is this the **right** version? (Requires human judgment)
- OpenAPI spec defines `/users` - should this route exist? (Requires API review)
- Architecture diagram shows `module-a` - is this architecture optimal? (Requires design review)
- ADR says "use PostgreSQL" - is Postgres the best choice? (Requires trade-off analysis)

**Proof method:** Human review, user testing, domain expertise.

### Critical Boundary

A static analysis tool can say:
> "README and package.json disagree" (conformance)

A static analysis tool CANNOT say:
> "Node 22 is wrong" (truth)

The moment you claim truth, you need human judgment.

## Engineering Rigor Checklist

Before implementing any metric, answer:

### 1. Formal Specification

```yaml
metric: my-metric
category: critical|warning|info
description: What this measures (plain English)
measurement:
  source: Where data comes from
  algorithm: How data is processed
  tool: Specific tools/libraries used
limitations:
  - What this CANNOT detect
  - Edge cases handled poorly
  - Assumptions made
examples:
  - Violation: "[example with explanation]"
  - Pass: "[example with explanation]"
ci:
  threshold: X (what count triggers FAIL?)
  caveat: "Why this threshold?"
owner: Team/person responsible
frequency: How often to run?
```

**Anti-pattern:** "Checks documentation quality"

**Better:** "Counts broken relative links in Markdown files using fs.existsSync"

### 2. Evidence Structure

Every finding must have supporting evidence:

```json
{
  "severity": "critical|warning|info",
  "confidence": 0.0-1.0,
  "message": "Human-readable summary",
  "evidence": [
    {
      "type": "file-content|filesystem|git-history|metadata|runtime",
      "source": "Where evidence came from",
      "value": "Actual evidence value",
      "description": "What this evidence proves"
    }
  ],
  "location": {
    "file": "path/to/file",
    "line": 123,
    "column": 45
  },
  "suggestions": [
    "Specific, actionable fix"
  ]
}
```

**Anti-pattern:**
```json
{
  "message": "Documentation is outdated"
}
```

**Better:**
```json
{
  "message": "README claims Node 22, package.json requires Node 20",
  "evidence": [
    {
      "type": "file-content",
      "source": "README.md:42",
      "value": "Requires Node.js 22+",
      "description": "Stated in prerequisites"
    },
    {
      "type": "file-content",
      "source": "package.json",
      "value": "\"engines\": { \"node\": \">=20.0.0\" }",
      "description": "Actual requirement"
    }
  ],
  "confidence": 0.95
}
```

### 3. Confidence Levels

Use confidence rates honestly:

- **1.0**: Absolute certainty (file exists or doesn't, syntax is valid or invalid)
- **0.95**: High certainty (filesystem check, minor edge cases possible)
- **0.85**: Medium-High (content analysis, known false positive rate)
- **0.70**: Medium (heuristic approach, significant false positives)
- **0.50**: Low (guesswork, better than random but not reliable)

**Anti-pattern:** Mark everything as 1.0 confidence

**Better:** Be honest about uncertainty

```
Broken link: 0.95 (file system check, but generated files might be missed)
Package.json conformance: 0.85 (only checks stated versions, not transitive deps)
Architecture drift: 0.70 (heuristic, depends on naming conventions)
```

**Why this matters:**
If a tool claims 100% confidence and produces false positives, users stop trusting it. If a tool is honest about 70% confidence, users can make informed decisions.

### 4. Metric Ownership

Every metric needs an owner.

```yaml
metric: broken-links
owner: Docs Team
frequency: daily

metric: api-documentation-coverage
owner: Platform Team
frequency: per-commit

metric: architecture-drift
owner: Engineering Lead
frequency: weekly
```

**Anti-pattern:** Metrics without owners

**Better:** Every metric has a team/person responsible

**Why unowned metrics rot:**
When a metric fails and no one is responsible, it gets ignored. When ownership is clear, someone gets notified.

### 5. Historical Trends

Track trajectory, not just state.

```json
{
  "2026-07-01": { "count": 25 },
  "2026-07-08": { "count": 18 },
  "2026-07-15": { "count": 12 },
  "2026-07-22": { "count": 8 }
}
```

**Anti-pattern:** Single point-in-time report

**Better:** Show trend over time

```
Broken links (last 30 days):
  Week 1: 25
  Week 2: 18 (-28%)
  Week 3: 12 (-33%)
  Week 4: 8 (-33%)
  
Trend: Improving ✅
```

**Why trends matter:**
- A repo with 50 issues improving (down from 100) is healthier than one with 10 issues (up from 5)
- Trajectory shows if efforts are working
- Baselines help set realistic goals

## Disallowed Practices

### ❌ Arbitrary Scores

```
9.4/10 documentation quality
```

**Why disallowed:** Arbitrary scores are:
- Impossible to validate
- Easy to game
- Synthetic (combine disparate metrics)
- Opinion masquerading as measurement

**Better:**

```
Broken links: 8 (↑ from 5 last week)
Coverage: 65% (↓ from 70% last month)
Conformance: 2 drift warnings (stable)
```

Actionable counts > synthetic scores.

### ❌ Trust Language

```
"Documentation is trustworthy"
"High quality docs"
"Reliable documentation"
```

**Why disallowed:**
- Trust is a human feeling
- Quality is multi-dimensional
- Reliability requires runtime evidence

**Better:**

```
"Documentation conforms to repository state"
"Evidence-backed metrics with 95% confidence"
"Last checked 2 hours ago, 8 issues fixed since last week"
```

Verify, don't claim trust.

### ❌ All-Certainty Findings

```
ALL checks pass with 100% certainty
```

**Why disallowed:** Reality has edge cases:
- Generated files might not exist yet
- Build artifacts differ from source
- Documentation might reference future features

**Better:**

```
Checks pass with high confidence:
  - Broken links: 0 found (95% confidence)
  - Conformance: PASS (85% confidence)
  - Coverage: 72% (100% confidence, but covers only files, not content)
```

### ❌ Generic Descriptions

```
"Checks documentation quality"
"Ensures consistency"
"Validates correctness"
```

**Why disallowed:** Too vague to verify.

**Better:**

```
"Verifies relative links in Markdown files resolve to existing files"
"Checks stated prerequisites match package.json engines field"
"Counts percentage of API routes documented in OpenAPI spec"
```

Specific enough to implement and test.

## Allowed Practices

### ✅ Observable Facts

```
"README.md line 42 references nonexistent file: CONTRIBUTING.md"
```

Provable via filesystem check.

### ✅ Internal Consistency

```
"README claims MIT license, package.json says Apache-2.0"
```

Provable via file comparison.

### ✅ Coverage Metrics

```
"65% of public modules have JSDoc comments"
```

Provable via AST parsing.

### ✅ Structural Analysis

```
"Largest documentation connected component: 55% of files"
```

Provable via graph traversal.

### ✅ Trend Analysis

```
"Broken links reduced from 25 to 8 over 4 weeks"
```

Provable via historical data.

## Prompt Template

When designing a new metric:

```markdown
## Metric: [NAME]

### What observable artifact does this measure?

[Specific file, pattern, structure]

### What is the formal specification?

```yaml
metric: ...
measurement: { source, algorithm, tool }
limitations: ...
```

### How do we implement it?

[Pseudocode or algorithm]

### What confidence level should results have?

[Justify: 1.0, 0.95, 0.85, 0.70, 0.50]

### What evidence objects support findings?

```json
{
  "type": "...",
  "source": "...",
  "value": "...",
  "description": "..."
}
```

### Who owns this metric?

[Team or person]

### How do we visualize trends?

[Historical tracking strategy]

### What are edge cases?

[Situations where the check might fail or produce false positives]

### Why is this conformance (not truth)?

[Explain why we check internal consistency, not external correctness]
```

## Real Examples

### Example 1: Broken Links

```yaml
metric: broken-links
category: critical
description: Relative links in Markdown that don't resolve to existing files
measurement:
  source: All Markdown files
  algorithm: Parse AST, extract links, resolve paths, check existence
  tool: unified, remark-parse, fs.existsSync
limitations:
  - External URLs ignored (would require HTTP requests)
  - Generated docs excluded (may not exist before build)
  - Symlinks not followed (complex handling)
  - Anchors not validated (would require heading extraction)
examples:
  - violation: "[Contributing](./CONTRIBUTING.md)" when file deleted
  - pass: "[Architecture](./architecture.md)" when file exists
ci:
  threshold: 0
  caveat: "Any broken link fails CI"
owner: Docs Team
frequency: per-commit
confidence: 0.95
```

**Why 0.95 instead of 1.0?**
Some repositories have generated documentation that exists after build but not before. We exclude these by pattern, but might miss edge cases.

**Evidence object:**
```json
{
  "type": "file-content",
  "source": "README.md:42",
  "value": "[CONTRIBUTING](./CONTRIBUTING.md)",
  "description": "Link to nonexistent file"
},
{
  "type": "filesystem",
  "source": "/path/to/CONTRIBUTING.md",
  "value": "File not found",
  "description": "Path resolution result"
}
```

**Conformance vs Truth:**
We verify the link resolves. We do NOT verify whether CONTRIBUTING.md should exist (that's a human decision).

### Example 2: Package.json Conformance

```yaml
metric: package-json-conformance
category: conformance
description: Verifies README claims match package.json reality
measurement:
  source: [README.md, package.json]
  algorithm: Regex extract claims from README, JSON parse package.json, compare
  tool: regex, JSON.parse
limitations:
  - Only checks stated versions (not transitive dependencies)
  - Regex might miss version claims in prose
  - Does not verify which scripts are documented
examples:
  - violation: README says "Node 22", package.json says "engines.node": ">=20"
  - pass: README says "Node 22", package.json says "engines.node": ">=22"
  - info: Script "start" exists but not documented
ci:
  threshold: null
  caveat: "Info-level, does not fail CI"
owner: Platform Team
frequency: per-commit
confidence: 0.85
```

**Why 0.85 instead of 0.95?**
Regex extraction might miss version claims in prose sections, and we only check stated versions, not transitive dependencies.

**Evidence object:**
```json
{
  "type": "file-content",
  "source": "README.md:12",
  "value": "Requires Node.js 22+",
  "description": "Stated prerequisite"
},
{
  "type": "file-content",
  "source": "package.json",
  "value": "\"engines\": { \"node\": \">=20.0.0\" }",
  "description": "Actual requirement"
}
```

**Conformance vs Truth:**
We verify README matches package.json. We do NOT verify whether Node 20/22 is correct (requires domain knowledge).

### Example 3: Architecture Diagram Conformance

```yaml
metric: architecture-drift
category: architecture
description: Verifies architecture diagrams reflect actual codebase structure
measurement:
  source: [architecture/*.mermaid, src/*]
  algorithm: Parse Mermaid, extract module names, compare to src/ directories
  tool: mermaid-parser, fs.readdir
limitations:
  - Only checks module existence, not relationships
  - Naming conventions must match (diagram: module-a, src: module-a)
  - Multiple diagrams might show different views
examples:
  - violation: Diagram shows "auth-service" but src/auth-service doesn't exist
  - pass: All modules in diagram exist in src/
ci:
  threshold: null
  caveat: "Low confidence, requires human review"
owner: Engineering Lead
frequency: weekly
confidence: 0.70
```

**Why 0.70?**
Heuristic approach. Diagrams might use different naming, might show future architecture, relationships not validated.

**Evidence object:**
```json
{
  "type": "file-content",
  "source": "architecture/phase2.mmd:5",
  "value": "auth-service[AuthService]",
  "description": "Module in diagram"
},
{
  "type": "filesystem",
  "source": "/path/to/src/auth-service",
  "value": "Directory not found",
  "description": "Implementation status"
}
```

**Conformance vs Truth:**
We verify diagram mirrors code. We do NOT verify whether this architecture is optimal (requires design review).

## Questions to Ask

When reviewing a documentation governance system:

1. **Is every finding evidence-backed?**
   - Show the data, not just the conclusion

2. **Are confidence levels honest?**
   - 0.70 is valuable (if explained why)
   - 1.0 for heuristics destroys trust

3. **Is conformance distinguished from truth?**
   - "We verify X matches Y" (conformance)
   - Not "We verify X is correct" (truth)

4. **Are specifications formal?**
   - Not "checks quality"
   - But "counts X using algorithm Y"

5. **Are metrics owned?**
   - Who gets notified when this fails?
   - Who is responsible for fixing?

6. **Are trends tracked?**
   - Single point-in-time is less useful
   - Trajectory shows progress

7. **Are limitations documented?**
   - Every metric has edge cases
   - Document what you CAN'T detect

8. **Is output machine-readable?**
   - CI integration requires JSON/SARIF
   - Dashboards require stable schemas

## Summary

> Engineering rigor means: say what you measure, measure what you say, and show your work.

**Core principles:**

1. Formal specification (no hand-waving)
2. Evidence objects (proof with every finding)
3. Confidence ratings (honest about uncertainty)
4. Metric ownership (someone accountable)
5. Historical trends (trajectory > state)
6. Conformance checking (internal consistency)
7. Observable artifacts (filesystem, content, structure)

**Distinguish:**

- ✅ Conformance (verifiable via static analysis)
- ❌ Truth (requires human judgment)

**Avoid:**

- Arbitrary scores
- Trust language
- 100% certainty for heuristics

**Build:**

- Evidence-backed findings
- Confidence-rated results
- Actionable counts
- Historical trends
- Owned metrics

This is the foundation for sustainable documentation governance.
