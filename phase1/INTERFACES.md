# Phase 1 Frozen Interfaces

**Frozen**: 2026-07-18  
**Version**: 1.0.0

---

## Interface Stability Policy

Changes to these interfaces require:
1. Architecture Decision Record (ADR)
2. Impact analysis on existing implementations
3. Re-verification of Phase 1 guarantees
4. Version bump (phase1-evidence-v1.1.0)

---

## Core Types

### Evidence

**Location**: `src/types/knowledge.ts`

```typescript
interface Evidence {
  id: string;                    // UUID v4
  type: EvidenceType;            // 10 supported types
  content: any;                   // JSONB payload
  contentHash: string;            // SHA-256 hex (64 chars)
  provenance: Provenance;        // Immutable execution metadata
  repository: RepositoryContext; // Repository identity
  createdAt: Date;               // Admission timestamp
}
```

**Stability**: FROZEN  
**Change Requires**: ADR-009

---

### Provenance

**Location**: `src/types/knowledge.ts`

```typescript
interface Provenance {
  // Repository context
  repositoryId: string;      // SHA-256 hash of remote URL or path
  branch: string;             // Git branch name
  commit: string;             // Git commit SHA or 'unknown'
  gitStatus: GitStatus;       // 'clean' | 'dirty' | 'unknown'
  remote: string;             // Git remote URL or absolute path
  
  // Session context
  sessionId: string;         // UUID for execution session
  hostname: string;          // Machine hostname
  platform: string;          // OS platform (darwin, linux, win32)
  arch: string;              // CPU architecture (arm64, x64)
  runtime: string;           // Node.js version
  pid: number;               // Process ID
  cwd: string;               // Current working directory
  
  // Agent context
  agent: string;             // Agent name
  tool: string;              // Tool name
  caller: string;            // Calling function
  timestamp: string;         // ISO 8601 timestamp
  
  // Execution metadata
  duration: number;         // Execution duration (ms)
  exitCode: number;         // Exit code (0 = success)
}

type GitStatus = 'clean' | 'dirty' | 'unknown';
```

**Stability**: FROZEN  
**Change Requires**: ADR-010

---

### RepositoryContext

**Location**: `src/types/knowledge.ts`

```typescript
interface RepositoryContext {
  repositoryId: string;   // SHA-256 hash
  branch: string;
  commit: string;
  gitStatus: GitStatus;
  remote: string;         // URL or absolute path
}
```

**Stability**: FROZEN  
**Change Requires**: ADR-013

---

### SessionContext

**Location**: `src/types/knowledge.ts`

```typescript
interface SessionContext {
  sessionId: string;
  hostname: string;
  platform: string;
  arch: string;
  runtime: string;
  pid: number;
  cwd: string;
}
```

**Stability**: FROZEN  
**Change Requires**: ADR-014

---

## Provider Interfaces

### EvidenceProvider

**Location**: `src/types/providers.ts`

```typescript
interface EvidenceProvider {
  /**
   * Store validated evidence
   * @returns Evidence ID (UUID)
   * @throws Never (wraps in Result type in future)
   */
  store(evidence: ValidatedEvidence): Promise<string>;
  
  /**
   * Find evidence by UUID
   * @returns Evidence or null if not found
   */
  findById(id: string): Promise<Evidence | null>;
  
  /**
   * Find evidence by content hash
   * @returns Evidence or null if not found
   */
  findByHash(hash: string): Promise<Evidence | null>;
  
  /**
   * Query evidence with filters
   * @returns Array of matching evidence
   */
  query(filters: EvidenceFilters): Promise<Evidence[]>;
  
  /**
   * Get provider statistics
   */
  getStats(): Promise<ProviderStats>;
}

interface EvidenceFilters {
  type?: EvidenceType;
  repositoryId?: string;
  since?: Date;
  until?: Date;
  limit?: number;
  offset?: number;
}

interface ProviderStats {
  totalCount: number;
  uniqueCount: number;
  duplicateCount: number;
  byType: Record<EvidenceType, number>;
}
```

**Stability**: FROZEN  
**Change Requires**: ADR-010

**Implementations**:
- `PostgreSQLEvidenceProvider` (`src/adapters/postgres-evidence-provider.ts`)
- `FakeEvidenceProvider` (`src/adapters/fake-provider.ts`)

---

### ValidatedEvidence

**Location**: `src/types/providers.ts`

```typescript
/**
 * Evidence that has passed all validator checks.
 * This type can only be created by EvidenceValidator.
 */
interface ValidatedEvidence {
  type: EvidenceType;
  content: any;
  contentHash: string;  // SHA-256, 64 chars
  provenance: Provenance;
  repository: RepositoryContext;
}
```

**Stability**: FROZEN  
**Change Requires**: ADR-010

---

## Pipeline Interfaces

### EvidenceAdmissionPipeline

**Location**: `src/pipeline/admission-pipeline.ts`

```typescript
interface EvidenceAdmissionPipeline {
  /**
   * Process collector output through 6-stage pipeline
   * @returns Evidence ID (UUID)
   * @throws DUPLICATE_DETECTED if content hash exists
   * @throws VALIDATION_ERROR if schema invalid
   */
  process(collectorOutput: CollectorOutput): Promise<string>;
}
```

**Stability**: FROZEN  
**Change Requires**: ADR-011

**Implementation**: `AdmissionPipeline` class

---

### CollectorOutput

**Location**: `src/types/providers.ts`

```typescript
interface CollectorOutput {
  type: EvidenceType;
  content: any;
  metadata?: Record<string, any>;
}
```

**Stability**: FROZEN  
**Change Requires**: ADR-012

---

## Collector Interfaces

### GitCollector

**Location**: `src/evidence/git-collector.ts`

```typescript
interface GitCollector {
  /**
   * Collect git diff evidence
   */
  collectDiff(): Promise<CollectorOutput>;
  
  /**
   * Collect git commit evidence
   */
  collectCommit(): Promise<CollectorOutput>;
}
```

**Stability**: IMPLEMENTATION (interface not frozen)  
**Change**: Allowed without ADR

---

### TerminalCollector

**Location**: `src/evidence/terminal-collector.ts`

```typescript
interface TerminalCollector {
  /**
   * Collect terminal output evidence
   */
  collect(command: string, output: string): Promise<CollectorOutput>;
}
```

**Stability**: IMPLEMENTATION (interface not frozen)  
**Change**: Allowed without ADR

---

### TestCollector

**Location**: `src/evidence/test-collector.ts`

```typescript
interface TestCollector {
  /**
   * Collect test result evidence
   */
  collect(results: TestResults): Promise<CollectorOutput>;
}
```

**Stability**: IMPLEMENTATION (interface not frozen)  
**Change**: Allowed without ADR

---

## Builder Interfaces

### RepositoryContextBuilder

**Location**: `src/context/builders.ts`

```typescript
interface RepositoryContextBuilder {
  /**
   * Build repository context from current working directory
   * @throws Error if git operations fail (optional fallback)
   */
  build(): Promise<RepositoryContext>;
}
```

**Stability**: IMPLEMENTATION (interface not frozen)  
**Change**: Allowed without ADR

---

### SessionContextBuilder

**Location**: `src/context/builders.ts`

```typescript
interface SessionContextBuilder {
  /**
   * Build session context from current process
   */
  build(): SessionContext;
}
```

**Stability**: IMPLEMENTATION (interface not frozen)  
**Change**: Allowed without ADR

---

## Enumerations

### EvidenceType

**Location**: `src/types/knowledge.ts`

```typescript
type EvidenceType =
  | 'git_diff'
  | 'git_commit'
  | 'terminal_output'
  | 'build_log'
  | 'test_result'
  | 'compiler_diagnostic'
  | 'runtime_error'
  | 'user_conversation'
  | 'documentation'
  | 'system_state';
```

**Stability**: FROZEN  
**Change Requires**: ADR + Migration

---

## Error Types

### DUPLICATE_DETECTED

```typescript
class DuplicateDetectedError extends Error {
  constructor(public contentHash: string) {
    super(`DUPLICATE_DETECTED:${contentHash}`);
  }
}
```

**Stability**: FROZEN  
**Change Requires**: ADR

---

### VALIDATION_ERROR

```typescript
class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
  }
}
```

**Stability**: FROZEN  
**Change Requires**: ADR

---

## Stability Summary

| Interface | Stability | Change Requires |
|-----------|-----------|------------------|
| Evidence | FROZEN | ADR-009 |
| Provenance | FROZEN | ADR-010 |
| EvidenceProvider | FROZEN | ADR-010 |
| ValidatedEvidence | FROZEN | ADR-010 |
| EvidenceAdmissionPipeline | FROZEN | ADR-011 |
| CollectorOutput | FROZEN | ADR-012 |
| RepositoryContext | FROZEN | ADR-013 |
| SessionContext | FROZEN | ADR-014 |
| EvidenceType | FROZEN | ADR + Migration |
| GitCollector | IMPLEMENTATION | None |
| TerminalCollector | IMPLEMENTATION | None |
| TestCollector | IMPLEMENTATION | None |
| Error Types | FROZEN | ADR |

---

## Implementation Changes Allowed

These can change without ADR:

- Collector implementation details
- Builder implementation details
- Provider internal optimizations
- Logging additions
- Performance improvements (same behavior)
- Bug fixes (same interface)

---

## Interface Changes Prohibited

These require ADR:

- Adding fields to Evidence
- Adding fields to Provenance
- Changing EvidenceProvider signature
- Changing Pipeline signature
- Adding new EvidenceType values
- Changing error type signatures
- Removing fields from frozen interfaces

---

## Testing Interface Contracts

All frozen interfaces have integration tests:

```bash
npm run build
npx ts-node scripts/verify-phase1-complete.ts
npx ts-node scripts/verify-phase1-complete-2.ts
```

If tests fail after interface change:
1. Interface change is likely breaking
2. Review ADR to confirm intentional
3. Update tests to match new contract
4. Re-verify all guarantees still hold
5. Create new version tag

---

**This document is frozen.**  
Interface changes require versioned ADR.
