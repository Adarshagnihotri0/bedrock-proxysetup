# Bedrock Proxy

A Node.js/Express proxy server that enables AI clients to access GLM models through AWS Bedrock Mantle.

## What is This Repository?

This is a **Node.js/Express proxy server** that:
- Routes LLM requests to AWS Bedrock Mantle endpoint
- Provides OpenAI-compatible API endpoints
- Runs on configurable ports to serve different clients
- Integrates with Graphiti memory system for persistent AI memory
- Supports Telegram notifications for monitoring

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Bedrock Proxy                             │
│                                                              │
│          ┌──────────────────┐                              │
│          │   Port 3000       │                              │
│          │  (Configurable)   │                              │
│          │                   │                              │
│          │ Telegram: Optional│                              │
│          └────────┬─────────┘                              │
│                   │                                          │
│           ┌───────▼────────┐                               │
│           │ Express Server │                               │
│           │  src/index.ts  │                               │
│           └───────┬────────┘                               │
│                   │                                          │
│           ┌───────▼────────┐                               │
│           │ Bedrock Mantle  │                               │
│           │  (AWS API)      │                               │
│           └────────────────┘                               │
└─────────────────────────────────────────────────────────────┘
```

## Features

- **OpenAI-Compatible API**: Drop-in replacement for OpenAI API
- **Anthropic-Compatible**: Supports `/v1/messages` endpoint
- **Telegram Integration**: Optional notifications for monitoring
- **Memory System**: Graphiti memory integration support
- **PostgreSQL Persistence**: Execution trace storage
- **Redis Caching**: Response caching for performance

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Start the Proxy
```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start
```

### 4. Verify It's Running
```bash
curl -s http://localhost:3000/health
```

### 5. Test LLM Requests
```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test" \
  -d '{"model": "zai.glm-5", "messages": [{"role": "user", "content": "hello"}], "max_tokens": 10}'
```

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/v1/chat/completions` | POST | OpenAI-compatible chat |
| `/v1/messages` | POST | Anthropic-compatible messages |
| `/ready` | GET | Readiness probe |
| `/alive` | GET | Liveness probe |

## Environment Variables

### Required Configuration

```bash
# AWS Bedrock Mantle API key (REQUIRED)
BEDROCK_MANTLE_API_KEY=your_api_key_here

# AWS region where Bedrock is enabled
AWS_REGION=ap-south-1

# Port this proxy listens on
PORT=3000
```

### Optional Integrations

```bash
# Telegram Bot Integration (optional)
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
TELEGRAM_ENABLED=true

# Memory System Integration (optional)
ENABLE_MEMORY_INTEGRATION=true

# PostgreSQL for Execution Traces (optional)
DATABASE_URL="postgresql://user@localhost:5432/dbname"

# Redis cache (optional)
REDIS_URL=redis://localhost:6379
```

## Project Structure

```
bedrock-proxy/
├── src/
│   ├── index.ts              # Main entry point
│   ├── server.ts             # Express server setup
│   ├── bedrock.ts            # Bedrock API integration
│   ├── telegram-polling.ts   # Telegram notification service
│   ├── adapters.ts           # API adapters
│   ├── db/
│   │   ├── client.ts         # Database client
│   │   ├── save-trace.ts     # Trace persistence (sync)
│   │   └── save-trace-async.ts # Trace persistence (async)
│   ├── middleware/
│   │   └── context.ts        # Request context middleware
│   ├── services/
│   │   ├── message-service.ts # Message handling
│   │   └── trace-service.ts   # Trace management
│   ├── types/
│   │   ├── api.ts            # API type definitions
│   │   ├── context.ts        # Context types
│   │   └── trace.ts          # Trace types
│   └── utils/
│       ├── logger.ts         # Logging utilities
│       ├── prompt-builder.ts  # Prompt construction
│       └── redis-cache.ts    # Redis caching
├── scripts/
│   ├── integrations/
│   │   ├── memory/           # Memory system integration
│   │   │   ├── dev-with-memory.sh
│   │   │   └── memory-hook.js
│   │   └── telegram/         # Telegram bot utilities
│   │       └── get-telegram-chat-id.js
│   └── operations/           # Operational scripts
│       ├── dev-with-notify.sh
│       ├── openhands-start.sh
│       ├── proxy-start.sh
│       ├── proxy-status.sh
│       ├── proxy-stop.sh
│       └── start-dual-ports.sh
├── .env.example              # Environment template
├── package.json
├── tsconfig.json
└── README.md                 # This file
```

## Integration Details

### VS Code / GitHub Copilot

Configure VS Code to use the proxy:

```json
{
  "github.copilot.advanced": {
    "debug.overrideProxy": "http://localhost:3000"
  }
}
```

### OpenHands

Configure OpenHands in `~/.openhands/settings.json`:

```json
{
  "agent_settings": {
    "llm": {
      "model": "openai/zai.glm-5",
      "base_url": "http://localhost:3000/v1",
      "api_key": "test"
    }
  }
}
```

### Memory System Integration

The proxy can integrate with Graphiti memory system:

```bash
# Start with memory integration
scripts/integrations/memory/dev-with-memory.sh
```

**Memory Components:**
- Neo4j Database: bolt://localhost:7687
- Graphiti Memory: Persistent AI memory
- Auto-initialized when proxy starts

See: https://github.com/Adarshagnihotri0/openhands-graphiti-memory

## Development

### Available Scripts

```bash
# Development mode with auto-reload
npm run dev

# Build TypeScript to JavaScript
npm run build

# Run production build
npm start

# Run tests
npm test
```

### Development Tools

```typescript
// Start with memory integration
import { autoSetup } from './scripts/integrations/memory/memory-hook';

autoSetup().catch(() => {
  // Memory hook is optional
});
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port
lsof -i :3000

# Kill process
lsof -ti :3000 | xargs kill -9
```

### Connection Issues

```bash
# Check if proxy is running
curl -s http://localhost:3000/health

# Check logs
tail -f logs/proxy.log
```

### Telegram Issues

- Check if `TELEGRAM_ENABLED=true` in `.env`
- Verify bot token and chat ID
- Test with: `scripts/integrations/telegram/get-telegram-chat-id.js`

### Database Issues

```bash
# Check PostgreSQL connection
psql $DATABASE_URL -c "SELECT 1"

# Check Redis connection
redis-cli -u $REDIS_URL ping
```

## Operation Scripts

Convenient scripts for managing the proxy:

```bash
# Start proxy
scripts/operations/proxy-start.sh

# Check proxy status
scripts/operations/proxy-status.sh

# Stop proxy
scripts/operations/proxy-stop.sh

# Start dual-port setup (ports 2999 & 3000)
scripts/operations/start-dual-ports.sh

# Development with notifications
scripts/operations/dev-with-notify.sh
```

## Related Repositories

- **Memory System**: https://github.com/Adarshagnihotri0/openhands-graphiti-memory
  - Graphiti memory integration
  - Neo4j graph database
  
- **OpenHands**: https://github.com/All-Hands-AI/OpenHands
  - Autonomous AI agent
  - Uses proxy for LLM calls

## Security

### Important

- **Never commit `.env` file** - It's excluded in `.gitignore`
- Always use `.env.example` for sharing configuration
- Rotate API keys if accidentally exposed
- Use environment-specific credentials

### Excluded from Git

- `.env` - Environment variables
- `.vscode/` - Editor settings
- `node_modules/` - Dependencies
- `dist/` - Build output
- `archive/` - Archived files
- `migrations/` - Database migrations
- `docs/` - Documentation

## License

MIT

## Support

For issues:
1. Check logs: `tail -f logs/proxy.log`
2. Check processes: `lsof -i :3000`
3. Restart: `npm run dev`
4. Check memory system (if using): `scripts/integrations/memory/dev-with-memory.sh`
