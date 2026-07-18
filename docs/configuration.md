# Configuration Guide

This document covers all configuration options for Bedrock Proxy.

---

## Table of Contents

- [Environment Variables](#environment-variables)
- [Required Configuration](#required-configuration)
- [Optional Configuration](#optional-configuration)
- [Integration Setup](#integration-setup)
- [Security Best Practices](#security-best-practices)

---

## Environment Variables

Configuration is managed via environment variables. Copy `.env.example` to `.env` and customize:

```bash
cp .env.example .env
```

---

## Required Configuration

These variables must be set for the proxy to function.

### BEDROCK_MANTLE_API_KEY

**Description**: AWS Bedrock Mantle API key for authentication

**Required**: Yes

**Example**:
```env
BEDROCK_MANTLE_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**How to obtain**:
1. Access AWS Bedrock console
2. Generate API key in Mantle settings
3. Keep this key secure and never commit to version control

---

### AWS_REGION

**Description**: AWS region where Bedrock is enabled

**Required**: Yes

**Default**: `ap-south-1`

**Example**:
```env
AWS_REGION=us-east-1
```

**Common values**:
- `us-east-1` (N. Virginia)
- `us-west-2` (Oregon)
- `ap-south-1` (Mumbai)
- `eu-west-1` (Ireland)

---

## Optional Configuration

### PORT

**Description**: Port the proxy listens on

**Required**: No

**Default**: `3000`

**Example**:
```env
PORT=2999
```

---

### LOG_LEVEL

**Description**: Logging verbosity

**Required**: No

**Default**: `info`

**Options**: `error`, `warn`, `info`, `debug`

**Example**:
```env
LOG_LEVEL=debug
```

---

## Integration Setup

### Redis Caching

**Purpose**: Cache responses to reduce latency and API calls

**Variables**:

| Variable | Required | Description |
|----------|----------|-------------|
| `REDIS_URL` | No | Redis connection string |
| `REDIS_TTL` | No | Cache TTL in seconds (default: 3600) |

**Example**:
```env
REDIS_URL=redis://localhost:6379
REDIS_TTL=3600
```

**Setup**:
```bash
# Local Redis
docker run -d -p 6379:6379 redis:alpine

# Test connection
redis-cli ping
```

**Behavior**: If Redis is unavailable, the proxy continues without caching.

---

### PostgreSQL Persistence

**Purpose**: Store execution traces for audit and analysis

**Variables**:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | No | PostgreSQL connection string |

**Example**:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/bedrock_proxy
```

**Schema**:
```sql
CREATE TABLE execution_traces (
  id SERIAL PRIMARY KEY,
  request_id VARCHAR(255),
  model VARCHAR(100),
  input_tokens INTEGER,
  output_tokens INTEGER,
  duration_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Note**: Database schema exists but persistence layer is not yet wired to request handlers.

---

### Telegram Notifications

**Purpose**: Receive notifications for completions and errors

**Variables**:

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_ENABLED` | No | Enable Telegram integration |
| `TELEGRAM_BOT_TOKEN` | If enabled | Bot token from BotFather |
| `TELEGRAM_CHAT_ID` | If enabled | Target chat/channel ID |

**Example**:
```env
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ
TELEGRAM_CHAT_ID=123456789
```

**Setup**:

1. Create bot with [@BotFather](https://t.me/botfather):
   ```
   /newbot
   ```
   
2. Get your chat ID:
   ```bash
   node scripts/integrations/telegram/get-telegram-chat-id.js
   ```

3. Add bot to group/channel (if needed)

**Features**:
- Completion notifications
- Error alerts
- Bidirectional chat (polling mode)

---

### Graphiti Memory Integration

**Purpose**: Long-term AI memory with knowledge graph

**Variables**:

| Variable | Required | Description |
|----------|----------|-------------|
| `ENABLE_MEMORY_INTEGRATION` | No | Enable Graphiti hooks |
| `NEO4J_URI` | If enabled | Neo4j connection URI |
| `NEO4J_USER` | If enabled | Neo4j username |
| `NEO4J_PASSWORD` | If enabled | Neo4j password |

**Example**:
```env
ENABLE_MEMORY_INTEGRATION=true
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password
```

**Setup**:
```bash
# Start with memory integration
./scripts/integrations/memory/dev-with-memory.sh
```

---

## Security Best Practices

### API Keys

1. **Never commit `.env` files** to version control
   ```gitignore
   # .gitignore
   .env
   .env.local
   .env.*.local
   ```

2. **Use secrets management** in production:
   - AWS Secrets Manager
   - HashiCorp Vault
   - Kubernetes secrets
   - Docker secrets

3. **Rotate keys regularly** (recommend: quarterly)

4. **Limit key scope** to minimum required permissions

### Network Security

1. **Run behind reverse proxy** (nginx, Traefik, ALB)
2. **Enable TLS** at reverse proxy level
3. **Restrict access** via VPN or security groups

### Redis Security

```env
REDIS_URL=redis://:password@localhost:6379/0
```

1. **Set Redis password**
2. **Use TLS** (`rediss://` scheme)
3. **Limit network access** to proxy only

### PostgreSQL Security

```env
DATABASE_URL=postgresql://user:strong_password@host:5432/db?sslmode=require
```

1. **Use strong passwords**
2. **Enable SSL** (`sslmode=require`)
3. **Limit user permissions** to necessary tables

---

## Environment File Example

Complete `.env` file:

```env
# Required
BEDROCK_MANTLE_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_REGION=us-east-1

# Server
PORT=3000
LOG_LEVEL=info

# Redis (optional)
REDIS_URL=redis://localhost:6379
REDIS_TTL=3600

# PostgreSQL (optional)
DATABASE_URL=postgresql://user:password@localhost:5432/bedrock_proxy

# Telegram (optional)
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ
TELEGRAM_CHAT_ID=123456789

# Memory Integration (optional)
ENABLE_MEMORY_INTEGRATION=false
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password
```

---

## Configuration Validation

The proxy validates configuration at startup:

```typescript
function validateConfig(): void {
  if (!process.env.BEDROCK_MANTLE_API_KEY) {
    throw new Error('BEDROCK_MANTLE_API_KEY is required');
  }
  if (!process.env.AWS_REGION) {
    throw new Error('AWS_REGION is required');
  }
  logger.info('Configuration validated');
}
```

---

## Docker Configuration

### Environment Variables

```yaml
# docker-compose.yml
services:
  bedrock-proxy:
    image: bedrock-proxy
    environment:
      - BEDROCK_MANTLE_API_KEY=${BEDROCK_MANTLE_API_KEY}
      - AWS_REGION=${AWS_REGION}
      - PORT=3000
```

### Secrets

```yaml
# docker-compose.yml with secrets
services:
  bedrock-proxy:
    image: bedrock-proxy
    secrets:
      - bedrock_api_key

secrets:
  bedrock_api_key:
    file: ./secrets/bedrock_api_key.txt
```

---

## Kubernetes Configuration

### ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: bedrock-proxy-config
data:
  AWS_REGION: "us-east-1"
  PORT: "3000"
  LOG_LEVEL: "info"
```

### Secret

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: bedrock-proxy-secrets
type: Opaque
stringData:
  BEDROCK_MANTLE_API_KEY: "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  DATABASE_URL: "postgresql://..."
  REDIS_URL: "redis://..."
```

### Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bedrock-proxy
spec:
  template:
    spec:
      containers:
        - name: proxy
          envFrom:
            - configMapRef:
                name: bedrock-proxy-config
            - secretRef:
                name: bedrock-proxy-secrets
```

---

## Troubleshooting

### Configuration Not Loading

1. Check `.env` file exists
2. Verify file permissions
3. Check for syntax errors (no spaces around `=`)

### Redis Connection Failed

```bash
# Test Redis connection
redis-cli -u $REDIS_URL ping
```

### Database Connection Failed

```bash
# Test PostgreSQL connection
psql $DATABASE_URL -c "SELECT 1"
```

### Telegram Not Sending

1. Verify bot token with BotFather
2. Check chat ID is correct
3. Ensure bot is in group/channel

---

## See Also

- [Architecture Documentation](architecture-detailed.md)
- [Deployment Guide](deployment.md)
- [API Reference](api-reference.md)
