/**
 * Knowledge Types
 * 
 * Core type definitions for the memory system.
 * These types represent the structured knowledge extracted from evidence.
 */

/**
 * Evidence - Raw execution artifacts
 * 
 * Evidence is the source of truth. All knowledge must be backed by evidence.
 * Stored in PostgreSQL for fast inserts and deduplication.
 */
export interface Evidence {
  id: string;
  
  /** Type of evidence */
  type: EvidenceType;
  
  /** Repository identifier */
  repository: string;
  
  /** Actual content of the evidence */
  content: any; // JSONB in PostgreSQL
  
  /** SHA-256 hash of content for deduplication */
  contentHash: string;
  
  /** When this evidence was collected */
  timestamp: Date;
  
  /** Where this evidence came from */
  provenance: {
    source: string;      // 'git.diff', 'terminal.stdout', 'test.result'
    timestamp?: Date;     // When evidence was collected
    command?: string;     // If from terminal, the command that was run
    file?: string;        // If from file, the file path
    line?: number;        // If specific line, the line number
    branch?: string;      // Git branch if relevant
    commit?: string;      // Git commit hash if relevant
    userId?: string;      // User who generated this evidence
    sessionId?: string;   // Session identifier
  };
}

export type EvidenceType = 
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

/**
 * Knowledge - Structured understanding extracted from evidence
 * 
 * Knowledge is the useful representation of evidence, stored in Neo4j graph.
 * Each knowledge type has specific properties and relationships.
 */
export type Knowledge = 
  | ArchitecturalDecision
  | RepositoryKnowledge
  | FailurePattern
  | SuccessfulFix
  | Dependency
  | Entity
  | Preference
  | CodingConvention;

export type KnowledgeType = Knowledge['type'];

/**
 * Base properties shared by all knowledge
 */
interface KnowledgeBase {
  id: string;
  type: KnowledgeType;
  repository: string;
  
  /** Human-readable content */
  content: string;
  
  /** Evidence IDs backing this knowledge */
  evidence: string[];
  
  /** Confidence level (0-1) */
  confidence: number;
  
  /** Knowledge status in lifecycle */
  status: KnowledgeStatus;
  
  /** When this knowledge was created */
  createdAt: Date;
  
  /** When this knowledge was last validated */
  validatedAt?: Date;
  
  /** When this knowledge was superseded */
  supersededAt?: Date;
  
  /** ID of knowledge that superseded this one */
  supersededBy?: string;
}

export type KnowledgeStatus = 
  | 'candidate'    // Extracted, not yet validated
  | 'verified'     // Validated, evidence-backed
  | 'active'       // Currently being used
  | 'superseded'   // Replaced by newer knowledge
  | 'archived'     // Historical record
  | 'deleted';     // Removed

/**
 * ArchitecturalDecision - ADR-style decisions
 */
export interface ArchitecturalDecision extends KnowledgeBase {
  type: 'architectural_decision';
  
  /** Short title */
  title: string;
  
  /** What was decided */
  decision: string;
  
  /** Why this decision was made */
  reason: string;
  
  /** Other options considered */
  alternatives: Array<{
    title: string;
    description: string;
    reasonRejected: string;
  }>;
  
  /** Expected consequences */
  consequences: string[];
  
  /** Status of the decision (proposed/accepted/deprecated/superseded) */
  decisionStatus: 'proposed' | 'accepted' | 'deprecated' | 'superseded';
  
  /** Components affected by this decision */
  affectedComponents: string[];
}

/**
 * RepositoryKnowledge - General knowledge about the codebase
 */
export interface RepositoryKnowledge extends KnowledgeBase {
  type: 'repository_knowledge';
  
  /** Topic this knowledge is about */
  topic: string;
  
  /** The actual knowledge */
  facts: string[];
  
  /** Where this knowledge applies */
  scope: 'global' | 'module' | 'function';
  
  /** How this knowledge was discovered */
  discovery: 'inferred' | 'documented' | 'tested' | 'observed';
}

/**
 * FailurePattern - Repeated failure patterns
 */
export interface FailurePattern extends KnowledgeBase {
  type: 'failure_pattern';
  
  /** Description of the problem */
  problem: string;
  
  /** Symptoms of this failure */
  symptoms: string[];
  
  /** Root cause if known */
  rootCause?: string;
  
  /** Error messages that indicate this failure */
  errorPatterns: string[];
  
  /** Files where this failure occurs */
  affectedFiles: string[];
  
  /** How many times this failure has been seen */
  frequency: number;
  
  /** Last time this failure was seen */
  lastSeen: Date;
}

/**
 * SuccessfulFix - Fix that resolved a failure
 */
export interface SuccessfulFix extends KnowledgeBase {
  type: 'successful_fix';
  
  /** The failure pattern this fixes */
  failurePatternId: string;
  
  /** Description of the fix approach */
  approach: string;
  
  /** Actual solution steps */
  solution: string;
  
  /** Files that were modified */
  affectedFiles: string[];
  
  /** How many times this fix has succeeded */
  successRate: number;
  
  /** How many times this fix has been applied */
  applications: number;
  
  /** Any gotchas or caveats */
  gotchas: string[];
}

/**
 * Dependency - External or internal dependency
 */
export interface Dependency extends KnowledgeBase {
  type: 'dependency';
  
  /** Package/library name */
  name: string;
  
  /** Version constraint */
  version: string;
  
  /** Where this dependency is declared */
  declaredIn: string;
  
  /** Why this dependency is needed */
  purpose: string;
  
  /** License type */
  license?: string;
  
  /** Is this a dev dependency? */
  isDev: boolean;
  
  /** Known issues with this dependency */
  knownIssues: string[];
}

/**
 * Entity - Code entity (module, function, class, etc.)
 */
export interface Entity extends KnowledgeBase {
  type: 'entity';
  
  /** Entity name */
  name: string;
  
  /** Entity type */
  entityType: 'module' | 'function' | 'class' | 'interface' | 'variable' | 'constant';
  
  /** File path where defined */
  path: string;
  
  /** Line number where defined */
  line: number;
  
  /** Description from JSDoc/comment */
  description?: string;
  
  /** Function signature if applicable */
  signature?: string;
  
  /** IDs of entities this depends on */
  dependencies: string[];
  
  /** IDs of entities that depend on this */
  dependents: string[];
  
  /** Export visibility */
  visibility: 'public' | 'private' | 'protected';
}

/**
 * Preference - User/project preferences
 */
export interface Preference extends KnowledgeBase {
  type: 'preference';
  
  /** What this preference is about */
  category: 'style' | 'tool' | 'workflow' | 'testing' | 'deployment';
  
  /** Preference key */
  key: string;
  
  /** Preference value */
  value: any;
  
  /** Where this preference applies */
  scope: 'global' | 'repository' | 'user';
  
  /** Why this preference exists */
  rationale?: string;
}

/**
 * CodingConvention - Style and convention rules
 */
export interface CodingConvention extends KnowledgeBase {
  type: 'coding_convention';
  
  /** Convention rule */
  rule: string;
  
  /** Examples of following the rule */
  examples: Array<{
    good: string;
    bad?: string;
    explanation: string;
  }>;
  
  /** Where this convention applies */
  scope: 'global' | 'module' | 'file';
  
  /** Linter/formatter rule that enforces this */
  linterRule?: string;
  
  /** How strictly this is enforced */
  enforcement: 'strict' | 'recommended' | 'optional';
}

/**
 * RetrievalQuery - Query for knowledge retrieval
 */
export interface RetrievalQuery {
  /** Query type determines retrieval strategy */
  type: 'semantic' | 'graph' | 'entity' | 'hybrid' | 'contextual';
  
  /** Repository to search in */
  repository: string;
  
  /** Branch context */
  branch?: string;
  
  /** Session context */
  session?: string;
  
  /** Text query for semantic search */
  text?: string;
  
  /** Entity IDs for graph traversal */
  entities?: string[];
  
  /** Knowledge types to filter */
  knowledgeTypes?: KnowledgeType[];
  
  /** Maximum tokens in result */
  maxTokens?: number;
  
  /** Minimum confidence threshold */
  minConfidence?: number;
  
  /** Time range filter */
  timeRange?: {
    start: Date;
    end: Date;
  };
  
  /** Whether to expand graph relationships */
  expandGraph?: boolean;
  
  /** Starting node for graph traversal */
  startNode?: string;
  
  /** Traversal depth for graph queries */
  depth?: number;
  
  /** Entity to look up */
  entity?: string;
}

/**
 * RetrievalResult - Result from retrieval with ranking
 */
export interface RetrievalResult {
  /** Retrieved knowledge */
  knowledge: Knowledge;
  
  /** Relevance score (0-1) */
  score: number;
  
  /** Where this result came from */
  source: 'semantic' | 'graph' | 'entity' | 'recent';
  
  /** Evidence backing this knowledge */
  evidence: Evidence[];
  
  /** Related entities */
  entities?: Entity[];
  
  /** Graph distance from query entity */
  distance?: number;
}

/**
 * RankedResult - Final ranked result after merging
 */
export interface RankedResult extends RetrievalResult {
  /** Sources that found this result */
  sources: string[];
  
  /** Final rank position */
  rank: number;
}

/**
 * ReasoningContext - Built reasoning from knowledge
 */
export interface ReasoningContext {
  /** Repository context */
  repository: string;
  
  /** Task or topic being reasoned about */
  task: string;
  
  /** Relevant knowledge */
  relevantKnowledge: Knowledge[];
  
  /** Explanations built from knowledge */
  explanations: Explanation[];
  
  /** Identified risks */
  risks: Risk[];
  
  /** Recommendations */
  recommendations: Recommendation[];
  
  /** Evidence backing all knowledge */
  evidence: Evidence[];
  
  /** Overall confidence in this reasoning */
  overallConfidence: number;
}

export interface Explanation {
  summary: string;
  details: string;
  evidence: string[];
  confidence: number;
}

export interface Risk {
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  mitigation?: string;
  evidence: string[];
}

export interface Recommendation {
  action: string;
  reason: string;
  priority: 'low' | 'medium' | 'high';
  evidence: string[];
}

/**
 * ContextOptions - Options for context building
 */
export interface ContextOptions {
  /** Maximum tokens for context */
  maxTokens?: number;
  
  /** Include evidence links in output */
  includeEvidence?: boolean;
  
  /** Include confidence scores */
  includeConfidence?: boolean;
  
  /** Format style */
  format?: 'markdown' | 'json' | 'plain';
  
  /** Sections to include */
  sections?: ContextSection[];
}

export type ContextSection = 
  | 'architecture'
  | 'failures'
  | 'conventions'
  | 'dependencies'
  | 'entities'
  | 'evidence'
  | 'decisions'
  | 'preferences';
