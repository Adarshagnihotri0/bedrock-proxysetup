# Documentation Health Evolution

Evolution from linting to governance: v1 → v2 → v3

## Timeline

**v1: Documentation Hygiene** (2026-07-19)
- Focus: Completeness
- Metrics: Broken links, binary metadata presence
- Philosophy: "Fix lint errors"

**v2: Architecture Metrics** (2026-07-19)
- Focus: Quality metrics
- Metrics: Connected components, field-level metadata, coverage
- Philosophy: "Measure documentation quality"

**v3: Documentation Governance** (2026-07-19)
- Focus: Correctness
- Metrics: Validity, drift detection, debt tracking
- Philosophy: "Can engineers trust what the documentation says?"

## Metric Evolution

### Information Architecture

| Metric | v1 | v2 | v3 |
|--------|----|----|-----|
| Reachability | README only (2%) | Entry points (37%) | Entry points (30%) |
| Connectedness | Single % | Largest component (35%) | **Strongly Connected Components** |
| Orphan detection | Count (65) | Expected vs unexpected (32) | Expected vs unexpected (35) |
| Dead ends | Count (66) | Expected vs unexpected (45) | Expected vs unexpected (60) |
| Centrality | - | Hub concentration (0%) | **Bus factor, PageRank** |

**Key v3 additions:**
- Tarjan's algorithm for SCC (reveals documentation clusters)
- Bus factor (documentation coverage loss if hub removed)
- More accurate orphan/dead end classification

### Documentation Quality

| Metric | v1 | v2 | v3 |
|--------|----|----|-----|
| Metadata | Binary (0%) | Field-level (0%, 0%, 0%, 0%) | Field-level + **ownership maturity** |
| Ownership | Owner field | Owner % | **Individual vs Team ownership** |
| Review tracking | - | Last-reviewed date | **Fresh vs Stale vs Missing** |
| Navigation | "## Navigation" string | Outgoing links ≥2 | Outgoing links ≥2 |

**Key v3 additions:**
- Ownership maturity (teams persist, people leave)
- Review cadence (fresh < 90d, stale, missing)
- More sophisticated metadata tracking

### Coverage

| Metric | v1 | v2 | v3 |
|--------|----|----|-----|
| Packages | - | Packages documented (0%) | Packages documented (0/16) |
| Commands | - | Commands documented (15%) | Commands documented (2/14) |

**Same metric, better presentation:** Absolute numbers (2/14) more actionable than percentages (14%).

### New in v3: Validity

**Documentation drift:**
- README claims vs package.json reality
- Architecture docs vs docker-compose.yml
- Environment variables documented vs .env.example

**ADR/RFC validation:**
- ADR status: Accepted
- Code doesn't reference ADR
- Drift detected

**This is the most valuable dimension.** It answers: "Is documentation correct?"

### New in v3: Documentation Debt

**Debt tracking:**
- Missing metadata: 68 (high severity)
- Missing owner: 0
- Needs review: 0
- Stale documents: 0
- Validity issues: 2

**Why debt?** Engineers understand "69 debt items" better than "0% metadata".

## Philosophy Evolution

### v1: Hygiene
```
"Fix broken links"
→ Linting mindset
→ Binary pass/fail
```

### v2: Architecture
```
"Measure documentation quality"
→ Metrics mindset
→ Quality vs quantity
```

### v3: Governance
```
"Can engineers trust what the documentation says?"
→ Trust mindset
→ Correctness > completeness
```

## Key Insight

**v1-v2**: Measures documentation properties
**v3**: Measures documentation validity

The difference:

**v2 asks:** "Is metadata present?"
**v3 asks:** "Is metadata correct?"

**v2 asks:** "Is documentation connected?"
**v3 asks:** "Does documentation match implementation?"

## Example: Why Validity Matters

### Scenario A (v2 would pass)
```
✅ All links work
✅ Metadata complete
✅ Graph connected
✅ 100% coverage

README says: "Node 18 required"
package.json says: "node": ">=22"

Result: Engineers trust docs and use wrong Node version
```

### Scenario B (v3 would detect)
```
✅ Links work
⚠️ Metadata sparse

README says: "Node 22 required"
package.json says: "node": ">=22"

Result: Documentation matches reality
```

**Scenario A is worse.** v3 catches this.

## Implementation Complexity

| Dimension | v1 | v2 | v3 |
|------------|----|----|-----|
| Complexity | Low | Medium | High |
| Accuracy | Low | Medium | High |
| False positives | High | Medium | Low |
| Domain knowledge | None | Some | Required |

**v3 requires:**
- Parsing package.json, tsconfig.json
- Understanding Node version semantics
- Checking ADR implementation in code
- Validating environment variables

This is why most documentation linters stop at v2.

## Usage

```bash
# v3 (default)
npm run docs:health

# v2 (architecture metrics only)
npm run docs:health:v2

# v1 (legacy)
npm run docs:health:legacy
```

## CI Integration

All three versions:
- Exit code 1 on critical issues
- Exit code 0 when healthy
- Generate `docs-health-report.txt`

v3 adds:
- Drift detection
- Debt tracking
- Governance validation

## Future Directions

**v4 could add:**
- Bidirectional validation (code → docs)
- Semantic drift detection (NLP)
- Continuous validation (not just pre-commit)
- Integration with observability (docs vs error rates)

**v5 could add:**
- Documentation coverage for every exported function
- API documentation validation (OpenAPI ↔ implementation)
- Configuration drift (all config options documented)
- Change detection (docs change with code changes)

## Conclusion

The evolution v1 → v2 → v3 represents a fundamental shift:

**From**: Checking if documentation exists
**To**: Checking if documentation is correct

This shift acknowledges that:
- **A sparse, correct documentation graph beats a complete, incorrect one**
- **Engineers care about trust, not completeness**
- **Documentation debt is real technical debt**

The governance system (v3) measures what matters: **Can engineers trust what they read?**
