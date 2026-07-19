# Documentation Navigation

This page indexes the primary technical documentation. Each topic has a single canonical document; other documents should link to it instead of duplicating its contents.

---

## Canonical Documents

| Concept | Document | Scope |
|---------|----------|-------|
| **Canonical Serialization** | [CANONICAL_PROTOCOL_INTEGRATION.md](CANONICAL_PROTOCOL_INTEGRATION.md) | Protocol spec |
| **System Invariants** | [INVARIANTS.md](INVARIANTS.md) | Runtime guarantees |
| **Memory Architecture** | [MEMORY_ARCHITECTURE_DESIGN.md](MEMORY_ARCHITECTURE_DESIGN.md) | System design |
| **Evaluation Methodology** | [EVALUATION_FRAMEWORK.md](EVALUATION_FRAMEWORK.md) | Retrieval evaluation |
| **Query Pipeline** | [QUERY_TO_ANSWER_PIPELINE.md](QUERY_TO_ANSWER_PIPELINE.md) | End-to-end flow |
| **Phase 1 Decisions** | [architecture/phase1/ADR.md](architecture/phase1/ADR.md) | Evidence Layer ADRs |
| **Phase 2 Design** | [architecture/phase2/DESIGN.md](architecture/phase2/DESIGN.md) | Knowledge Layer |
| **Phase 3 Architecture** | [architecture/phase3/ARCHITECTURE.md](architecture/phase3/ARCHITECTURE.md) | Projection Layer |

Treat the listed document as the canonical definition of the concept. Other documents should reference it rather than duplicate its contents.

---

## Phase Documentation

### [Phase 1 — Evidence Layer](architecture/phase1/README.md) ✅ Frozen
- [ADR](architecture/phase1/ADR.md) - Architectural decisions
- [Verification](architecture/phase1/VERIFICATION_REPORT.md) - Test evidence

### [Phase 2 — Knowledge Layer](architecture/phase2/DESIGN.md) ✅ Frozen
- [Invariants](architecture/phase2/INVARIANTS.md) - Knowledge guarantees (K1-K14)
- [Freeze Certificate](architecture/phase2/PHASE_2_FROZEN.md)

### [Phase 3 — Projection Layer](architecture/phase3/README.md) 🚧 In Progress
- [Architecture](architecture/phase3/ARCHITECTURE.md) - System design
- [Invariants](architecture/phase3/INVARIANTS.md) - Projection guarantees (G1-G8)

---

## Historical Design Records

- [Implementation Summary](../IMPLEMENTATION_SUMMARY.md) - Design rationale
- [Spike Summary](../SPIKE_SUMMARY.md) - Technology decisions
- [External Integrations](architecture/External_Integrations.md) - Integration points
