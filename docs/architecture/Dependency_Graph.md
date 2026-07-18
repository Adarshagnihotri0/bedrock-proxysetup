# Dependency Graph - Bedrock Proxy

**Generated:** 2026-07-18  
**Method:** Static analysis (manual grep + file inspection)

---

## Module Dependency Hierarchy

### Level 0 - Entry Point

```
src/index.ts (entry)
├── dotenv/config
├── src/server.ts
├── src/telegram-polling.ts
└── scripts/memory-hook.js (require)
```

---

### Level 1 - Core Server

```
src/server.ts
├── express (npm)
├── src/bedrock.ts
└── src/adapters.ts
```

**Imports:** 3  
**Exported To:** index.ts  
**Lines of Code:** ~150

---

### Level 2 - Business Logic

```
src/bedrock.ts
├── src/adapters.ts
├── src/utils/logger.ts
├── src/utils/redis-cache.ts
└── child_process (stdlib - for sound notifications)
```

**Imports:** 4  
**Exported To:** server.ts, telegram-polling.ts  
**Lines of Code:** ~200

---

### Level 3 - Adapters

```
src/adapters.ts
└── (no imports from src/)
```

**Imports:** 0  
**Exported To:** server.ts, bedrock.ts  
**Lines of Code:** ~100

---

### Level 4 - Utilities

```
src/utils/logger.ts
├── winston (npm)
└── (no src/ imports)
```

**Imports:** 1  
**Exported To:** bedrock.ts  
**Lines of Code:** ~30

```
src/utils/redis-cache.ts
├── ioredis (npm)
└── (no src/ imports)
```

**Imports:** 1  
**Exported To:** bedrock.ts  
**Lines of Code:** ~50

```
src/utils/prompt-builder.ts
└── src/types/context.ts
```

**Imports:** 1  
**Exported To:** (unknown - not imported by core)  
**Status:** Orphan module?

---

### Level 5 - Types

```
src/types/api.ts (no imports)
src/types/context.ts (no imports)
src/types/trace.ts (no imports)
```

**Imports:** 0  
**Exported To:** Various services  
**Status:** Type-only imports (no runtime impact)

---

### Level 6 - Services

```
src/services/trace-service.ts
├── src/types/trace.ts
└── src/db/save-trace-async.ts
```

**Imports:** 2  
**Exported To:** server.ts (API routes)  
**Lines of Code:** ~100

```
src/services/message-service.ts
└── src/types/context.ts
```

**Imports:** 1  
**Exported To:** (unknown - not imported by core?)  
**Status:** Orphan module?

---

### Level 7 - Database

```
src/db/client.ts
├── pg (npm)
└── dotenv/config
```

**Imports:** 2  
**Exported To:** db/save-trace.ts  
**Lines of Code:** ~40

```
src/db/save-trace.ts
├── src/db/client.ts
└── (no other src/ imports)
```

**Imports:** 1  
**Exported To:** db/save-trace-async.ts  
**Lines of Code:** ~30

```
src/db/save-trace-async.ts
├── src/db/save-trace.ts
└── (no other src/ imports)
```

**Imports:** 1  
**Exported To:** services/trace-service.ts  
**Lines of Code:** ~20

---

### Level 8 - Integrations

```
src/telegram-polling.ts
├── https (stdlib)
└── src/bedrock.ts
```

**Imports:** 2  
**Exported To:** index.ts  
**Lines of Code:** ~200

```
scripts/memory-hook.js
├── child_process (stdlib)
└── http (stdlib)
```

**Imports:** 2  
**Exported To:** src/index.ts (via require)  
**Lines of Code:** ~100

---

## External Dependency Map

### NPM Packages

| Package | Version | Imported By | Purpose |
|---------|---------|-------------|---------|
| `express` | ^4.19.2 | server.ts | HTTP server |
| `@aws-sdk/client-bedrock-runtime` | ^3.758.0 | (unused?) | AWS SDK |
| `dotenv` | ^16.4.5 | index.ts, db/client.ts | Environment config |
| `ioredis` | ^5.11.1 | utils/redis-cache.ts | Redis cache |
| `pg` | ^8.22.0 | db/client.ts | PostgreSQL client |
| `uuid` | ^14.0.1 | (unknown) | UUID generation |
| `winston` | ^3.19.0 | utils/logger.ts | Logging |

### Standard Library

| Module | Imported By | Purpose |
|--------|-------------|---------|
| `https` | telegram-polling.ts | Telegram API requests |
| `http` | memory-hook.js | Health checks |
| `child_process` | server.ts, memory-hook.js | Sound notifications, Docker commands |

---

## Coupling Analysis

### Tight Coupling (High Risk)

**src/index.ts ↔ scripts/memory-hook.js**
- **Type:** Compile-time (require in TypeScript)
- **Strength:** Strong (build fails if script missing)
- **Risk:** Cannot extract memory to separate package

**src/server.ts ↔ src/bedrock.ts**
- **Type:** Direct import
- **Strength:** Medium (function calls in route handlers)
- **Risk:** Changes to bedrock.ts affect all routes

### Loose Coupling (Low Risk)

**src/db/* ↔ src/services/trace-service.ts**
- **Type:** Dependency injection
- **Strength:** Weak (interfaces only)
- **Risk:** Can change database implementation easily

### No Coupling (Safe)

**src/types/\*** ↔ **src/**
- **Type:** Type-only imports
- **Strength:** None (compile-time only)
- **Risk:** Safe to refactor

---

## Circular Dependencies

**None detected** (manual analysis)

---

## Orphan Modules

| Module | Location | Issue |
|--------|----------|-------|
| `src/utils/prompt-builder.ts` | utils/ | Not imported by core |
| `src/services/message-service.ts` | services/ | Not imported by core |
| `src/middleware/context.ts` | middleware/ | Not imported by core |

**Recommendation:** Investigate if these are:
- Dead code
- Future features
- Imported dynamically

---

## Dependency Metrics

| Metric | Value |
|--------|-------|
| Total TypeScript modules | 15 |
| Total JavaScript modules | 4 |
| Module depth (max) | 8 levels |
| Average imports per module | 2.1 |
| External dependencies | 7 |
| Standard library imports | 3 |

---

## Hotspots (High Fan-In)

| Module | Imported By | Fan-In |
|--------|-------------|--------|
| src/bedrock.ts | 2 modules | HIGH |
| src/adapters.ts | 2 modules | MEDIUM |
| src/utils/logger.ts | 1 module | LOW |

---

## Instability Score (I = Fan-Out / (Fan-In + Fan-Out))

| Module | Fan-In | Fan-Out | Instability |
|--------|--------|---------|-------------|
| src/index.ts | 0 | 3 | 1.0 (MAX UNSTABLE) |
| src/server.ts | 1 | 3 | 0.75 |
| src/bedrock.ts | 2 | 4 | 0.67 |
| src/adapters.ts | 2 | 0 | 0.0 (MAX STABLE) |
| src/db/client.ts | 1 | 2 | 0.67 |

---

## Visualization (Mermaid)

```mermaid
graph TD
    A[src/index.ts] --> B[src/server.ts]
    A --> C[src/telegram-polling.ts]
    A --> D[scripts/memory-hook.js]
    
    B --> E[src/bedrock.ts]
    B --> F[src/adapters.ts]
    
    C --> E
    
    E --> F
    E --> G[src/utils/logger.ts]
    E --> H[src/utils/redis-cache.ts]
    
    B --> I[src/services/trace-service.ts]
    I --> J[src/db/save-trace-async.ts]
    J --> K[src/db/save-trace.ts]
    K --> L[src/db/client.ts]
    
    L --> M[(PostgreSQL)]
    H --> N[(Redis)]
    D --> O[Memory System]
    C --> P[Telegram API]
    E --> Q[Bedrock Mantle API]
```

---

## Unknowns

1. **When is Redis connection initialized?**
   - `utils/redis-cache.ts` has imports but no initialization check
   - Need runtime verification

2. **Are orphan modules used?**
   - `prompt-builder.ts`, `message-service.ts`, `middleware/context.ts`
   - Need grep search for dynamic imports

3. **Is @aws-sdk/client-bedrock-runtime used?**
   - Listed in package.json but not imported in bedrock.ts
   - bedrock.ts uses fetch, not AWS SDK

---

## Recommendations

1. **Reduce coupling:** Make memory-hook optional plugin
2. **Document orphan modules:** Determine if dead code
3. **Clarify Redis dependency:** Add env var check
4. **Remove unused dependency:** Check AWS SDK usage

---

**Evidence Sources:**
- Manual grep searches for `import.*from` patterns
- File listings of src/ and scripts/
- package.json inspection
- tsconfig.json inspection

**Confidence:** HIGH (static analysis complete)
