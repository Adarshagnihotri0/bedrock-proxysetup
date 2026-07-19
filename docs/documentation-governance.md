# Documentation Governance

Evidence-backed repository governance with plugin architecture.

## Quick Start

```bash
# Check documentation health
npm run docs:health

# Output:
# - Console: Human-readable report
# - JSON: docs-health.json (machine-readable)
# - SARIF: docs-health.sarif.json (GitHub/GitLab)
# - Trends: .docs-health-trends.json (historical)
```

## Architecture

**Design:** Rule engine with plugin API, evidence objects, and specification registry

**Philosophy:** 
- Verify conformance (internal consistency), not truth (external correctness)
- Every finding has evidence and confidence level
- No arbitrary scores - actionable counts only
- Observable artifacts only - no subjective quality metrics

## Maturity Model

```
L1: Markdown files
L2: Link validation
L3: Information architecture
L4: Documentation governance
L5: Evidence-backed conformance ← Current
L6: Executable documentation (future)
```

**L5 Characteristics:**
- ✅ Evidence objects for every finding
- ✅ Confidence levels (0.0-1.0)
- ✅ Formal specifications
- ✅ Plugin architecture
- ✅ Rule registry
- ✅ Stable output formats
- ✅ Historical trends
- ✅ Metric ownership

## Rule API

### Plugin Interface

```javascript
/**
 * Rule Plugin Contract
 */
interface RulePlugin {
  id: string;                    // Unique identifier
  description: string;           // Human-readable description
  
  metadata(): RuleMetadata;      // Formal specification
  run(context): Finding[];      // Evidence-backed findings
  
  initialize?(context): void;    // Optional: setup
  cleanup?(context): void;      // Optional: teardown
}
```

See `scripts/docs-health.js` for full implementation and built-in rules.

## Output Formats

### Console (Human-readable)

```
INTEGRITY
--------------------------------------------------------------------------------
❌ Broken link: LICENSE (95% confidence)
   Evidence: README.md = [LICENSE](LICENSE)
   Evidence: LICENSE file = File not found
   Location: README.md:402

SUMMARY
================================================================================
Critical: 6 | Warnings: 0 | Info: 2
```

### JSON/SARIF

- `docs-health.json` - Machine-readable, dashboard-ready
- `docs-health.sarif.json` - GitHub/GitLab annotations
- `.docs-health-trends.json` - Historical tracking

## Built-in Rules

1. **broken-links** (critical, 95% confidence) - Checks relative links resolve
2. **package-json-conformance** (info, 95% confidence) - Verifies README matches package.json

## Adding Custom Rules

```javascript
const myRule = {
  id: 'my-check',
  description: 'Description of what it checks',
  metadata() {
    return {
      category: 'conformance',
      severity: 'warning',
      specification: {
        metric: 'my-metric',
        measurement: { source, algorithm, tool },
        limitations: [ ... ]
      },
      owner: 'Team',
      confidence: 0.85
    };
  },
  async run(context) {
    const findings = [];
    // Check logic
    return findings;
  }
};

engine.registerRule(myRule);
```

## Philosophy

> Governance reduces uncertainty, doesn't eliminate it.

**We verify:**
- ✅ Conformance (internal consistency)
- ✅ Coverage (measurable baselines)

**We do NOT verify:**
- ❌ Truth (external correctness)
- ❌ Usefulness (requires users)
- ❌ Clarity (requires humans)

## Production Readiness

**Architecture:** Mature
**Implementation:** Prototype

**Missing for production:**
- Test coverage
- Performance validation (>1k docs)
- Plugin isolation
- JSON schemas

**Honest claim:** Reference architecture demonstrating evidence-backed governance. Production use requires tests.

## When to Extend

Add rules when evidence demands:
1. Performance issues appear
2. False positive patterns emerge
3. New domain needs governance
4. Real incident occurs

**Do NOT extend speculatively.**

## Success Metrics

Measure by usage, not architecture:
1. Catches regressions before merge?
2. Developers fix findings (not ignore)?
3. False positive rate acceptable?
4. Needed new rules due to real incidents?

Stable design shows: no architectural changes needed after a month of use.

---

**See also:**
- Docs: `docs/engineering-rigor-prompt.md` (training guide)
- History: `archive/governance-evolution/` (v1-v4 evolution)
- Code: `scripts/docs-health.js` (implementation)
