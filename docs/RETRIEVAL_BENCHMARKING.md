# Retrieval Benchmarking Architecture

## Current Status

**Component Assessment:**

Area | Status | Notes
-----|--------|-------
Embedding abstraction | ✅ Strong | Provider-agnostic, dimension validation
Provider benchmarking | ✅ Strong | Can compare OpenAI/Voyage/Nomic/Ollama
Evaluation framework | ✅ Good | Both exploratory (v1) and scientific (v2)
Scientific metrics | ✅ Strong | Top-1, R@1, R@5, R@10, MRR
Relevance judgments | ✅ Structure ready | Hash-based, immutable IDs
Ground-truth corpus | 🟡 Needs populated | Placeholders until real embeddings
Statistical rigor | 🔜 Future | Multi-run, confidence intervals, significance tests

## Architecture Evolution

### Corpus Design

**Before:**
```yaml
expected:
  top1: [knowledge_182]
  top5: [knowledge_182, knowledge_91]
  top10: [knowledge_182, knowledge_91, knowledge_47]
```

**Problem:** Adding R@1, Precision@5, NDCG requires redesigning corpus.

**After:**
```yaml
relevant:
  - hash: abc123def456
  - hash: def789ghi012
  - hash: jkl345mno678
```

**Benefit:** All metrics computed from same ground truth.

```typescript
// Compute all metrics from relevance set
const relevantHashes = query.relevant.map(r => r.hash);

metrics.top1 = relevantHashes.includes(retrieved[0]);
metrics.recall1 = relevantHashes.includes(retrieved[0]) ? 1 : 0;
metrics.recall5 = relevantHashes.filter(h => retrieved.slice(0, 5).includes(h)).length / relevantHashes.length;
metrics.recall10 = relevantHashes.filter(h => retrieved.includes(h)).length / relevantHashes.length;
metrics.mrr = 1 / (position_of_first_relevant + 1);
metrics.ndcg = computeNDCG(retrieved, relevantHashes);
```

### Stable Identifiers

**Why hash instead of database ID:**

Database IDs (UUIDs) change when you rebuild:
```bash
DROP DATABASE bedrock_proxy;
CREATE DATABASE bedrock_proxy;
# All IDs are now different
```

Hash remains stable:
```typescript
// Hash computed from canonical form
const hash = sha256(`${subject}:${predicate}:${object}:${type}`);
```

Rebuild database → IDs change, hashes stay same → Benchmark remains valid.

## Evaluation Scripts

### v1: Exploratory (Developer Diagnostics)

```bash
npm run evaluate:retrieval
```

**Output:**
```
Provider: mock
Corpus: v1
Keyword Match: 0%
Latency: 157 ms
```

**Use case:** Fast sanity check during development
- Does retrieval return anything?
- Did latency regress?
- Did obvious concepts appear?

**Not for:** Scientific provider comparison

### v2: Scientific (Benchmark)

```bash
npm run evaluate:retrieval-v2
```

**Output:**
```
Provider: mock
Corpus: v2
Queries: 5

Retrieval Metrics:
  Top-1 Accuracy: 0.0%
  Recall@1: 0.0%
  Recall@5: 0.0%
  Recall@10: 0.0%
  MRR: 0.000
  Latency: 171 ms
```

**Use case:** Research-grade provider comparison
- Rigorous IR metrics
- Ground-truth relevance judgments
- Reproducible benchmarks

## Metric Definitions

### Top-1 Accuracy
```
Was result #1 relevant?
Binary: retrieved[0] ∈ relevant ? 1 : 0
```

### Recall@K
```
What fraction of relevant docs appeared in top K?
|relevant ∩ retrieved[0:K]| / |relevant|
```

### Mean Reciprocal Rank (MRR)
```
Average position of first relevant result (inverted)
MRR = Σ (1 / position_of_first_relevant) / N
```

### Future: NDCG (Normalized Discounted Cumulative Gain)
```
Accounts for ranking quality (not just presence)
NDCG = DCG / IDCG
where DCG = Σ rel_i / log2(i+1)
```

## Benchmark Reproducibility

### Current Gaps

1. **Ground-truth corpus placeholder**: Need to run real queries, manually label relevance
2. **Mock embeddings**: Not semantically meaningful (placeholder only)
3. **Single evaluation run**: No confidence intervals yet

### Required for Reproducible Benchmark

1. **Fixed dataset**:
   ```bash
   pg_dump bedrock_proxy > benchmark/baseline.sql
   ```

2. **Populated relevance judgments**:
   - Run queries with OpenAI embeddings
   - Human-in-the-loop relevance labeling
   - At least 20 queries, 3+ relevant docs each

3. **Multiple runs with statistics**:
   ```bash
   npm run evaluate:benchmark -- --runs 10
   ```

   Output:
   ```
   Provider: text-embedding-3-small
   Top-1: 82.3% ± 3.1%
   Recall@5: 96.2% ± 1.4%
   Latency: 108 ± 12 ms
   ```

4. **Significance testing**:
   ```
   OpenAI vs Voyage: p=0.03 (statistically significant difference)
   ```

## Next Steps

### Before Adding OpenAI Provider

**Don't populate relevance judgments yet.** Mock embeddings are not meaningful.

### After OpenAI Provider

1. Run evaluation with real embeddings
2. Manually inspect results for 5 pilot queries
3. Label relevance judgments (human judgment)
4. Expand corpus to 20-50 queries
5. Add multiple runs with confidence intervals

### Future Enhancements

**Performance breakdown:**
```
Embedding       18 ms
Neo4j ANN        7 ms
Hydration      14 ms
Re-ranking      3 ms (future)
Serialization   1 ms (future)
Total          43 ms
```

**Category-specific metrics:**
```
Architecture: Top-1 85%, Latency 43 ms
Replay: Top-1 79%, Latency 38 ms
Projection: Top-1 91%, Latency 52 ms
```

**Statistical rigor:**
- Bootstrap confidence intervals
- Paired t-test for provider comparison
- Effect size (Cohen's d) for practical significance

## Engineering Culture

**Honest labeling:**
- V1 script: "Keyword Match" (not "Top-1")
- V2 script: Clear metric definitions
- Placeholders marked as TODO

**Scientific validity:**
- Standard IR metrics (not made-up names)
- Ground truth required (no proxy metrics)
- Stable identifiers (hash, not database ID)

**Measurability:**
All metrics now answer binary questions:
- Did Top-1 improve? ✅ (binary)
- Did recall improve? ✅ (continuous 0-1)
- Did ranking improve? ✅ (MRR)

Previously couldn't answer any of these.
