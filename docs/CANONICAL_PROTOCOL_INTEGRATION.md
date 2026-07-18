# Canonical Protocol Integration

## Source
- **Repository**: `/Users/adarshagnihotri/Desktop/Projects/whyAI references/canonical-protocol`
- **RFC**: RFC-0001: Canonical Serialization Protocol
- **Status**: Draft (has undecided decisions)

## Usage in Evidence Layer

The canonical protocol ensures that:
1. Evidence deduplication works across languages and implementations
2. Hash collisions are impossible for semantically different data
3. Evidence replay produces byte-identical results

## Key Specifications

### INV-001: Uniqueness
Each semantic value has exactly one canonical byte representation.

### INV-002: Determinism  
Same input always produces same output.

### INV-003: Round-Trip
Serialization preserves semantic equality.

## Implementation Requirements

Per RFC-0001 Section "Data Model":

### Supported Types
- Null: `null`
- Boolean: `true`, `false`
- Number: ECMA-262 §7.1.12.1 (awaiting DECISION-002)
- String: Raw UTF-8, minimal escaping (awaiting DECISION-009)
- Array: `[1,2,3]` (no whitespace)
- Object: `{"a":1}` (keys sorted by UTF-8 byte order)

### Blocking Decisions (from RFC-0001)

| Decision | Priority | Status | Impact on Evidence Layer |
|----------|----------|--------|--------------------------|
| DECISION-007 | FOUNDATIONAL | 🔴 UNDECIDED | Number domain (integer vs float) |
| DECISION-002 | CRITICAL | 🔴 UNDECIDED | Number representation |
| DECISION-009 | CRITICAL | 🔴 UNDECIDED | String escaping |
| DECISION-008 | MEDIUM | 🔴 UNDECIDED | Sparse arrays |

## Current Approach

Until canonical protocol is finalized, we use:
- **Key sorting**: UTF-8 byte-order (algorithm complete)
- **String escaping**: Minimal UTF-8 (algorithm complete)
- **Number serialization**: JSON.stringify (subject to change after DECISION-002)
- **Array handling**: Dense arrays only

## Test Vectors

The canonical protocol repository has 95 test vectors with 1200+ target.
We should use these for conformance testing once integrated.

See: `/Users/adarshagnihotri/Desktop/Projects/whyAI references/canonical-protocol/test-vectors/`
