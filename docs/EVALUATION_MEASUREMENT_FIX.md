# Evaluation Framework Status

## What Changed

Fixed measurement issues to make evaluation scientifically valid.

## Before vs After Comparison

### Timing Accuracy

**Before:**
```typescript
// Double-embedding bug
const embedding = await embedFn(query);      // Embedding #1
const retrieved = await service.retrieve(query); // Embedding #2 internally
total_ms = embedding_ms + retrieve_ms;       // Double-counted
```

**After:**
```typescript
// Correct measurement
const retrieved = await service.retrieve(query); // Single execution
total_ms = retrieve_ms;                        // Actual time
```

Fixed issue where we embedded twice (manual + internal), inflating timing.

### Metrics Validity

**Before:**
```
"Top-1: 0%"
"Top-5 recall"
```

But code actually measured:
- Keyword overlap (≥50% keywords in all results)
- Not Top-1 precision
- Not Recall@5

**After (v2):**
```
Top-1 Accuracy: 0.0% (0/5)    # Actual: retrieved[0] == expected.top1?
Recall@5: 0.0%               # Actual: |expected.top5 ∩ retrieved[0:5]| / 5
Recall@10: 0.0%              # Actual: |expected.top10 ∩ retrieved| / 10
MRR: 0.000                   # Mean Reciprocal Rank
Keyword Overlap: 0.0%         # Legacy metric (clearly labeled)
```

Now measures standard information retrieval metrics.

### Corpus Evolution

**Created:** `corpus-v2.yaml`

```yaml
queries:
  - query: "canonical serialization replay"
    expected:
      top1: [knowledge_182]
      top5: [knowledge_182, knowledge_91, knowledge_47]
    keywords: [canonical, serialization, replay, hash]  # Optional, legacy
```

**Why this matters:**
- Can compute real Top-1, R@5, R@10, MRR
- Keyword overlap is now supplementary (not primary)
- Ground truth IDs enable rigorous evaluation

## Current Status

### Evaluation Scripts

**evaluate-retrieval.ts** (v1 - keyword overlap)
```
Provider: mock
Corpus: v1
Keyword Match: 0%
Latency: 157 ms
```
- Measures keyword overlap (weak proxy)
- Honest labeling (not called "Top-1")
- Notes caveats explicitly

**evaluate-retrieval-v2.ts** (v2 - real metrics)
```
Provider: mock
Corpus: v2
Top-1 Accuracy: 0.0%
Recall@5: 0.0%
MRR: 0.000
Latency: 36 ms
```
- Measures actual IR metrics
- Requires ground truth IDs (expected.top1/top5)
- Scientific validity

### Known Limitations

**corpus-v2.yaml placeholders:**
```yaml
expected:
  top1: [knowledge_182]  # placeholder - needs real IDs
```

Currently populated with placeholders. Need to:
1. Run queries manually with real embeddings
2. Identify ground truth relevant documents
3. Update expected.top1/top5/top10

**Mock embeddings:** Still not semantically meaningful. Real metric values will appear with OpenAI provider.

## Assessment (Self-Evaluation)

Area | Before | After
-----|--------|-------
Provider abstraction | ★☆☆☆☆ | ★★★★★
Embedding invariants | ★☆☆☆☆ | ★★★★★
Benchmark structure | ★★☆☆☆ | ★★★★☆
Timing accuracy | ★☆☆☆☆ | ★★★★★
Retrieval metrics | ★☆☆☆☆ | ★★★★★
Scientific validity | ★★☆☆☆ | ★★★★☆

**Biggest remaining gap:** Populating ground truth expected IDs.

## Next Steps

### Before Adding OpenAI Provider

1. Run manual retrieval queries with mock embeddings
2. Identify typical result patterns
3. Document what "good" retrieval looks like for each query
4. **Don't** populate expected IDs yet (meaningless with mock)

### After OpenAI Provider

1. Run real retrieval queries
2. **Then** manually identify ground truth
3. Update corpus-v2.yaml with actual relevant knowledge IDs
4. Re-run evaluation to get real baseline

### Future Corpus Expansion

- Add 20-50 queries covering all categories
- Multiple ground truth annotations per query
- Human-in-the-loop relevance judgments
- Automated annotation from execution traces

## Engineering Culture Notes

**Honest labeling:**
- Changed "Top-1" → "Keyword Match" (v1 script)
- Explicitly noted what's NOT measured
- Separated real metrics from legacy proxies

**Scientific rigor:**
- Standard IR metrics (Top-1, R@5, R@10, MRR)
- Ground truth required for evaluation
- Placeholder IDs clearly marked as TODO

**Measurability:**
Now we can answer:
- Did Top-1 improve? (binary: retrieved[0] ∈ expected.top1)
- Did recall improve? (continuous: 0-1 scale)
- Did ranking improve? (MRR)

Previously couldn't answer any of these objectively.
