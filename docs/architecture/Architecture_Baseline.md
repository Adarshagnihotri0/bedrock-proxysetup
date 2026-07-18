# Architecture Baseline - Bedrock Proxy

**Generated:** 2026-07-18  
**Repository:** mcp1.0.0  
**Type:** Node.js/Express Proxy Server  

---

## Executive Summary

**Purpose:** Anthropic-compatible proxy for AWS Bedrock Mantle endpoint  
**Primary Use Case:** Enable multiple AI clients (VS Code/GitHub Copilot, OpenHands) to access GLM models through AWS Bedrock

**Architectural Style:** Monolithic Express server with optional integrations

---

## Entry Points

### Primary Entry Point
**File:** `src/index.ts`  
**Function:** HTTP server initialization + optional subsystem startup  
**Lines:** 28 lines (including comments)

### Compile-Time Dependencies
```
src/index.ts
├── src/server.ts (Express app)
├── src/telegram-polling.ts (Background polling)
└── scripts/memory-hook.js (Auto-setup on import)
```

### Runtime Entry Sequence
1. `npm run dev` → nodemon → ts-node → src/index.ts
2. Import `dotenv/config`
3. Import Express app from `./server`
4. Start HTTP server on `PORT` (default: 3000)
5. Attempt `require('./scripts/memory-hook').autoSetup()`
6. Start Telegram polling loop (background)
7. Register SIGINT/SIGTERM handlers

**CONFIDENCE:** High (verified by reading `src/index.ts`)

---

## Component Inventory

### Core Components (Required)

| Component | File | Purpose | Dependencies |
|-----------|------|---------|--------------|
| Entry Point | `src/index.ts` | Server startup | server, telegram-polling, memory-hook |
| HTTP Server | `src/server.ts` | Express routes | bedrock, adapters |
| Bedrock Client | `src/bedrock.ts` | AWS API calls | adapters, logger, redis-cache |
| Model Adapters | `src/adapters.ts` | Request/response transformation | None |

### Optional Integrations (Conditional)

| Integration | File | Condition | Purpose |
|-------------|------|-----------|---------|
| Telegram Bot | `src/telegram-polling.ts` | `TELEGRAM_ENABLED !== 'false'` | Send/receive Telegram messages |
| Memory System | `scripts/memory-hook.js` | Always (compile-time coupling) | Auto-setup Neo4j + Graphiti |
| Request Tracing | `src/db/save-trace-async.ts` | `DATABASE_URL` exists | Persist execution traces |
| Redis Cache | `src/utils/redis-cache.ts` | Unknown (no env var check) | Stream response caching |

### Supporting Services

| Service | File | Purpose |
|---------|------|---------|
| Trace Service | `src/services/trace-service.ts` | Orchestrate trace persistence |
| Message Service | `src/services/message-service.ts` | Message formatting |
| Logger | `src/utils/logger.ts` | Winston logger |
| Prompt Builder | `src/utils/prompt-builder.ts` | Prompt construction |

**CONFIDENCE:** High (verified by grep and file listings)

---

## Dependency Graph (Static Analysis)

### Import Hierarchy

```
src/index.ts
├── express (npm)
├── src/server.ts
│   ├── express (npm)
│   ├── src/bedrock.ts
│   │   ├── src/adapters.ts
│   │   ├── src/utils/logger.ts
│   │   └── src/utils/redis-cache.ts
│   └── src/adapters.ts
├── src/telegram-polling.ts
│   ├── https (stdlib)
│   └── src/bedrock.ts
└── scripts/memory-hook.js (via require())
    ├── child_process (stdlib)
    └── http (stdlib)
```

### External Dependencies (package.json)

**Production:**
- `express` ^4.19.2
- `@aws-sdk/client-bedrock-runtime` ^3.758.0
- `dotenv` ^16.4.5
- `ioredis` ^5.11.1
- `pg` ^8.22.0
- `uuid` ^14.0.1
- `winston` ^3.19.0

**Development:**
- `typescript` ^5.4.5
- `ts-node` ^10.9.2
- `nodemon` ^3.1.14
- `@types/*` packages

**DEPENDENCY COUNT:** 7 production, 6 dev dependencies

**CONFIDENCE:** High (verified by package.json)

---

## External Integrations

### 1. AWS Bedrock Mantle
**Type:** HTTP API (custom endpoint)  
**Endpoint:** `https://bedrock-mantle.{region}.api.aws`  
**Auth:** API Key (`BEDROCK_MANTLE_API_KEY`)  
**Models:** `zai.glm-5` (default)  

**Integration Point:** `src/bedrock.ts`
```typescript
const MANTLE_API_KEY = process.env.BEDROCK_MANTLE_API_KEY;
```

**Error Handling:** Warning if key missing, runtime error on 401/403

**CONFIDENCE:** High (verified in bedrock.ts lines 13-23)

---

### 2. Telegram Bot API
**Type:** Polling webhook  
**Endpoint:** `api.telegram.org`  
**Auth:** Bot Token (`TELEGRAM_BOT_TOKEN`)  
**Required:** `TELEGRAM_CHAT_ID`  

**Integration Point:** `src/telegram-polling.ts`
```typescript
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_ENABLED = process.env.TELEGRAM_ENABLED !== 'false';
```

**Behavior:**
- **Default:** Enabled (runs on startup)
- **Disable:** Set `TELEGRAM_ENABLED=false`
- **Fallback:** Logs warning if TOKEN/CHAT_ID missing

**CONFIDENCE:** High (verified in telegram-polling.ts lines 3-5)

---

### 3. PostgreSQL Database
**Type:** Connection pool  
**Purpose:** Execute trace persistence  
**Required:** `DATABASE_URL` (optional - graceful degradation)  

**Integration Point:** `src/db/client.ts`
```typescript
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.warn('DATABASE_URL not set - execution traces will NOT be persisted');
  return dummy pool;
}
```

**Behavior:**
- **No DATABASE_URL:** Returns dummy pool (logs warning, no errors)
- **Connected:** Persists to `execution_traces` table

**CONFIDENCE:** High (verified in db/client.ts lines 12-27)

---

### 4. Redis Cache
**Type:** Connection (ioredis)  
**Purpose:** Stream response caching  
**Condition:** Unknown (no env var check observed)  

**Integration Point:** `src/utils/redis-cache.ts`
```typescript
import Redis from 'ioredis';
```

**Unknowns:**
- When is Redis initialized?
- Is Redis connection required or optional?
- What happens if Redis is unavailable?

**CONFIDENCE:** Medium (file exists, but integration unclear)

---

### 5. Memory System (Graphiti/Neo4j)
**Type:** External process monitoring  
**Location:** `/Users/adarshagnihotri/workspace/project/415bbbcd111a4a15ae5a9785d35276ef`  

**Integration Point:** `scripts/memory-hook.js` (called from `src/index.ts`)
```typescript
const { autoSetup } = require('./scripts/memory-hook');
autoSetup().catch(() => {}); // Silently fail
```

**Coupling:**
- **Compile-time:** TypeScript imports JavaScript file
- **Runtime:** HTTP health checks to localhost
- **Lifecycle:** Starts after proxy server is ready

**Behavior:**
- Checks if Neo4j Docker container is running
- Starts container if not running
- Sets environment variables for memory system

**CONFIDENCE:** High (verified in memory-hook.js and index.ts)

---

## Configuration

### Environment Variables

#### Required for Core Functionality
```
BEDROCK_MANTLE_API_KEY    # AWS Bedrock authentication
AWS_REGION                # Default: ap-south-1
PORT                      # Default: 3000
```

#### Optional Integrations
```
TELEGRAM_BOT_TOKEN        # Telegram bot authentication
TELEGRAM_CHAT_ID          # Telegram chat ID
TELEGRAM_ENABLED          # Default: true (set to 'false' to disable)
DATABASE_URL              # PostgreSQL connection string
```

#### Memory System (External)
```
MEMORY_DIR                # Default: hardcoded path in memory-hook.js
BEDROCK_PROXY_URL         # Set by memory-hook after startup
```

#### Undocumented
```
ANTHROPIC_BEDROCK_MANTLE_BASE_URL  # Override Mantle endpoint
```

**CONFIDENCE:** High (verified by grep search)

---

### Configuration Files

| File | Format | Purpose |
|------|--------|---------|
| `.env` | dotenv | Environment variables (not in repo) |
| `.env.example` | dotenv | Template (exists) |
| `tsconfig.json` | JSON | TypeScript compiler config |
| ` package.json` | JSON | Dependencies + scripts |

**CONFIDENCE:** High (verified by file listing)

---

## Feature Map

### Active Features

| Feature | Entry Point | Condition | Code Location |
|---------|-------------|-----------|---------------|
| Anthropic API Proxy | `/v1/messages` | Always | server.ts:26-54 |
| OpenAI API Proxy | `/v1/chat/completions` | Always | server.ts:97-130 |
| Legacy Completions | `/v1/completions` | Always | server.ts:57-93 |
| Health Check | `/health` | Always | server.ts:19 |
| Model List | `/v1/models` | Always | server.ts:23 |
| Telegram Polling | Background | `TELEGRAM_ENABLED !== 'false'` | telegram-polling.ts |
| Memory Auto-Setup | Startup | Always (compile-time) | index.ts:20-24 |
| Request Tracing | Middleware | `DATABASE_URL` exists | db/client.ts |
| Sound Notifications | Post-response | macOS only | server.ts (afplay) |

### Dead/Incomplete Features

| Feature | Location | Status |
|---------|----------|--------|
| OpenAI Responses API | server.ts:133-150 | Partially implemented |
| Redis Caching | redis-cache.ts | Unclear usage |

**CONFIDENCE:** High (verified by code inspection)

---

## Module Ownership

### By Directory

| Directory | Contents | Coupling Level |
|-----------|----------|----------------|
| `src/` | Core server logic | High (imports across modules) |
| `src/db/` | Database operations | Low (only used by services) |
| `src/services/` | Business logic | Medium (coordinates db + server) |
| `src/utils/` | Utilities | Low (imported by many) |
| `src/types/` | TypeScript types | None (type-only imports) |
| `scripts/` | Integration hooks | Medium (called from core) |

**CONFIDENCE:** Medium (based on grep analysis)

---

## Change Impact Analysis

### High-Impact Files (Modified Frequently)

| File | Imports | Exported By | Risk Level |
|------|---------|-------------|------------|
| `src/server.ts` | 10+ | index.ts | HIGH |
| `src/bedrock.ts` | 5+ | server.ts, telegram-polling.ts | HIGH |
| `src/adapters.ts` | 3+ | server.ts, bedrock.ts | MEDIUM |

### Low-Impact Files (Isolated)

| File | Imports | Exported To | Risk Level |
|------|---------|-------------|------------|
| `src/db/client.ts` | 1 | db/* | LOW |
| `src/utils/logger.ts` | 1 | bedrock.ts | LOW |

**CONFIDENCE:** Medium (based on import count)

---

## Dead Code Candidates

### Confirmed Foreign Scripts

| File | Location | Evidence | Action |
|------|----------|----------|--------|
| `scripts/compress-patterns.js` | scripts/ | References `.ai/` (deleted) | Remove |
| `scripts/detect-patterns.sh` | scripts/ | References `.ai/` (deleted) | Remove |
| `scripts/test-evidence.js` | scripts/ | References `.ai/` (deleted) | Remove |

### Uncertain Status

| File | Location | Usage | Action |
|------|----------|-------|--------|
| `scripts/test-entry-point.js` | scripts/ | Unknown | Investigate |

**CONFIDENCE:** High (verified by grep for `.ai/`)

---

## Risks and Unknowns

### Critical Risks

1. **Memory Integration Coupling**
   - **Issue:** `src/index.ts` has compile-time dependency on `scripts/memory-hook.js`
   - **Impact:** Cannot build TypeScript without JavaScript script
   - **Unknown:** Is memory system required for proxy to function?

2. **Redis Integration Unclear**
   - **Issue:** No environment variable check for Redis connection
   - **Impact:** Unknown behavior if Redis unavailable
   - **Unknown:** When is Redis initialized?

### Medium Risks

3. **Telegram Integration Runtime Check**
   - **Issue:** Telegram polling starts before server is ready
   - **Impact:** Race condition possible
   - **Mitigation:** Polling has error handling

4. **Sound Notifications (MacOS-specific)**
   - **Issue:** Uses `afplay` (macOS only)
   - **Impact:** Fails silently on Linux/Windows
   - **Mitigation:** Try-catch blocks present

### Unknowns Requiring Evidence

1. Can proxy run without memory system?
2. Can proxy run without Redis?
3. Can proxy run without PostgreSQL?
4. What happens if Telegram API is unreachable?
5. What happens if Bedrock Mantle API is unreachable?

---

## Build and Test Commands

### Build
```bash
npm run build  # Compiles TypeScript to dist/
```

### Development
```bash
npm run dev    # Starts nodemon with ts-node
```

### Production
```bash
npm run start  # Runs compiled dist/index.js
```

### Test
**No test suite detected** (no test script in package.json)

**CONFIDENCE:** High (verified by package.json)

---

## Architectural Constraints

### Must Preserve
1. Anthropic API compatibility
2. OpenAI API compatibility
3. Dual-port operation (2999, 3000)
4. Telegram integration
5. Memory system integration

### Must Not Break
1. Existing API contracts (/v1/messages, /v1/chat/completions)
2. Environment variable names
3. Startup sequence (memory-hook before server ready)
4. Sound notifications (optional - already graceful)

---

## Next Steps

1. ✅ Create dependency graph (manual analysis complete)
2. ⏸️ Create runtime flow diagram (needs execution tracing)
3. ⏸️ Validate external integrations (needs runtime tests)
4. ⏸️ Clone repository to repo-fixed
5. ⏸️ Refactor architecture

---

## Evidence Sources

- ✅ `package.json` - Dependencies and scripts
- ✅ `tsconfig.json` - Compiler configuration
- ✅ `src/index.ts` - Entry point analysis
- ✅ `src/server.ts` - Route definitions
- ✅ `src/bedrock.ts` - AWS integration
- ✅ `src/telegram-polling.ts` - Telegram integration
- ✅ `src/db/client.ts` - Database integration
- ✅ `scripts/memory-hook.js` - Memory integration
- ✅ Grep searches - Import patterns
- ✅ File listings - Directory structure

---

**Document Status:** BASELINE COMPLETE  
**Validation Status:** NEEDS RUNTIME VERIFICATION  
**Next Phase:** Create remaining architecture docs
