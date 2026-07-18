# Retrieval Evaluation Framework

## Purpose

Answer a different question than before:

- **Before:** "Does the system work?" (Does it execute?)
- **Now:** "Is the system any good?" (Is retrieval useful?)

## What We've Established

Component | Status
----------|--------
Ingestion | ✅ Validated
Projection | ✅ Validated
Embedding pipeline | ✅ Validated
Vector index | ✅ Validated
Retrieval pipeline | ✅ Validated
Evaluation framework | ✅ Validated
Semantic quality | ⏳ Next milestone

## Benchmarking Philosophy

### Provider-Agnostic Design

Instead of OpenAI-specific implementation, we define:

```typescript
interface EmbeddingProvider {
  readonly name: string;          // e.g., "mock", "text-embedding-3-small"
  readonly dimension: number;     // e.g., 1536
  embed(text: string): Promise<number[]>;
}
```

**Why:** Enables benchmarking multiple providers:

```
Provider: mock
Corpus: v1
Top-1: 0%
Latency: 168 ms

Provider: text-embedding-3-small
Corpus: v1
Top-1: 82%
Latency: 108 ms

Provider: nomic-embed-text
Corpus: v1
Top-1: 79%
Latency: 14 ms
```

### Evidence-Driven Evolution

Every future change can now answer questions like:

- Did recall improve?
- Did latency regress?
- Did provider B outperform provider A?
- Did changing ranking weights help?
- Did relationship expansion improve Top-5?

These are the questions mature retrieval teams ask.

## Evaluation Structure

```
evaluation/
  corpus.yaml       # Query format with expected keywords

scripts/
  evaluate-retrieval.ts  # Benchmarking script
```

### Corpus Format

```yaml
version: v1

queries:
  - query: "canonical serialization replay"
    description: "Query about canonical serialization and replay"
    category: Architecture
    expected_keywords:
      - canonical
      - serialization
      - replay
      - hash
    min_hits: 3
```

### Metrics Reported

```
Provider: mock
Corpus: v1
Top-1: 0%
Latency: 168 ms

Timing Breakdown:
  Embedding: 0 ms
  ANN search + hydration: 168 ms
  Total: 168 ms
```

## Current Baseline

**Provider:** `mock`  
**Corpus:** `v1`  
**Top-1:** 0% (expected)  
**Latency:** 168 ms average

**Interpretation:**
- ✅ Pipeline executes successfully
- ❌ Mock embeddings indistinguishable (no semantic meaning)
- Next: Replace with real embedding provider

## Next Steps

### Immediate (Do Now)
1. Implement OpenAI embedding provider
2. Re-run evaluation with `text-embedding-3-small`
3. Establish real baseline (expect 80%+ Top-1)

### Near-Term (20-50 queries)
1. Expand corpus with category coverage:
   - Architecture (5+ queries)
   - Replay (5+ queries)
   - Projection (5+ queries)
   - Canonical serialization (5+ queries)
   - Neo4j (5+ queries)
   - Evidence (5+ queries)
   - Hashing (5+ queries)
   - Embeddings (5+ queries)
   - Relationships (5+ queries)
   - Failures (5+ queries)

2. Detect domain-specific regressions

### Future (After Real Embeddings)
1. Benchmark alternative providers:
   - OpenAI `text-embedding-3-large`
   - Nomic `nomic-embed-text`
   - Voyage AI
   - Local models (Ollama)

2. Optimize ranking:
   - Confidence-weighted scoring
   - Recency boosting
   - Repository filtering

3. Add advanced retrieval:
   - Relationship expansion
   - Multi-hop traversal
   - Reranking stage

## Anti-Patterns (What We're NOT Doing Yet)

❌ **Adding LLM prompting** (until retrieval quality validated)  
❌ **Implementing rerankers** (until baseline established)  
❌ **Building agents** (until retrieval is reliable)  
❌ **Relationship traversal** (until semantic retrieval works)

**Rationale:** Don't build layers on top of a foundation you haven't measured.

## Engineering Culture

We committed:

> Results: 0/5 queries passed (expected with mock embeddings)

Many would hide that. We established a baseline.

Now when we switch to a real embedding provider, we'll have **objective evidence** that quality improved, not intuition.

## Exit Criteria for This Phase

Stop infrastructure work. Move to user-facing features when:

- [ ] Real embedding provider implemented (`text-embedding-3-small`)
- [ ] Baseline Top-1 ≥ 80%
- [ ] Corpus expanded to 20+ queries
- [ ] Provider benchmarking documented
- [ ] Three consecutive evaluation runs show consistent metrics

Then, and only then, add ranking, relationships, or LLM generation.
