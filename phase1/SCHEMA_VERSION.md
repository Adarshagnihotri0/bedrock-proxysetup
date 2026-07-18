# Phase 1 Schema Version

## Current Version: 004

---

## Migration History

### Migration 003: Create Evidence Table (2026-07-16)
**File**: `migrations/003_create_evidence.sql`

**Schema**:
```sql
CREATE TABLE evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  content JSONB NOT NULL,
  content_hash TEXT NOT NULL UNIQUE,
  provenance JSONB NOT NULL,
  repository JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Indexes**:
- `idx_evidence_repository` on (repository)
- `idx_evidence_type` on (type)
- `idx_evidence_created_at` on (created_at)
- `idx_evidence_content_hash` on (content_hash) UNIQUE

**Constraints**:
- `evidence_type_check`: Validates evidence type enum
- `content_hash_unique`: Enforces global deduplication

---

### Migration 004: Evidence Fixes (2026-07-18)
**File**: `migrations/004_evidence_fixes.sql`

**Changes**:
1. Added 'documentation' and 'system_state' evidence types
2. Updated type check constraint
3. Added provenance immutability trigger

**New Types**:
- 'documentation'
- 'system_state'

**Complete Type List (10 types)**:
1. git_diff
2. git_commit
3. terminal_output
4. build_log
5. test_result
6. compiler_diagnostic
7. runtime_error
8. user_conversation
9. documentation ✨ NEW
10. system_state ✨ NEW

**Trigger**: `prevent_provenance_update`
- Function: `prevent_provenance_modification()`
- Event: BEFORE UPDATE
- Action: Raises exception if provenance field modified
- Message: "Provenance cannot be modified after insertion"

---

## Schema State at Phase 1 Freeze

### Table: evidence

```sql
CREATE TABLE evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN (...10 types...)),
  content JSONB NOT NULL,
  content_hash TEXT NOT NULL UNIQUE,
  provenance JSONB NOT NULL,
  repository JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Indexes
- btree (content_hash) UNIQUE
- btree (created_at)
- btree (repository)
- btree (type)

### Triggers
- prevent_provenance_update BEFORE UPDATE

---

## Provenance Schema

```typescript
interface Provenance {
  // Repository context
  repositoryId: string;      // SHA-256 hash of remote URL or path
  branch: string;             // Git branch name
  commit: string;            // Git commit SHA or 'unknown'
  gitStatus: 'clean' | 'dirty' | 'unknown';
  remote: string;            // Git remote URL or absolute path
  
  // Session context
  sessionId: string;         // UUID for session
  hostname: string;          // Machine hostname
  platform: string;          // OS platform
  arch: string;              // CPU architecture
  runtime: string;          // Node.js version
  pid: number;               // Process ID
  cwd: string;               // Current working directory
  
  // Agent context
  agent: string;            // Agent name
  tool: string;             // Tool name
  caller: string;           // Calling function
  
  // Execution metadata
  timestamp: string;        // ISO 8601 timestamp
  duration: number;         // Execution duration (ms)
  exitCode: number;         // Exit code (0 = success)
}
```

---

## Repository Context Schema

```typescript
interface RepositoryContext {
  repositoryId: string;     // SHA-256 hash
  branch: string;
  commit: string;
  gitStatus: 'clean' | 'dirty' | 'unknown';
  remote: string;
}
```

---

## Rollback Instructions

### To Rollback Migration 004
```sql
DROP TRIGGER IF EXISTS prevent_provenance_update ON evidence;
DROP FUNCTION IF EXISTS prevent_provenance_modification();

ALTER TABLE evidence DROP CONSTRAINT evidence_type_check;
-- Re-create with original 8 types
ALTER TABLE evidence ADD CONSTRAINT evidence_type_check 
CHECK (type IN (
  'git_diff', 'git_commit', 'terminal_output', 'build_log',
  'test_result', 'compiler_diagnostic', 'runtime_error', 'user_conversation'
));
```

### To Rollback Migration 003
```sql
DROP TABLE IF EXISTS evidence CASCADE;
```

---

## Schema Evolution Policy

Phase 1 schema is frozen. Future changes require:
1. New migration file (005_xxx.sql)
2. Update this document
3. Re-run verification suite
4. Document impact on existing evidence

---

**Frozen**: 2026-07-18  
**Schema Version**: 004  
**Migration Compatibility**: Backward compatible with PostgreSQL 12+
