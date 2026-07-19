# Knowledge Layer Invariants

These invariants form the "constitution" of Phase 2. Every implementation and test must be traceable to one of these guarantees.

**System Context:** Phase 2 invariants complement the [System-Wide Invariants](../INVARIANTS.md). Both must be upheld.

---

## Invariant K1: Deterministic Extraction
```
Same evidence → Same knowledge
```
- Given identical evidence, extraction must produce identical knowledge
- No randomness, no clock, no external state
- Guaranteed by pure functions

---

## Invariant K2: Evidence Grounding
```
Knowledge → Has evidence
```
- No knowledge exists without supporting evidence
- FK constraint enforces provenance
- Evidence is the source of truth

---

## Invariant K3: Knowledge Immutability
```
Knowledge cannot be modified
```
- Append-only knowledge graph
- Updates become new knowledge records
- Historical integrity preserved

---

## Invariant K4: Deterministic Hash
```
Knowledge hash = SHA256(canonical(subject, predicate, object, type))
```
- Confidence is metadata, not identity
- Hash excludes evidenceId (allows many-to-one)
- Hash excludes confidence (allows certainty updates)

---

## Invariant K5: Extraction Purity
```
Extractors have no side effects
```
- No database calls
- No network calls
- No filesystem access
- No clock or random
- Deterministic output

---

## Invariant K6: Canonical Serialization
```
{subject, predicate, object, type} → canonical JSON → hash
```
- Whitespace collapsed to single space
- Fields sorted alphabetically
- Case-sensitive (ADR: real identifiers are case-sensitive)

---

## Invariant K7: Many-to-One Support
```
Evidence A ─┐
Evidence B ─┼→ Knowledge K
Evidence C ─┘
```
- Many evidence can support one knowledge
- knowledge_support junction table tracks provenance
- Knowledge identity independent of evidence

---

## Invariant K8: Replay Integrity
```
Stored knowledge → Canonicalize → Hash → Matches database
AND
Stored knowledge → Support records → Re-extract → Compare
```
- Replay verification uses database hash column
- Not in-memory index (RAM corruption safety)
- Verifies identity AND provenance
- All support records must exist

---

## Invariant K9: Extractor Metadata
```
Every knowledge includes extractor_name + extractor_version
```
- Extraction rules evolve
- Provenance traceable
- Debugging possible years later

---

## Invariant K10: Bounded Resources

Memory usage bounded at pipeline initialization
```
Cache: max 10k entries
LRU eviction
DB query on miss
```
- No unbounded Map growth
- No database preload
- Long-running processes safe

---

## Invariant K11: Hash Identity Immutability
```
Canonicalization formula NEVER changes across versions

Mockingbird v1.0 → v2.0 → v3.0
  Knowledge identity hash remains identical

If canonicalization MUST change:
  - Create NEW version field
  - Keep OLD hash column
  - Migration path documented
```

**Why this matters:**
- Changing hash formula → Breaking replay
- Breaking replay → Invalidating all audit trails
- Invalidating audit trails → Regulatory violation

**Required: KnowledgeHasher as single source of truth**

All code paths use `KnowledgeHasher.hash()`:
- Pipeline admission
- Replay verification  
- Test verification
- Database migration
- Extractor testing

Never duplicate canonicalization logic.

---

## Verification Mapping (Legacy)

| Invariant | Test |
|-----------|------|
| K1 | testExtractionDeterminism (10 iterations) |
| K2 | testFKConstraint (no knowledge without evidence) |
| K3 | testKnowledgeImmutability (trigger enforcement) |
| K4 | testHashDeterminism, testCanonicalization |
| K5 | testExtractorPurity |
| K6 | testCanonicalization (whitespace) |
| K7 | testMultipleEvidenceSameFact |
| K8 | testReplayVerification |
| K9 | Stored in extractor_name, extractor_version columns |
| K10 | Replaced global Map with bounded cache |

---

These invariants are the architectural contract. Any violation breaks Phase 2 guarantees.

---

## Invariant K12: Knowledge Must Have Support
```
Every knowledge row has
at least one knowledge_support record
```

**Why this matters:**
- Provenance is mandatory
- Orphan knowledge = broken audit trail
- Cannot have knowledge without showing HOW it was extracted

**Enforcement:**
- Transaction boundary around knowledge + support writes (K6)
- ON DELETE RESTRICT on foreign keys
- During replay: verify support records exist

**Violation example:**
```
BEGIN
  INSERT knowledge
  -- crash here
  -- support never inserted
COMMIT
```
Result: Orphan knowledge (violates K12)

**Fixed by:** Atomic transaction (BEGIN → insert both → COMMIT)

---

## Verification Table (Updated)

| Invariant | Test |
|-----------|------|
| K1 | testExtractionDeterminism (10 iterations) |
| K2 | testFKConstraint (no knowledge without evidence) |
| K3 | testKnowledgeImmutability (trigger enforcement) |
| K4 | testHashDeterminism, testCanonicalization |
| K5 | testExtractorPurity |
| K6 | testCanonicalization (whitespace) |
| K7 | testMultipleEvidenceSameFact |
| K8 | testReplayVerification |
| K9 | Stored in extractor_name, extractor_version columns |
| K10 | Replaced global Map with bounded cache |
| K11 | KnowledgeHasher as single source of truth |
| K12 | Transaction boundary, foreign keys RESTRICT |

---

## Invariant K13: First-Writer-Wins Concurrency
```
Concurrent knowledge admissions with identical hash:
  Database enforces UNIQUE(hash)
  First INSERT wins
  Subsequent writers receive support records
```

**Why this matters:**
- Two extractors process same evidence concurrently
- Both generate identical knowledge hash
- Only ONE knowledge row should exist
- Both evidence must still be linked (many-to-one)

**Enforcement:**
- Database UNIQUE(hash) constraint
- Pipeline catches PostgreSQL error code `23505`
- On unique violation: attach support record to winner
- All transactions are atomic (BEGIN → INSERT → COMMIT)

**Race condition handling:**
```
A: findByHash → none
B: findByHash → none
A: INSERT (wins)
B: INSERT → 23505 → catch → findByHash → attach support
```

Winner inserts knowledge + support.
Loser attaches ONLY support record.

---

## Invariant K14: Confidence Is Nullable Pending Aggregation
```
knowledge.confidence = nullable
```

**Phase 2 Status:**
- Confidence is stored but not aggregated
- First evidence's confidence is recorded in support table
- No canonical aggregation rule defined yet

**Phase 3 Will Define:**
- Which confidence to use (max? latest? weighted?)
- How to aggregate from multiple support records
- Whether knowledge.confidence should be nullable

**Current Implementation:**
- Support records include confidence per extraction
- Knowledge.confidence copied from first evidence (provisional)
- Awaiting Phase 3 aggregation semantics

---

## Verification Table (Updated)

| Invariant | Test |
|-----------|------|
| K1 | testExtractionDeterminism (10 iterations) |
| K2 | testFKConstraint (no knowledge without evidence) |
| K3 | testKnowledgeImmutability (trigger enforcement) |
| K4 | testHashDeterminism, testCanonicalization |
| K5 | testExtractorPurity |
| K6 | testCanonicalization (whitespace) |
| K7 | testMultipleEvidenceSameFact |
| K8 | testReplayVerification |
| K9 | Stored in extractor_name, extractor_version columns |
| K10 | Bounded LRU cache (10k entries) |
| K11 | KnowledgeHasher as single source of truth |
| K12 | Transaction boundary, foreign keys RESTRICT |
| K13 | UNIQUE(hash) constraint, 23505 race handling |
| K14 | Confidence nullable in schema, no aggregation yet |

---

## Replay Modes (Phase 2 Documentation)

**Strict Replay:**
- Use original extractor version from support record
- Deterministic: same inputs = same outputs
- For audit/compliance verification

**Migration Replay (Phase 3):**
- Use latest extractor version
- Non-deterministic across versions
- For knowledge refresh after extractor upgrades

**Current Implementation:**
- `verifyReplay()` checks identity + support + metadata
- Returns detailed `ReplayVerificationResult`
- Phase 2 focuses on strict replay only

---

**All 14 invariants are the architectural contract. Any violation breaks Phase 2 guarantees.**
