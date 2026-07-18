# Query to Answer Pipeline

**Question:** Given a user's question, how does the system produce an answer?

---

## Overview

```
Question
    ↓
Embedding
    ↓
Vector Search (Neo4j)
    ↓
Knowledge Retrieval (PostgreSQL)
    ↓
Context Assembly
    ↓
LLM Completion
    ↓
Answer + Provenance
```

---

## 1. Input

**User provides:**
- Natural language question
- Optional context filters (repository, date range, confidence threshold)
- Optional limit (default: 20)

**Example:**
```typescript
{
  query: "Why did the build fail?",
  filters: {
    repository: "bedrock-proxy",
    confidenceMin: 0.8
  },
  limit: 10
}
```

---

## 2. Retrieval

**Step 1: Vector Search**
- Generate embedding for question (OpenAI text-embedding-3-small)
- Query Neo4j with vector index (cosine similarity)
- Return top N knowledge IDs by similarity

**Implementation:**
```cypher
CALL db.index.vector.queryNode('knowledge_embeddings', $limit, $embedding)
YIELD node, score
WHERE node.confidence >= $minConfidence
RETURN node.id, score
ORDER BY score DESC
LIMIT $limit
```

**Step 2: Knowledge Hydration**
- Fetch full knowledge records from PostgreSQL by IDs
- Include evidence IDs and provenance

---

## 3. Ranking

**Multi-factor scoring:**

```
finalScore = 0.5 * vectorSimilarity 
           + 0.3 * confidence 
           + 0.2 * recency
```

**Filtering:**
- Confidence threshold (default: 0.7)
- Repository match (if specified)
- Date range (if specified)

---

## 4. Context Assembly

**Build structured context for LLM:**

```
Context for: "Why did the build fail?"

Knowledge:
1. [0.97] Build failed due to TypeScript error in neo4j-backend.ts:45
2. [0.94] Missing import statement for neo4j-driver
3. [0.89] CI pipeline timeout after 10 minutes
4. [0.85] Dependency version mismatch in package.json

Evidence:
- doc1: CI logs from GitHub Actions
- doc2: TypeScript compiler output
- doc3: Package lock file

Provenance:
- Repository: bedrock-proxy
- Timestamp: 2026-07-19T14:32:00Z
- Trace ID: trace_abc123
```

**Format:**
- Numbered knowledge items with confidence scores
- Evidence summaries (not full content to save tokens)
- Provenance metadata for auditability

---

## 5. LLM Completion

**Prompt structure:**
```
You are a helpful assistant with access to knowledge about the codebase.

Question: ${question}

Context:
${context}

Instructions:
- Answer based only on the provided context
- Cite confidence scores when making claims
- If uncertain, say "based on available context..."
- Include provenance references for verification

Answer:
```

**Model:** Claude 3.5 Sonnet (via Bedrock)

---

## 6. Output

**Response structure:**
```typescript
{
  answer: string,
  sources: [
    {
      knowledgeId: string,
      confidence: number,
      summary: string,
      provenance: {
        repository: string,
        createdAt: Date,
        traceId: string,
        evidenceIds: string[]
      }
    }
  ],
  metadata: {
    retrievalTime: number,
    knowledgeCount: number,
    modelUsed: string
  }
}
```

---

## 7. Provenance

**Full chain of custody:**

```
Answer
    ↓
Knowledge IDs
    ↓
Evidence IDs
    ↓
Original documents (git commits, terminal logs, test results)
    ↓
Trace ID (links back to original execution)
```

**Provenance lookup API:**
```typescript
getProvenance(knowledgeId: string): {
  knowledge: Knowledge,
  evidence: Evidence[],
  trace?: ExecutionTrace
}
```

---

## Key Design Decisions

### Why Neo4j for vector search?
- Knowledge already projected to Neo4j
- Single database for graph + vector queries
- Future relationship traversal can combine vector + graph search

### Why PostgreSQL for hydration?
- Knowledge persistence is PostgreSQL-first
- Full provenance and evidence data in PostgreSQL
- Neo4j stores embeddings, PostgreSQL stores full records

### Why separate ranking from retrieval?
- Vector similarity is one signal, not the only signal
- Confidence and recency improve result quality
- Filters reduce context window usage

### Why structured context assembly?
- LLM performs better with numbered, scored items
- Evidence summaries vs full content saves tokens
- Provenance enables verification

---

## Phase 2A Implementation Plan

### Step 1: Retrieval API
- `retrieveKnowledge(query, options)` → `Knowledge[]`
- Vector search + PostgreSQL hydration
- No ranking, no context assembly (just raw retrieval)

### Step 2: Ranking
- Multi-factor scoring
- Confidence and recency boosts
- Configurable weights

### Step 3: Context Assembly
- Format knowledge + evidence + provenance
- Token counting
- Truncation strategies

### Step 4: End-to-End Pipeline
- Wire retrieval → ranking → context → LLM
- Return answer with provenance

---

## What This Enables

**Immediate:**
- Question answering over codebase knowledge
- Retrieval for debugging, code review, documentation

**Phase 2B (Relationships):**
- Multi-hop reasoning (A → supports → B)
- Contradiction detection
- Graph-based relevance (neighbors of similar nodes)

**Phase 3 (Agents):**
- Agent memory retrieval
- Reflection on past decisions
- Temporal reasoning (state changes over time)

---

**Generated:** 2026-07-19
**Status:** Design complete, ready for retrieval API implementation
