# Evaluation Metadata

Purpose: Track evaluation runs for reproducibility

## Evaluation Session Template

When running benchmarks, record:

```yaml
evaluation:
  provider: openai
  model: text-embedding-3-small
  corpus_version: v2
  timestamp: 2026-07-19T10:30:00Z
  commit: abc123def
  config:
    dimension: 1536
    similarity: cosine
    neo4j_version: 2026.06.0
  
  results:
    top1_accuracy: 82%
    recall_5: 96%
    recall_10: 98%
    mrr: 0.912
    ndcg: 0.885
    latency_avg: 108
    latency_p95: 145
```

## Why Metadata Matters

**Without metadata:**
- Can't reproduce historical results
- Can't compare providers fairly
- Don't know if regression is due to code or data changes

**With metadata:**
- Every run is reproducible
- Can detect configuration drift
- Can attribute changes to specific factors

## Implementation

Future: Store evaluation metadata alongside results

```typescript
interface EvaluationRun {
  metadata: {
    provider: string;
    model: string;
    corpus_version: string;
    timestamp: Date;
    commit: string;
    config: Record<string, any>;
  };
  
  results: {
    top1_accuracy: number;
    recall_5: number;
    recall_10: number;
    mrr: number;
    ndcg: number;
    latency_avg: number;
    latency_p95: number;
  };
}
```

## Usage Example

```bash
# Run evaluation
npm run evaluate:retrieval-v2 -- --save-run

# Compare with baseline
npm run compare-evaluations -- baseline=v2.1 current=v2.2

# Expected output
Provider change: mock → text-embedding-3-small
Top-1 changed: 0% → 82%
Recall@5 changed: 0% → 96%
Latency changed: 368ms → 108ms
```

## Current Status

Metadata tracking not yet implemented. Add when comparing providers.
