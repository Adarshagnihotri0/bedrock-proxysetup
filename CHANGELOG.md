# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

- Multi-model routing support (planned)
- Cost tracking dashboard (planned)
- Request replay functionality (planned)
- Prometheus metrics (planned)
- OpenTelemetry support (planned)

---

## [1.0.0] - 2024-01-15

### Added

- Initial release
- OpenAI-compatible `/v1/chat/completions` endpoint
- Anthropic-compatible `/v1/messages` endpoint
- AWS Bedrock Mantle integration
- Streaming response support
- Health check endpoints (`/health`, `/ready`, `/alive`)
- TypeScript implementation with strict typing
- Express.js server framework
- Environment-based configuration

### Integrations

- Graphiti memory system integration (optional)
- PostgreSQL execution trace storage (optional)
- Redis response caching (optional)
- Telegram notifications and monitoring (optional)

### Documentation

- Comprehensive README
- Architecture documentation in `docs/`
- Environment configuration examples
- Integration guides

---

## [0.3.0] - 2024-01-10

### Added

- Dual-port setup for serving multiple clients
- Telegram bidirectional messaging (send and receive)
- Memory hook for Graphiti integration
- Development notification scripts
- Operational management scripts

### Changed

- Refactored project structure into modular directories
- Improved error handling and logging
- Enhanced streaming response handling

### Fixed

- Redis caching edge cases
- Telegram polling stability
- Port conflict resolution

---

## [0.2.0] - 2024-01-05

### Added

- Redis caching for response optimization
- PostgreSQL persistence layer
- Middleware for request context
- Trace service for execution history

### Changed

- Migrated from AWS SDK direct calls to Bedrock Mantle HTTP API
- Improved request validation
- Enhanced logging with Winston

### Fixed

- Response format compatibility issues
- Authentication header handling
- Model name resolution

---

## [0.1.0] - 2024-01-01

### Added

- Basic proxy functionality
- OpenAI API compatibility
- Simple model routing
- Development server setup
- Initial project structure

---

## Version History

| Version | Date | Highlights |
|---------|------|------------|
| 1.0.0 | 2024-01-15 | Stable release with all core features |
| 0.3.0 | 2024-01-10 | Dual-port setup, Telegram integration |
| 0.2.0 | 2024-01-05 | Redis caching, PostgreSQL persistence |
| 0.1.0 | 2024-01-01 | Initial prototype |

---

## Upgrade Guide

### From 0.3.0 to 1.0.0

No breaking changes. Update your `package.json`:

```bash
npm install bedrock-proxy@1.0.0
```

### From 0.2.0 to 0.3.0

New environment variables available:

```bash
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_CHAT_ID=your_chat_id
```

### From 0.1.0 to 0.2.0

Database and Redis are now optional. Add to `.env` if needed:

```bash
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
```

---

## Deprecation Notices

None at this time.

---

## Security Advisories

| Version | Advisory | Severity | Fixed In |
|---------|----------|----------|----------|
| - | - | - | - |

No known security issues.

---

For version details, see [GitHub Releases](https://github.com/<username>/bedrock-proxy/releases).
