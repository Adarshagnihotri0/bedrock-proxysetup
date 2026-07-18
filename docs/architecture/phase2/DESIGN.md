# Phase 2: Knowledge Extraction - Design Document

**Status**: In Progress  
**Started**: 2026-07-18  
**Depends On**: Phase 1 Evidence Layer v1.0.0 (Frozen)

---

## Goal

Extract structured knowledge from evidence to enable reasoning, replay, and decision assistance.

---

## Problem Statement

Phase 1 provides content-addressable evidence storage with complete provenance. However, evidence alone is insufficient for:

1. **Reasoning**: "What patterns exist in build failures?"
2. **Replay**: "How was this decision made?"
3. **Assistance**: "What should I do next?"

We need to extract **knowledge** from evidence: structured facts, relationships, and inferences that can be queried.

---

## Success Criteria

- [ ] Knowledge table created with FK to evidence
- [ ] Extraction rules implemented for all evidence types
- [ ] Query API for knowledge retrieval
- [ ] "No knowledge without evidence" enforced
- [ ] Phase 2 verification suite passes
- [ ] Phase 2 frozen with auditable baseline

---

## Architecture

### Knowledge Model

```typescript
interface Knowledge {
  id: string;                    // UUID
  evidenceId: string;             // FK to evidence.id
  type: KnowledgeType;           // Fact, relationship, inference
  subject: string;               // Entity (e.g., "build_command")
  predicate: string;             // Relation (e.g., "failed_with")
  object: string;                // Value (e.g., "compilation_error")
  confidence: number;            // 0.0-1.0
  context: any;                  // Type-specific context
  createdAt: Date;
}

type KnowledgeType = 
  | 'fact'           // Direct observation
  | 'relationship'   // Link between entities
  | 'inference';     // Derived knowledge
```

---

## Design Decisions

### D1: Knowledge Depends on Evidence (CRITICAL)

**Decision**: Every knowledge item must reference an evidence item.

**Rationale**: 
- Auditability: "Why do we believe X?" → Point to evidence
- No hallucination: Knowledge grounded in observed evidence
- Replay: Can reconstruct knowledge extraction from evidence

**Implementation**: Postgres foreign key constraint `knowledge.evidence_id REFERENCES evidence.id`

**Exit Criteria**: Test verifies foreign key enforcement.

---

### D2: Extraction Rules Per Evidence Type

**Decision**: Each evidence type has one or more extraction rules.

**Rationale**:
- Different evidence types require different extraction logic
- `git_diff` → Changed files, lines modified
- `terminal_output` → Commands, exit codes, output patterns
- `test_result` → Tests passed/failed, coverage metrics

**Implementation**: Registry pattern with `Extractor` interface.

---

### D3: Extraction is Deterministic

**Decision**: Same evidence always produces same knowledge.

**Rationale**:
- Replay: Can re-extract knowledge at any time
- Debugging: Can trace knowledge to extraction rule
- Reproducibility: Knowledge extraction is not inference (yet)

**Implementation**: Pure functions, no randomness, no external state.

**Exit Criteria**: Test verifies identical evidence produces identical knowledge.

---

### D4: Knowledge is Immutable (Append-Only)

**Decision**: Knowledge cannot be modified after creation.

**Rationale**: Matches evidence immutability (Phase 1 G5).

**Implementation**: Database trigger similar to evidence provenance.

---

## Extraction Examples

### Example 1: Terminal Output → Command Knowledge

**Evidence**:
```json
{
  "type": "terminal_output",
  "content": {
    "command": "npm test",
    "exitCode": 0,
    "output": "All tests passed"
  }
}
```

**Knowledge**:
```json
[
  {
    "type": "fact",
    "subject": "npm_test",
    "predicate": "succeeded",
    "object": "true",
    "confidence": 1.0,
    "context": { "exitCode": 0 }
  },
  {
    "type": "fact",
    "subject": "npm_test",
    "predicate": "output_contains",
    "object": "All tests passed",
    "confidence": 1.0
  }
]
```

---

### Example 2: Git Diff → Change Knowledge

**Evidence**:
```json
{
  "type": "git_diff",
  "content": {
    "files": ["src/index.ts", "src/server.ts"],
    "additions": 45,
    "deletions": 12
  }
}
```

**Knowledge**:
```json
[
  {
    "type": "fact",
    "subject": "src/index.ts",
    "predicate": "modified_in",
    "object": "commit_abc123",
    "confidence": 1.0
  },
  {
    "type": "relationship",
    "subject": "src/index.ts",
    "predicate": "changed_with",
    "object": "src/server.ts",
    "confidence": 1.0
  }
]
```

---

### Example 3: Test Result → Failure Knowledge

**Evidence**:
```json
{
  "type": "test_result",
  "content": {
    "suite": "Unit Tests",
    "passed": 42,
    "failed": 1,
    "failures": [
      { "test": "should authenticate", "error": "timeout" }
    ]
  }
}
```

**Knowledge**:
```json
[
  {
    "type": "fact",
    "subject": "test_suite:Unit Tests",
    "predicate": "pass_rate",
    "object": "0.976",
    "confidence": 1.0
  },
  {
    "type": "fact",
    "subject": "test:should_authenticate",
    "predicate": "failed_with",
    "object": "timeout",
    "confidence": 1.0
  }
]
```

---

## Implementation Plan

### Week 1: Foundation
- [ ] Create knowledge table with FK to evidence
- [ ] Implement knowledge insertion pipeline
- [ ] Add query API for knowledge retrieval
- [ ] Verify "no knowledge without evidence"

### Week 2: Extraction Rules
- [ ] Implement extractor for `terminal_output`
- [ ] Implement extractor for `git_diff`
- [ ] Implement extractor for `test_result`
- [ ] Verify extraction determinism

### Week 3: Remaining Types
- [ ] Implement remaining 7 extractors
- [ ] Integration testing
- [ ] Phase 2 verification suite

### Week 4: Freeze
- [ ] Document ADRs for Phase 2
- [ ] Run verification suite
- [ ] Create Phase 2 freeze package

---

## Interfaces (Draft)

### KnowledgeExtractor

```typescript
interface KnowledgeExtractor {
  /**
   * Extract knowledge from evidence
   * @returns Array of knowledge facts
   */
  extract(evidence: Evidence): Knowledge[];
}
```

### ExtractionPipeline

```typescript
interface ExtractionPipeline {
  /**
   * Run extraction on all evidence
   */
  run(): Promise<void>;
  
  /**
   * Extract knowledge for specific evidence
   */
  extractForEvidence(evidenceId: string): Promise<void>;
}
```

### KnowledgeProvider

```typescript
interface KnowledgeProvider {
  store(knowledge: Knowledge): Promise<string>;
  query(query: KnowledgeQuery): Promise<Knowledge[]>;
  findBySubject(subject: string): Promise<Knowledge[]>;
}
```

---

## Dependencies on Phase 1

- Evidence table (must exist)
- EvidenceProvider (read-only)
- Evidence types (frozen)
- Provenance schema (frozen)

**Phase 1 Guarantees Used**:
- G1: Provenance available for knowledge debugging
- G2: Content hash for deduplication
- G6: Repository context for knowledge scoping

---

## Risks

### R1: Extraction Quality
**Risk**: Knowledge extraction produces noisy or incorrect facts.  
**Mitigation**: Confidence scores, extraction rule testing, manual review.

### R2: Schema Evolution
**Risk**: Knowledge schema changes break compatibility.  
**Mitigation**: Version knowledge schema, use JSONB for flexibility.

### R3: Performance
**Risk**: Large evidence sets slow extraction.  
**Mitigation**: Batch processing, lazy extraction, incremental updates.

---

## Open Questions

1. Should knowledge be repository-scoped or global?
2. How to handle knowledge conflicts (same fact, different confidence)?
3. Should we store extraction metadata (which rule produced which knowledge)?
4. Knowledge retention policy?

These will be resolved in ADRs during implementation.

---

## Exit Criteria (Draft)

- EK1: Knowledge table exists with FK to evidence ✅
- EK2: All 10 evidence types have extractors ✅
- EK3: Extraction is deterministic ✅
- EK4: Knowledge is immutable ✅
- EK5: Query API functional ✅
- EK6: "No knowledge without evidence" enforced ✅
- EK7: Phase 2 verification suite passes ✅

---

**Next Step**: Create knowledge table migration.
