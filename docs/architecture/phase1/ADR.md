# Architecture Decision Record: Phase 1 Evidence Layer

## Status: FROZEN (2026-07-18)

Phase 1 is now frozen. No further modifications without explicit versioning.

---

## ADR-001: External Canonical Protocol Adoption

**Date**: 2026-07-16  
**Status**: Accepted  
**Decision**: Adopt RFC-0001 Canonical Serialization Protocol from external repository

### Context
Evidence must be reproducibly serializable and content-addressable. Building a custom protocol introduces risk of non-determinism and lacks independent verification.

### Decision
Consume canonical protocol from `/Users/adarshagnihotri/Desktop/Projects/whyAI references/canonical-protocol/protocol/rfc/Documents/2026-07-05_RFC-0001-canonical-serialization-protocol.md`

### Invariants Adopted
- **INV-001**: Content-Addressable Storage - SHA-256 hash uniquely identifies evidence
- **INV-002**: Deterministic Serialization - UTF-8 byte-order recursive key sorting
- **INV-003**: Provenance Tracking - Full context preservation

### Consequences
- Protocol correctness delegated to external specification
- Implementation must match RFC-0001 exactly
- Protocol version coupled to RFC revision

---

## ADR-002: PostgreSQL JSONB Storage

**Date**: 2026-07-16  
**Status**: Accepted  
**Decision**: Store evidence as JSONB in PostgreSQL

### Context
Evidence content varies by collector type. Need flexible storage that supports querying and indexing.

### Decision
Use PostgreSQL JSONB with:
- UUID primary keys
- Content hash unique constraint
- Type check constraint
- JSONB indexes on repository, type, timestamp

### Alternatives Considered
1. **Blob storage (S3)**: Poor queryability, requires external index
2. **Document store (MongoDB)**: Lacks transactional guarantees with codebase
3. **File system**: No concurrent access, backup complexity

### Consequences
- Full ACID guarantees with application code
- Rich JSON querying capabilities
- Single database for entire stack
- Must handle schema evolution via migrations

---

## ADR-003: Global Deduplication by Content Hash

**Date**: 2026-07-17  
**Status**: Accepted  
**Decision**: Evidence deduplicated globally by content hash across all repositories

### Context
Same evidence may be collected from different repositories or sessions (e.g., identical git diff). Need policy for handling duplicates.

### Decision
Content hash is globally unique. Duplicate admissions rejected with `DUPLICATE_DETECTED`. Repository context preserved in provenance metadata.

### Alternatives Considered
1. **Per-repository deduplication**: Same content stored multiple times, wasteful
2. **Per-session deduplication**: Loses cross-session evidence sharing
3. **No deduplication**: Unbounded storage growth

### Consequences
- Storage efficiency (same content stored once)
- Evidence shared across repositories
- Must track repository context in provenance, not evidence identity
- Repository isolation enforced at query time, not storage time

---

## ADR-004: Admission Pipeline with Reject-on-Duplicate

**Date**: 2026-07-17  
**Status**: Accepted  
**Decision**: 6-stage admission pipeline throws on duplicate detection

### Context
Evidence admission must ensure invariants before storage. Need clear error signaling.

### Decision
Pipeline architecture:
1. Collector → Raw evidence input
2. Normalizer → Type validation
3. Canonical Serializer → Deterministic JSON
4. Hasher → SHA-256 computation
5. Validator → Schema verification
6. Admission Policy → Duplicate check (throws `DUPLICATE_DETECTED`)
7. Provider → PostgreSQL storage

### Consequences
- Early rejection of invalid evidence
- Clear error messages for debugging
- Pipeline must be caught at call site for error handling
- Idempotent admission possible by catching `DUPLICATE_DETECTED`

---

## ADR-005: Provenance Immutability via Database Trigger

**Date**: 2026-07-18  
**Status**: Accepted  
**Decision**: Prevent provenance modification via PostgreSQL trigger

### Context
Provenance metadata must remain immutable after insertion. Application-level enforcement insufficient.

### Decision
Database trigger `prevent_provenance_modification()` raises exception on UPDATE to `provenance` column.

### Consequences
- Database-level guarantee, not just application-level
- Requires migration to modify (intentional friction)
- Provenance schema evolution requires trigger update

---

## ADR-006: Strong Repository Identity

**Date**: 2026-07-18  
**Status**: Accepted  
**Decision**: Repository identification via SHA-256 hash of remote URL or path

### Context
Repository identity must prevent collisions between different repositories with same folder name.

### Decision
```typescript
repositoryId = SHA256(gitRemote || absolutePath)
```

Include in provenance:
- repositoryId (hash)
- branch (string)
- commit (string, may be 'unknown')
- gitStatus ('clean' | 'dirty' | 'unknown')
- remote (URL or path)

### Consequences
- Strong identity guarantee
- Same repository identifiable across machines (if remote URL)
- Local repositories identified by absolute path
- gitStatus tracks working directory state

---

## ADR-007: UTF-8 Byte-Order Canonical Serialization

**Date**: 2026-07-18  
**Status**: Accepted  
**Decision**: Recursive key sorting using UTF-8 byte comparison

### Context
JSON key ordering must be deterministic. Default `JSON.stringify` order is unpredictable.

### Decision
```typescript
function sortKeys(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(sortKeys);
  }
  if (obj !== null && typeof obj === 'object') {
    const sorted: any = {};
    Object.keys(obj)
      .sort((a, b) => Buffer.from(a, 'utf8').compare(Buffer.from(b, 'utf8')))
      .forEach(key => sorted[key] = sortKeys(obj[key]));
    return sorted;
  }
  return obj;
}
```

### Consequences
- Identical objects always serialize to identical strings
- Hash computation deterministic across runs
- Must maintain this logic exactly across all versions

---

## ADR-008: Single Hash Computation Point

**Date**: 2026-07-18  
**Status**: Accepted  
**Decision**: Pipeline computes hash, provider verifies (never recomputes)

### Context
Hash computation must have single source of truth to prevent divergence.

### Decision
- Admission pipeline computes SHA-256 hash during serialization
- Provider receives hash and verifies length (64 chars)
- Provider never recomputes hash

### Consequences
- Hash is authoritative from pipeline
- Provider verification catches implementation errors
- Hash mismatch would indicate serious bug

---

## Frozen Decisions Summary

| ADR | Decision | Status |
|-----|----------|--------|
| 001 | Adopt RFC-0001 canonical protocol | ✅ Frozen |
| 002 | PostgreSQL JSONB storage | ✅ Frozen |
| 003 | Global deduplication by content hash | ✅ Frozen |
| 004 | 6-stage admission pipeline with rejection | ✅ Frozen |
| 005 | Provenance immutability trigger | ✅ Frozen |
| 006 | Strong repository identity (SHA-256) | ✅ Frozen |
| 007 | UTF-8 byte-order canonical serialization | ✅ Frozen |
| 008 | Single hash computation point | ✅ Frozen |

---

## Version

- **Phase**: 1 - Evidence Layer
- **Version**: 1.0.0
- **Frozen**: 2026-07-18
- **Schema Version**: 004 (migrations/004_evidence_fixes.sql)
