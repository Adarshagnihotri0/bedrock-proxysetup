# Phase 1 Dependency Version Freeze

**Frozen**: 2026-07-18  
**Version**: 1.0.0

---

## Runtime Environment

### Node.js
- **Version**: v20.19.0
- **Runtime**: Node.js
- **Vendor**: OpenJS Foundation

### TypeScript
- **Version**: 5.x
- **Target**: ES2022
- **Module**: NodeNext

### PostgreSQL
- **Version**: 16.14 (Homebrew)
- **Database**: bedrock_proxy
- **Schema Version**: 004

---

## External Dependencies

### Canonical Protocol RFC-0001

**Source**: `/Users/adarshagnihotri/Desktop/Projects/whyAI references/canonical-protocol/protocol/rfc/Documents/2026-07-05_RFC-0001-canonical-serialization-protocol.md`

**Integration**:
- Invariants: INV-001, INV-002, INV-003
- Decisions Blocked: DECISION-002, DECISION-007, DECISION-009

**Status**: Consumed (not validated)

---

## npm Dependencies

### Production Dependencies
```json
{
  "@types/node": "^20.0.0",
  "pg": "^8.11.0",
  "uuid": "^9.0.0"
}
```

### Development Dependencies
```json
{
  "typescript": "^5.0.0",
  "ts-node": "^10.9.0",
  "@types/pg": "^8.10.0",
  "@types/uuid": "^9.0.0"
}
```

---

## Database Schema State

### Migration Files
1. `migrations/001_create_execution_traces.sql` (pre-Phase 1)
2. `migrations/002_add_project_root.sql` (pre-Phase 1)
3. `migrations/003_create_evidence.sql` ✅ Phase 1
4. `migrations/004_evidence_fixes.sql` ✅ Phase 1

### Schema Version at Freeze
- **Version**: 004
- **Last Migration**: 004_evidence_fixes.sql
- **Date**: 2026-07-18

---

## Verification Tools

### Scripts
```
scripts/verify-phase1-complete.ts      # v1.0.0
scripts/verify-phase1-complete-2.ts   # v1.0.0
```

**Test Count**: 13 tests (6 + 7)  
**All Passing**: ✅

### Test Results Location
```
phase1/test-results/2026-07-18_phase1-v1.0.0.txt
```

---

## Build Configuration

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

---

## Git State

### Frozen Commit
- **SHA**: 2f86956
- **Message**: "freeze: Phase 1 Evidence Layer v1.0.0"
- **Date**: 2026-07-18

### Frozen Tag
- **Tag**: phase1-evidence-v1.0.0
- **Annotated**: Yes
- **Pushed**: Yes (remote: github.com:Adarshagnihotri0/bedrock-proxysetup.git)

### Repository State
- **Branch**: main
- **Status**: Clean (working tree)
- **Remote**: Up to date with 'origin/main'

---

## Operating System

### macOS (Darwin)
- **Kernel**: Darwin
- **Architecture**: arm64 (Apple Silicon)
- **Platform**: macOS

---

## Environment Variables (Required)

### Database
```bash
DATABASE_URL=postgres://localhost:5432/bedrock_proxy
```

### Optional (Phase 2+)
```bash
# Redis, Telegram, Graphiti integrations
# Not required for Phase 1
```

---

## Reproducibility Checklist

To recreate Phase 1 freeze environment:

- [ ] Install Node.js v20.19.0
- [ ] Install PostgreSQL 16.x
- [ ] Create database: `createdb bedrock_proxy`
- [ ] Run migrations: `psql -d bedrock_proxy -f migrations/003_create_evidence.sql`
- [ ] Run migrations: `psql -d bedrock_proxy -f migrations/004_evidence_fixes.sql`
- [ ] Install dependencies: `npm install`
- [ ] Build: `npm run build`
- [ ] Verify: `npx ts-node scripts/verify-phase1-complete.ts`
- [ ] Verify: `npx ts-node scripts/verify-phase1-complete-2.ts`

Expected result: 13/13 tests passed.

---

## Version Lock Files

For exact reproducibility:

### package-lock.json
- **Frozen**: Included in commit 2f86956
- **Use**: `npm ci` (clean install)

### Git Commit
- **Use**: `git checkout phase1-evidence-v1.0.0`

---

## External Service Dependencies

### PostgreSQL
- **Required**: Yes (Phase 1 core)
- **Version**: 16.14 or compatible
- **Extensions**: uuid-ossp (for gen_random_uuid)

### Redis
- **Required**: No (Phase 2 integration)
- **Current**: Optional caching layer

### Graphiti
- **Required**: No (Memory integration)
- **Current**: Scaffolded, not used in Phase 1

---

## Version Compatibility Notes

### PostgreSQL Version
- Minimum: PostgreSQL 12 (for gen_random_uuid)
- Tested: PostgreSQL 16.14
- Not tested on: PostgreSQL < 12

### Node.js Version
- Minimum: Node.js 18 (ES2022)
- Tested: Node.js 20.19.0
- Not tested on: Node.js < 18

### TypeScript Version
- Minimum: TypeScript 5.0
- Tested: TypeScript 5.x
- Not tested on: TypeScript < 5

---

## Dependency Upgrade Policy

### Major Version Upgrades
- Requires: ADR update
- Requires: Re-verification
- Requires: New version tag

### Minor/Patch Upgrades
- Allowed: Without ADR
- Requires: Test suite pass
- Requires: Documentation update

### Security Updates
- Process: Immediate upgrade
- Document: SECURITY.md (future)
- Re-verify: Yes

---

**This document is frozen.**  
To update dependencies, create ADR-015+ and re-version.
