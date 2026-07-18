/**
 * Confidence Aggregation Problem
 * 
 * Scenario: Same fact extracted from multiple evidence with different confidence
 */

interface KnowledgeSupport {
  knowledgeId: string;
  evidenceId: string;
  confidence: number;
  extractorName: string;
  extractorVersion: number;
}

// Simulate: TerminalOutputExtractor v1 extracts same fact twice
const support1: KnowledgeSupport = {
  knowledgeId: 'k-123',
  evidenceId: 'e-1',
  confidence: 0.4,  // Noisy extraction (maybe output was ambiguous)
  extractorName: 'TerminalOutputExtractor',
  extractorVersion: 1
};

const support2: KnowledgeSupport = {
  knowledgeId: 'k-123',
  evidenceId: 'e-2',
  confidence: 1.0,  // Clear extraction (error message was explicit)
  extractorName: 'TerminalOutputExtractor',
  extractorVersion: 1
};

const support3: KnowledgeSupport = {
  knowledgeId: 'k-123',
  evidenceId: 'e-3',
  confidence: 0.9,  // High confidence
  extractorName: 'TerminalOutputExtractor',
  extractorVersion: 1
};

// Question: What is knowledge.confidence?
const supports = [support1, support2, support3];

// Option 1: MAX (most confident extractor was certain)
const maxConf = Math.max(...supports.map(s => s.confidence));
console.log('MAX aggregation:', maxConf);

// Option 2: LATEST (most recent observation)
const latestConf = support3.confidence;
console.log('LATEST aggregation:', latestConf);

// Option 3: WEIGHTED AVERAGE (bayesian update?)
const weights = supports.map(s => s.confidence);
const avgConf = weights.reduce((a, b) => a + b) / weights.length;
console.log('AVERAGE aggregation:', avgConf);

// Option 4: VOTING (majority confidence wins)
const highConfidence = supports.filter(s => s.confidence >= 0.8).length;
const lowConfidence = supports.filter(s => s.confidence < 0.8).length;
const votingConf = highConfidence > lowConfidence ? 0.9 : 0.4;
console.log('VOTING aggregation:', votingConf);

// Option 5: FIRST (current implementation behavior)
const firstConf = support1.confidence;
console.log('FIRST aggregation (current bug):', firstConf);

console.log('\n⚠️  Different policies give different results:');
console.log('MAX:', maxConf.toFixed(2));
console.log('LATEST:', latestConf.toFixed(2));
console.log('AVERAGE:', avgConf.toFixed(2));
console.log('VOTING:', votingConf.toFixed(2));
console.log('FIRST (bug):', firstConf.toFixed(2));

export {};
