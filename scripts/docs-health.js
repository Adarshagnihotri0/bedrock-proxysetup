#!/usr/bin/env node
/**
 * Documentation Governance Engine v5
 * 
 * Architecture: Evidence-backed rule engine with plugin API
 * 
 * Key design:
 * - Every metric has formal specification
 * - Every finding has evidence objects
 * - Rules registered (not hardcoded)
 * - Machine-readable output (JSON/SARIF)
 * - Plugin API contract
 * - No arbitrary scores
 * - Historical trending
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

// ============================================================================
// PLUGIN API CONTRACT
// ============================================================================

/**
 * @typedef {Object} Finding
 * @property {string} ruleId - Which rule triggered
 * @property {string} severity - critical | warning | info
 * @property {number} confidence - 0.0-1.0
 * @property {string} message - Human-readable description
 * @property {Evidence[]} evidence - Supporting evidence
 * @property {Location} location - Where finding occurred
 * @property {string[]} [suggestions] - How to fix
 */

/**
 * @typedef {Object} Evidence
 * @property {string} type - file-content | filesystem | git-history | metadata
 * @property {string} source - Where evidence came from
 * @property {string} value - What was found
 * @property {string} [description] - Human context
 */

/**
 * @typedef {Object} Location
 * @property {string} file - File path
 * @property {number} [line] - Line number
 * @property {number} [column] - Column number
 */

/**
 * @typedef {Object} RuleMetadata
 * @property {string} id - Unique rule identifier
 * @property {string} category - integrity | conformance | architecture | quality | coverage | debt
 * @property {string} severity - critical | warning | info
 * @property {string} description - What the rule checks
 * @property {Object} specification - Formal metric definition
 * @property {string} owner - Team/person responsible
 * @property {string[]} [dependencies] - Other rules this depends on
 */

/**
 * @typedef {Object} RulePlugin
 * @property {string} id - Unique identifier
 * @property {string} description - Human-readable description
 * @property {Function} metadata - Returns RuleMetadata
 * @property {Function} run - Async (context) => Finding[]
 * @property {Function} [initialize] - Async setup
 * @property {Function} [cleanup] - Async teardown
 */

// ============================================================================
// RULE ENGINE
// ============================================================================

class DocumentationGovernanceEngine {
  constructor(config = {}) {
    this.config = {
      excludePatterns: ['node_modules/', 'dist/', 'coverage/', 'archive/', 'scratch/'],
      thresholds: {
        critical: 0,
        warning: 5,
        info: 10
      },
      outputFormats: ['console', 'json', 'sarif'],
      trendFile: '.docs-health-trends.json',
      ...config
    };
    
    this.rules = new Map();
    this.findings = [];
    this.metrics = new Map();
  }
  
  /**
   * Register a rule plugin
   * @param {RulePlugin} plugin
   */
  registerRule(plugin) {
    if (!plugin.id) {
      throw new Error('Plugin must have an id');
    }
    
    const metadata = plugin.metadata();
    
    this.rules.set(plugin.id, {
      plugin,
      metadata,
      enabled: true
    });
    
    // Initialize metric tracking
    this.metrics.set(plugin.id, {
      history: [],
      current: null
    });
    
    console.log(`✓ Registered rule: ${plugin.id}`);
  }
  
  /**
   * Load historical trends
   */
  async loadTrends() {
    try {
      if (fs.existsSync(this.config.trendFile)) {
        const trends = JSON.parse(fs.readFileSync(this.config.trendFile, 'utf-8'));
        trends.forEach((trend, ruleId) => {
          if (this.metrics.has(ruleId)) {
            this.metrics.get(ruleId).history = trend.history || [];
          }
        });
      }
    } catch (error) {
      // First run or corrupted file, start fresh
    }
  }
  
  /**
   * Save trends for historical analysis
   */
  async saveTrends() {
    const trends = {};
    const timestamp = new Date().toISOString();
    
    this.metrics.forEach((data, ruleId) => {
      trends[ruleId] = {
        history: [
          ...data.history.slice(-9), // Keep last 10 runs
          {
            timestamp,
            findings: data.current?.length || 0,
            status: this.getRuleStatus(ruleId)
          }
        ]
      };
    });
    
    fs.writeFileSync(this.config.trendFile, JSON.stringify(trends, null, 2));
  }
  
  /**
   * Run all registered rules
   */
  async run(context) {
    console.log(`Running ${this.rules.size} governance rules...\n`);
    
    // Initialize plugins
    for (const [id, rule] of this.rules) {
      if (rule.plugin.initialize) {
        await rule.plugin.initialize(context);
      }
    }
    
    // Run rules in dependency order
    const sortedRules = this.topologicalSort();
    
    for (const ruleId of sortedRules) {
      const rule = this.rules.get(ruleId);
      
      if (!rule.enabled) {
        continue;
      }
      
      try {
        console.log(`Running: ${ruleId}`);
        const findings = await rule.plugin.run(context);
        
        // Add rule metadata to findings
        findings.forEach(finding => {
          finding.ruleId = ruleId;
          if (!finding.severity) {
            finding.severity = rule.metadata.severity;
          }
        });
        
        this.findings.push(...findings);
        this.metrics.get(ruleId).current = findings;
        
      } catch (error) {
        console.error(`Error in ${ruleId}:`, error.message);
        this.findings.push({
          ruleId,
          severity: 'critical',
          confidence: 1.0,
          message: `Rule execution failed: ${error.message}`,
          evidence: [{
            type: 'runtime',
            source: ruleId,
            value: error.stack
          }]
        });
      }
    }
    
    // Cleanup plugins
    for (const [id, rule] of this.rules) {
      if (rule.plugin.cleanup) {
        await rule.plugin.cleanup(context);
      }
    }
    
    // Save trends
    await this.saveTrends();
    
    return this.findings;
  }
  
  /**
   * Sort rules by dependencies
   */
  topologicalSort() {
    const sorted = [];
    const visited = new Set();
    const visiting = new Set();
    
    const visit = (ruleId) => {
      if (visited.has(ruleId)) return;
      if (visiting.has(ruleId)) {
        throw new Error(`Circular dependency detected: ${ruleId}`);
      }
      
      visiting.add(ruleId);
      
      const rule = this.rules.get(ruleId);
      if (rule?.metadata.dependencies) {
        rule.metadata.dependencies.forEach(dep => visit(dep));
      }
      
      visiting.delete(ruleId);
      visited.add(ruleId);
      sorted.push(ruleId);
    };
    
    this.rules.forEach((_, ruleId) => visit(ruleId));
    
    return sorted;
  }
  
  /**
   * Get status for a rule based on findings
   */
  getRuleStatus(ruleId) {
    const findings = this.metrics.get(ruleId)?.current || [];
    const criticalCount = findings.filter(f => f.severity === 'critical').length;
    const warningCount = findings.filter(f => f.severity === 'warning').length;
    
    if (criticalCount > this.config.thresholds.critical) {
      return 'FAIL';
    }
    
    if (warningCount > this.config.thresholds.warning) {
      return 'WARNING';
    }
    
    return 'PASS';
  }
  
  /**
   * Generate output in specified formats
   */
  generateOutput(formats = this.config.outputFormats) {
    const outputs = {};
    
    if (formats.includes('console')) {
      outputs.console = this.formatConsole();
    }
    
    if (formats.includes('json')) {
      outputs.json = this.formatJSON();
    }
    
    if (formats.includes('sarif')) {
      outputs.sarif = this.formatSARIF();
    }
    
    return outputs;
  }
  
  formatConsole() {
    const lines = [];
    
    lines.push('='.repeat(80));
    lines.push('DOCUMENTATION GOVERNANCE REPORT');
    lines.push('='.repeat(80));
    lines.push('');
    
    // Group by category
    const byCategory = {};
    this.findings.forEach(finding => {
      const category = this.rules.get(finding.ruleId)?.metadata.category || 'unknown';
      if (!byCategory[category]) {
        byCategory[category] = [];
      }
      byCategory[category].push(finding);
    });
    
    // Render each category
    Object.entries(byCategory).forEach(([category, findings]) => {
      lines.push(`${category.toUpperCase()}`);
      lines.push('-'.repeat(80));
      
      findings.forEach(finding => {
        const icon = finding.severity === 'critical' ? '❌' : 
                     finding.severity === 'warning' ? '⚠️' : 'ℹ️';
        
        lines.push(`${icon} ${finding.message} (${finding.confidence * 100}% confidence)`);
        
        // Show evidence
        finding.evidence?.slice(0, 2).forEach(e => {
          lines.push(`   Evidence: ${e.source} = ${e.value}`);
        });
        
        // Show location
        if (finding.location) {
          lines.push(`   Location: ${finding.location.file}${finding.location.line ? `:${finding.location.line}` : ''}`);
        }
      });
      
      lines.push('');
    });
    
    // Summary
    lines.push('='.repeat(80));
    lines.push('SUMMARY');
    lines.push('='.repeat(80));
    
    const counts = {
      critical: this.findings.filter(f => f.severity === 'critical').length,
      warning: this.findings.filter(f => f.severity === 'warning').length,
      info: this.findings.filter(f => f.severity === 'info').length
    };
    
    lines.push(`Critical: ${counts.critical}`);
    lines.push(`Warnings: ${counts.warning}`);
    lines.push(`Info: ${counts.info}`);
    lines.push('');
    
    // Trends
    lines.push('TRENDS (last 5 runs):');
    this.metrics.forEach((data, ruleId) => {
      const history = data.history.slice(-5);
      if (history.length > 1) {
        const trend = history.map(h => h.findings).join(' → ');
        lines.push(`  ${ruleId}: ${trend}`);
      }
    });
    
    lines.push('='.repeat(80));
    
    if (counts.critical > 0) {
      lines.push('❌ FAIL');
    } else if (counts.warning > this.config.thresholds.warning) {
      lines.push('⚠️  WARNING');
    } else {
      lines.push('✅ PASS');
    }
    
    return lines.join('\n');
  }
  
  formatJSON() {
    return {
      schema: 'docs-governance-v1',
      timestamp: new Date().toISOString(),
      summary: {
        total: this.findings.length,
        critical: this.findings.filter(f => f.severity === 'critical').length,
        warning: this.findings.filter(f => f.severity === 'warning').length,
        info: this.findings.filter(f => f.severity === 'info').length,
        status: this.findings.filter(f => f.severity === 'critical').length > 0 ? 'FAIL' : 'PASS'
      },
      findings: this.findings,
      rules: Array.from(this.rules.entries()).map(([id, rule]) => ({
        id,
        metadata: rule.metadata,
        findings: this.metrics.get(id)?.current?.length || 0,
        status: this.getRuleStatus(id)
      })),
      trends: Object.fromEntries(
        Array.from(this.metrics.entries()).map(([id, data]) => [
          id,
          data.history.slice(-10)
        ])
      )
    };
  }
  
  formatSARIF() {
    return {
      $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      version: '2.1.0',
      runs: [{
        tool: {
          driver: {
            name: 'Documentation Governance Engine',
            version: '5.0.0',
            rules: Array.from(this.rules.values()).map(rule => ({
              id: rule.metadata.id,
              name: rule.metadata.description,
              shortDescription: {
                text: rule.metadata.description
              },
              fullDescription: {
                text: rule.metadata.specification?.measurement || rule.metadata.description
              },
              defaultConfiguration: {
                level: rule.metadata.severity === 'critical' ? 'error' : 
                       rule.metadata.severity === 'warning' ? 'warning' : 'note'
              }
            }))
          }
        },
        results: this.findings.map(finding => ({
          ruleId: finding.ruleId,
          level: finding.severity === 'critical' ? 'error' : 
                 finding.severity === 'warning' ? 'warning' : 'note',
          message: {
            text: finding.message
          },
          locations: finding.location ? [{
            physicalLocation: {
              artifactLocation: {
                uri: finding.location.file
              },
              region: {
                startLine: finding.location.line || 1
              }
            }
          }] : [],
          properties: {
            confidence: finding.confidence,
            evidence: finding.evidence
          }
        }))
      }]
    };
  }
}

// ============================================================================
// BUILT-IN RULES
// ============================================================================

/**
 * Rule: Broken Links
 * Specification: Checks that relative Markdown links resolve to existing files
 */
const brokenLinksRule = {
  id: 'broken-links',
  description: 'Detects Markdown links that do not resolve to existing files',
  
  metadata() {
    return {
      id: 'broken-links',
      category: 'integrity',
      severity: 'critical',
      description: 'Relative markdown links that do not resolve',
      specification: {
        metric: 'broken-links',
        category: 'critical',
        description: 'Relative markdown links that do not resolve to existing files',
        measurement: {
          source: 'filesystem',
          algorithm: 'path-resolution',
          tool: 'fs.existsSync'
        },
        limitations: [
          'External URLs ignored',
          'Generated docs ignored',
          'Symlinks not followed'
        ],
        examples: [
          '[Architecture](./arch.md) ← arch.md does not exist'
        ],
        ci: {
          threshold: 0
        }
      },
      owner: 'Docs',
      confidence: 1.0
    };
  },
  
  async run(context) {
    const findings = [];
    const { files, fileContents } = context;
    
    files.forEach(file => {
      const content = fileContents.get(file) || '';
      const relPath = path.relative(process.cwd(), file);
      
      const links = this.extractLinks(content, file);
      
      links.forEach(link => {
        const exists = fs.existsSync(link.resolvedPath);
        
        if (!exists) {
          findings.push({
            ruleId: 'broken-links',
            severity: 'critical',
            confidence: 0.95, // High but not 1.0 due to possible generated files
            message: `Broken link: ${link.url}`,
            evidence: [
              {
                type: 'file-content',
                source: relPath,
                value: `[${link.text}](${link.url})`,
                description: 'Markdown link that does not resolve'
              },
              {
                type: 'filesystem',
                source: link.resolvedPath,
                value: 'File not found',
                description: 'Path resolution result'
              }
            ],
            location: {
              file: relPath,
              line: link.line
            },
            suggestions: [
              'Create the referenced file',
              'Fix the relative path',
              'Remove the link if no longer needed'
            ]
          });
        }
      });
    });
    
    return findings;
  },
  
  extractLinks(content, filePath) {
    const links = [];
    const lines = content.split('\n');
    
    lines.forEach((line, idx) => {
      const mdLinks = line.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);
      for (const match of mdLinks) {
        const url = match[2];
        if (!url.startsWith('http') && !url.startsWith('#')) {
          links.push({
            line: idx + 1,
            text: match[1],
            url,
            resolvedPath: path.resolve(path.dirname(filePath), url.split('#')[0])
          });
        }
      }
    });
    
    return links;
  }
};

/**
 * Rule: Package.json Conformance
 * Specification: Checks README claims conform to package.json observable facts
 */
const packageJsonConformanceRule = {
  id: 'package-json-conformance',
  description: 'Verifies README conforms to package.json observable state',
  
  metadata() {
    return {
      id: 'package-json-conformance',
      category: 'conformance',
      severity: 'warning',
      description: 'Documentation conforms to package.json observable facts',
      specification: {
        metric: 'node-version-drift',
        category: 'conformance',
        description: 'README Node version matches package.json engines.node',
        measurement: {
          source: ['filesystem', 'file-content'],
          algorithm: 'regex-extraction + JSON-parse',
          tool: 'fs.readFileSync + JSON.parse'
        },
        limitations: [
          'Only checks stated versions, not actual compatibility',
          'Does not check all scripts, only flags undocumented ones',
          'Private scripts (with :) ignored'
        ],
        examples: [
          'README: "Node 18", package.json: "node": ">=22" → Drift'
        ],
        ci: {
          threshold: 0,
          caveat: 'Verifies consistency, not correctness'
        }
      },
      owner: 'Platform',
      confidence: 0.85
    };
  },
  
  async run(context) {
    const findings = [];
    
    try {
      const pkgJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
      const readme = context.fileContents.get(path.resolve('README.md')) || '';
      
      // Check Node version
      const nodeMatch = readme.match(/node\s*>=?\s*(\d+)/i);
      if (nodeMatch && pkgJson.engines?.node) {
        const docNode = parseInt(nodeMatch[1]);
        const pkgNode = parseInt(pkgJson.engines.node.replace(/[^\d]/, ''));
        
        if (docNode !== pkgNode) {
          findings.push({
            ruleId: 'package-json-conformance',
            severity: 'warning',
            confidence: 0.9,
            message: `Node version drift: README says ${docNode}, package.json says ${pkgNode}`,
            evidence: [
              {
                type: 'file-content',
                source: 'README.md',
                value: `Node ${docNode}`,
                description: 'Documentation claim'
              },
              {
                type: 'file-content',
                source: 'package.json',
                value: `Node ${pkgNode}`,
                description: 'package.json engines.node'
              }
            ],
            location: {
              file: 'README.md'
            },
            suggestions: [
              'Update README to match package.json',
              'Update package.json to match README',
              'Run tests to determine actual Node version requirement'
            ]
          });
        }
      }
      
      // Check scripts
      const scripts = Object.keys(pkgJson.scripts || {});
      scripts.forEach(script => {
        const documented = readme.includes(`npm run ${script}`);
        if (!documented && !script.includes(':')) {
          findings.push({
            ruleId: 'package-json-conformance',
            severity: 'info',
            confidence: 0.95,
            message: `Undocumented script: ${script}`,
            evidence: [
              {
                type: 'file-content',
                source: 'package.json',
                value: `"${script}": "${pkgJson.scripts[script]}"`,
                description: 'Script defined in package.json'
              }
            ],
            location: {
              file: 'package.json'
            }
          });
        }
      });
      
    } catch (error) {
      findings.push({
        ruleId: 'package-json-conformance',
        severity: 'warning',
        confidence: 1.0,
        message: 'Could not check package.json conformance',
        evidence: [{
          type: 'runtime',
          source: 'package-json-conformance',
          value: error.message
        }]
      });
    }
    
    return findings;
  }
};

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const engine = new DocumentationGovernanceEngine({
    outputFormats: ['console', 'json', 'sarif']
  });
  
  // Register rules
  engine.registerRule(brokenLinksRule);
  engine.registerRule(packageJsonConformanceRule);
  
  // Load historical trends
  await engine.loadTrends();
  
  // Discover files
  const files = [];
  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !engine.config.excludePatterns.some(p => fullPath.includes(p))) {
        walk(fullPath);
      } else if (entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  }
  walk(process.cwd());
  
  console.log(`Found ${files.length} Markdown files\n`);
  
  // Load contents
  const fileContents = new Map();
  files.forEach(file => {
    try {
      fileContents.set(file, fs.readFileSync(file, 'utf-8'));
    } catch (e) {}
  });
  
  // Build graph
  const graph = { nodes: new Map(), edges: new Map() };
  
  // Run governance engine
  const context = { files, fileContents, graph, config: engine.config };
  await engine.run(context);
  
  // Generate output
  const outputs = engine.generateOutput();
  
  // Write outputs
  console.log(outputs.console);
  
  fs.writeFileSync('docs-health.json', JSON.stringify(outputs.json, null, 2));
  fs.writeFileSync('docs-health.sarif.json', JSON.stringify(outputs.sarif, null, 2));
  
  console.log('\nOutputs:');
  console.log('  - docs-health.json');
  console.log('  - docs-health.sarif.json');
  console.log('  - .docs-health-trends.json');
  
  // Exit
  const hasCritical = outputs.json.summary.critical > 0;
  process.exit(hasCritical ? 1 : 0);
}

main().catch(console.error);
