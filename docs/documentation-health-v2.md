# Documentation Health System

Automated documentation quality checks using objective, engineering-grade metrics.

## Quick Start

```bash
npm run docs:health
```

Outputs:
- **REPOSITORY HEALTH**: Critical issues (blocks CI)
- **DOCUMENTATION QUALITY**: Maintainability metrics
- **INFORMATION ARCHITECTURE**: Graph topology
- **COVERAGE**: Documentation-code alignment

## Metrics Philosophy

### What Changed in v2

v1 metrics were gameable:
- **Reachability from README**: 2% (wrong metric - single entry point)
- **Dead Ends**: 66 (counting intentional endpoints)
- **Orphans**: 65 (mixing expected/unexpected)
- **Metadata**: Binary presence check

v2 metrics are **observable properties**:

#### Repository Health (CI Blockers)
- ✅ **Broken Links**: File existence validation
- ✅ **Broken Anchors**: Anchor target validation  
- ✅ **Duplicate IDs**: Unique identifier enforcement
- ✅ **Canonical Conflicts**: One canonical doc per topic

#### Documentation Quality (Maintainability)
- **Metadata Completeness**: Required field coverage (owner, status, type, last-reviewed)
- **Owner Coverage**: % documents with owner
- **Review Freshness**: % documents reviewed within 90 days
- **Navigation Quality**: % documents with ≥2 outgoing links

#### Information Architecture (Graph Topology)
- **Largest Connected Component**: % docs in largest graph component
- **Reachability**: % docs reachable from entry points
- **Unexpected Orphans**: Isolated docs (excluding archive/scratch)
- **Unexpected Dead Ends**: Terminal docs (excluding ADRs/RFCs)
- **Median Depth**: Clicks to reach median doc
- **Hub Concentration**: % docs with >5 incoming refs
- **Incoming Refs Distribution**: median/avg/max

#### Coverage (Documentation-Code Alignment)
- **Packages Documented**: % src/* packages with docs
- **Commands Documented**: % npm scripts documented

## Current Status (2026-07-19)

```
REPOSITORY HEALTH
--------------------------------------------------------------------------------
❌ Broken Links (5 found)
✅ No broken anchors
✅ No duplicate ids
✅ No canonical conflicts

DOCUMENTATION QUALITY
--------------------------------------------------------------------------------
owner            0%
status           0%
type             0%
last-reviewed    0%
Owner Coverage   0%
Review Freshness 0%
Navigation Quality 12%

INFORMATION ARCHITECTURE
--------------------------------------------------------------------------------
Largest Connected Component    35%
Reachability                   37%
Unexpected Orphans             32
Unexpected Dead Ends           45
Median Depth                   1
Hub Concentration              0%
Incoming Refs (median)         0
Incoming Refs (max)            4

COVERAGE
--------------------------------------------------------------------------------
Packages Documented 0%
Commands Documented 15%
```

## Configuration

Edit `.scripts/docs-health-v2.js`:

```javascript
const config = {
  entryPoints: ['README.md', 'docs/README.md', 'docs/index.md'],
  excludePatterns: ['archive/**', 'scratch/**'],
  expectedOrphans: ['archive/', 'scratch/', 'audit-evidence/'],
  expectedDeadEnds: ['ADR-', 'RFC-', 'benchmark', 'evaluation/'],
  requiredMetadata: ['owner', 'status', 'type', 'last-reviewed']
};
```

## CI Integration

Automatically runs on:
- Push to `**.md` files
- Pull requests modifying documentation

Workflow: `.github/workflows/docs-health.yml`

## Adding Metadata

To improve quality metrics, add YAML frontmatter:

```markdown
---
owner: @username
status: active|stable|wip|archived
type: reference|guide|spec|adr|rfc
last-reviewed: 2026-07-19
---

# Document Title
...
```

## Why These Metrics

**Repository Health**: Binary invariants that must be true
- Broken links prevent navigation
- Duplicate IDs confuse tooling
- Canonical conflicts create ambiguity

**Documentation Quality**: Signals about maintainability
- Ownership prevents orphaned knowledge
- Freshness catches stale docs
- Navigation aids discoverability

**Information Architecture**: Graph topology health
- Connected component size shows integration
- Orphans indicate structural gaps
- Hub concentration shows dependency risk
- Depth affects discoverability

**Coverage**: Documentation-code alignment
- Packages without docs lack visibility
- Undocumented commands cause friction

## Improving Metrics

### Fix Broken Links (Critical)
```bash
# View broken links
npm run docs:health | grep "→"

# Fix paths
vim docs/architecture/phase2/INVARIANTS.md
# Change ../INVARIANTS.md → ../../INVARIANTS.md
```

### Add Metadata
```bash
# Add frontmatter to canonical docs
for file in docs/**/*.md; do
  # Add YAML frontmatter
  # owner: @team
  # status: stable
  # type: spec
  # last-reviewed: 2026-07-19
done
```

### Reduce Orphans
- Link orphan docs into navigation
- Add cross-references between related docs
- Ensure each package has entry point docs

### Increase Connectivity
- Add "Related Documents" sections
- Link from parent docs to children
- Create index pages for clusters

## Evolution

### v1 → v2 Changes
- Replaced "reachability from README" with **largest connected component**
- Split "orphans" into **expected vs unexpected**
- Split "dead ends" into **expected vs unexpected**
- Changed metadata to **field-level completeness**
- Added **review freshness** (last-reviewed date)
- Enhanced **navigation quality** (outgoing link count)
- Added **hub concentration** (dependency risk)
- Added **incoming reference distribution**
- Added **coverage metrics** (packages/commands)

### Future Enhancements
- Bidirectional relationship detection
- Specification-implementation linking
- API documentation coverage
- Code example freshness
- Accessibility checks
- Search optimization metrics

## Philosophy

> Documentation health is not about subjective quality judgments.
> It's about measuring observable properties that correlate with maintainability.

This system measures **invariants** and **correlations**, not opinions:
- Broken links have zero ambiguity (file exists or doesn't)
- Orphan status is objectively determinable (incoming refs = 0)
- Metadata completeness is a simple percentage
- Connected component size comes from graph traversal

The metrics are designed to be:
- **Hard to game**: Can't fake connectivity or hide missing files
- **Actionable**: Each metric has a clear remediation
- **Engineering-grade**: Suitable for CI enforcement
- **Self-documenting**: Output explains what's wrong

## References

- Configuration: `scripts/docs-health-v2.js`
- Legacy: `scripts/docs-health.js`
- Workflow: `.github/workflows/docs-health.yml`
- Output: `docs-health-report.txt`
