# External Integrations - Bedrock Proxy

**Generated:** 2026-07-18

---

## Overview

The Bedrock Proxy integrates with 5 external systems:

1. **AWS Bedrock Mantle API** - Core LLM provider
2. **Telegram Bot API** - User notifications
3. **PostgreSQL Database** - Execution trace persistence
4. **Redis Cache** - Stream response caching
5. **Memory System (Graphiti/Neo4j)** - AI memory integration

---

## Integration #1: AWS Bedrock Mantle API

### Purpose
Primary LLM backend for request routing

### Integration Type
- **Protocol:** HTTPS (REST API)
- **Auth:** API Key (`BEDROCK_MANTLE_API_KEY`)
- **Endpoint:** `https://bedrock-mantle.{region}.api.aws`

### Configuration

```bash
# Required
BEDROCK_MANTLE_API_KEY=your_api_key_here

# Optional
AWS_REGION=ap-south-1  # Default
ANTHROPIC_BEDROCK_MANTLE_BASE_URL=https://custom-endpoint  # Override
```

### Code Location
**File:** `src/bedrock.ts`
**Lines:** 11-23

### Request Flow
```
Client Request
    ↓
src/server.ts (route handler)
    ↓
src/bedrock.ts (HTTP POST)
    ↓
https://bedrock-mantle.{region}.api.aws
    ↓
Response (streaming or sync)
    ↓
Client Response
```

### Supported Models
- `zai.glm-5` (default, configured in `src/adapters.ts`)
- `anthropic.*` (native Anthropic models)
- `deepseek.*`, `qwen.*` (OpenAI-compatible)

### API Formats
1. **Anthropic Native:** `/v1/messages`
2. **OpenAI Compatible:** `/v1/chat/completions`
3. **Legacy:** `/v1/completions`

### Error Handling
- **No API Key:** Logs warning, returns 401/403 on request
- **Network Error:** Catches exception, returns 500 to client
- **Stream Error:** Logs and terminates stream

### Health Check
**None** - No proactive health checking. Failures occur on request.

### Retry Logic
**None** - Single attempt, no retries.

---

## Integration #2: Telegram Bot API

### Purpose
Send/receive messages via Telegram bot

### Integration Type
- **Protocol:** HTTPS (Polling + Webhook)
- **Auth:** Bot Token (`TELEGRAM_BOT_TOKEN`) + Chat ID (`TELEGRAM_CHAT_ID`)
- **Endpoint:** `api.telegram.org`

### Configuration

```bash
# Required for Telegram integration
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Optional
TELEGRAM_ENABLED=true  # Set to 'false' to disable
```

### Code Location
**File:** `src/telegram-polling.ts`
**Lines:** 1-200+

### Integration Modes

#### Mode 1: Background Polling (Receive messages)
```
Startup
    ↓
startTelegramPolling()
    ↓
Loop: getUpdates(timeout=30s)
    ↓
If message → invokeModelOpenAI()
    ↓
Send response via sendMessage
```

**Polling Interval:** 30-second long polling  
**Rate Limiting:** 5-minute availability check  
**Error Suppression:** Logs once per minute max

#### Mode 2: Notification Sending (Send messages)
```
Bedrock response complete
    ↓
Send Telegram notification
    ↓
POST /bot{TOKEN}/sendMessage
```

**Code Location:** `src/bedrock.ts:90-105`

### Startup Behavior

```typescript
// src/index.ts
startTelegramPolling().catch((error) => {
  console.error('[Telegram] Fatal polling error:', error);
  process.exit(1);
});
```

### Graceful Degradation
- **No TOKEN/CHAT_ID:** Logs warning, continues without Telegram
- **TELEGRAM_ENABLED=false:** Logs info, skips all Telegram operations
- **API Unreachable:** Suppresses errors, retries silently

### Health Check

```typescript
async function checkTelegramAvailability(): Promise<boolean> {
  // GET api.telegram.org/ every 5 minutes
  // Returns: boolean (available/not available)
}
```

### Dependencies
- **Used By:** 
  - `src/index.ts` (startup)
  - `src/bedrock.ts` (notification sending)

---

## Integration #3: PostgreSQL Database

### Purpose
Persist execution traces for audit/debugging

### Integration Type
- **Protocol:** TCP (PostgreSQL wire protocol)
- **Auth:** Connection string (`DATABASE_URL`)
- **Library:** `pg` (node-postgres)

### Configuration

```bash
# Optional (graceful degradation)
DATABASE_URL="postgresql://user@localhost:5432/dbname"
```

### Code Location
**Files:**
- `src/db/client.ts` - Connection pool
- `src/db/save-trace.ts` - INSERT logic
- `src/db/save-trace-async.ts` - Async wrapper
- `src/services/trace-service.ts` - Service layer

### Schema

```sql
-- migrations/001_create_execution_traces.sql
CREATE TABLE execution_traces (
  trace_id VARCHAR PRIMARY KEY,
  route VARCHAR NOT NULL,
  routing_ms INTEGER,
  prompt_build_ms INTEGER,
  adapter_ms INTEGER,
  total_ms INTEGER,
  status VARCHAR NOT NULL,
  error_message TEXT,
  project_root VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Connection Pool
- **Max Connections:** 5
- **Idle Timeout:** 30s
- **Connection Timeout:** 2s

### Graceful Degradation

```typescript
// src/db/client.ts
if (!databaseUrl) {
  console.warn('DATABASE_URL not set - execution traces will NOT be persisted');
  return {
    query: async () => {
      console.warn('Database not configured - trace not saved');
      return { rows: [] };
    },
    // ... dummy pool
  };
}
```

**Behavior:** Returns dummy pool if `DATABASE_URL` not set. Logs warnings, never throws errors.

### Data Flow

```
API Request
    ↓
src/server.ts
    ↓
src/services/trace-service.ts.ingestTrace()
    ↓
src/db/save-trace-async.ts
    ↓
src/db/save-trace.ts
    ↓
src/db/client.ts (pool.query)
    ↓
PostgreSQL
```

### Health Check
**None** - Connection errors logged, but no proactive checking.

---

## Integration #4: Redis Cache

### Purpose
Cache streaming responses (purpose unclear)

### Integration Type
- **Protocol:** TCP (Redis protocol)
- **Library:** `ioredis`

### Configuration
**Unknown** - No environment variable check found.

### Code Location
**File:** `src/utils/redis-cache.ts`

### Exports
```typescript
export function cacheStreamResponse(id: string, data: string): void
export function clearStreamCache(): void
export function generateRequestId(): string
```

### Usage
**Imported By:** `src/bedrock.ts`

### Unknowns
- When is Redis connection initialized?
- What Redis host/port? (defaults to localhost?)
- Is Redis required or optional?
- What happens if Redis is unavailable?

### Recommendations
**NEEDS EVIDENCE:**
1. Check if `redis-cache.ts` is actually used at runtime
2. Check if Redis connection is created on module import
3. Test behavior when Redis is not running

---

## Integration #5: Memory System (Graphiti/Neo4j)

### Purpose
Persistent AI memory for conversation context

### Integration Type
- **Protocol:** HTTP health checks + Docker orchestration
- **Location:** `/Users/adarshagnihotri/workspace/project/415bbbcd111a4a15ae5a9785d35276ef`

### Configuration
**Hardcoded Paths:**
```javascript
// scripts/memory-hook.js
const MEMORY_DIR = '/Users/adarshagnihotri/workspace/project/415bbbcd111a4a15ae5a9785d35276ef';
const AIFLOW_DIR = '/Users/adarshagnihotri/aiFlow/future/mcp1.0.0';
```

### Code Location
**File:** `scripts/memory-hook.js`  
**Imported By:** `src/index.ts:21` (compile-time require)

### Integration Sequence

```
src/index.ts loads
    ↓
require('./scripts/memory-hook.js')
    ↓
autoSetup() called
    ↓
Check if Neo4j Docker container running
    ↓ (if not)
Start Neo4j container (docker start)
    ↓
Load BEDROCK_MANTLE_API_KEY from .env (if not set)
    ↓
Set BEDROCK_PROXY_URL=http://localhost:{PORT}
    ↓
Memory system monitors proxy health
```

### Health Checks
- **Proxy Health:** `GET http://localhost:{PORT}/health`
- **Neo4j Status:** `docker ps | grep openhands-memory`

### Dependencies
- **Docker:** Required for Neo4j container
- **Graphiti:** Memory system at hardcoded path

### Coupling
**Type:** Strong (compile-time)
- `src/index.ts` imports `memory-hook.js` synchronously
- TypeScript compilation depends on JavaScript file existence
- No environment variable to disable

### Breaking Point
**Proxy still starts if:**
- Neo4j not running (logs warning)
- Docker not installed (logs error)
- Memory system path invalid (logs error)

**Build FAILS if:**
- `scripts/memory-hook.js` deleted (TypeScript compilation error)

### Recommendations
**NEEDS DECISION:**
1. Should memory integration be optional plugin?
2. Should paths be configurable via env vars?
3. Should compilation succeed without memory-hook?

---

## Integration Health Summary

| Integration | Health Check | Retry Logic | Graceful Degradation | Status |
|-------------|--------------|-------------|---------------------|--------|
| Bedrock Mantle | ❌ None | ❌ None | ❌ Fails on request | NEEDS IMPROVEMENT |
| Telegram | ✅ 5-min polling | ❌ None | ✅ Silently continues | GOOD |
| PostgreSQL | ❌ None | ❌ None | ✅ Dummy pool | EXCELLENT |
| Redis | ❓ Unknown | ❓ Unknown | ❓ Unknown | NEEDS EVIDENCE |
| Memory System | ✅ Health check | ❌ None | ✅ Logs errors | COUPLING ISSUE |

---

## Integration Risks

### High Risk
1. **Bedrock Mantle:** No health check, fails only on request
2. **Memory System:** Compile-time coupling prevents build without script

### Medium Risk
3. **Redis:** Unknown initialization behavior
4. **Telegram:** Polling loop can crash proxy (process.exit(1))

### Low Risk
5. **PostgreSQL:** Excellent graceful degradation

---

## Recommendations

### Immediate
1. Add environment variable to disable memory integration
2. Add health check for Bedrock Mantle at startup
3. Document Redis configuration requirements

### Long-Term
4. Make memory integration a plugin (not compiled import)
5. Add circuit breaker for external API calls
6. Separate Telegram polling to independent process

---

## Evidence Sources

- ✅ Code inspection: `src/bedrock.ts`, `src/telegram-polling.ts`, `src/db/client.ts`
- ✅ Environment variables: `.env.example`
- ✅ Integration scripts: `scripts/memory-hook.js`
- ✅ Database schema: `migrations/001_create_execution_traces.sql`

**Confidence:** HIGH (for known integrations)  
**Unknowns:** Redis initialization, orphan modules

---

**Next Steps:**
1. Test Redis behavior at runtime
2. Test proxy startup without memory system
3. Document integration failure modes
