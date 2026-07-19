#!/usr/bin/env node

/**
 * Documentation Health Linter
 * 
 * Checks documentation quality and returns exit code:
 * - 0: All checks passed
 * - 1: Critical issues found
 * - 2: Warnings found (optional failures)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class DocumentationLinter {
  constructor(options = {}) {
    this.errors = [];
    this.warnings = [];
    this.options = {
      failOnWarnings: options.failOnWarnings || false,
      checkBrokenLinks: options.checkBrokenLinks !== false,
      checkMetadata: options.checkMetadata !== false,
      checkOwnership: options.checkOwnership !== false,
      maxAge: options.maxAge || 180, // days
      ...options
    };
  }

  log(level, message, file = null) {
    const prefix = level === 'error' ? '✗' : '⚠';
    const fileStr = file ? ` (${file})` : '';
    console.log(`${prefix} ${message}${fileStr}`);
    
    if (level === 'error') {
      this.errors.push({ message, file });
    } else {
      this.warnings.push({ message, file });
    }
  }

  findMarkdownFiles(rootDir = '.') {
    const files = [];
    const exclude = ['node_modules', '.git', 'archive', 'scratch'];
    
    const walk = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!exclude.includes(entry.name)) {
            walk(fullPath);
          }
        } else if (entry.name.endsWith('.md')) {
          files.push(fullPath);
        }
      }
    };
    
    walk(rootDir);
    return files;
  }

  checkBrokenLinks(files) {
    console.log('\n## Checking Broken Links...\n');
    
    let brokenCount = 0;
    
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Match [text](url) pattern
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        let match;
        
        while ((match = linkRegex.exec(line)) !== null) {
          const [fullMatch, text, url] = match;
          
          // Skip external links
          if (url.startsWith('http') || url.startsWith('#')) {
            continue;
          }
          
          // Check if file exists
          const dir = path.dirname(file);
          const resolved = path.resolve(dir, url.split('#')[0]);
          
          if (!fs.existsSync(resolved)) {
            this.log('error', `Broken link: ${url} (line ${i+1})`, file);
            brokenCount++;
          }
        }
      }
    }
    
    if (brokenCount === 0) {
      console.log('✓ All links valid\n');
    }
    
    return brokenCount;
  }

  checkMetadata(files) {
    console.log('## Checking Metadata...\n');
    
    let missingMetadata = 0;
    
    for (const file of files) {
      // Skip READMEs and changelogs
      if (path.basename(file).toLowerCase() === 'readme.md' || 
          path.basename(file).toLowerCase() === 'changelog.md') {
        continue;
      }
      
      const content = fs.readFileSync(file, 'utf-8');
      
      // Check for YAML frontmatter
      const hasMetadata = content.startsWith('---');
      const hasOwner = /owner:/i.test(content.split('---')[1] || '');
      const hasStatus = /status:/i.test(content.split('---')[1] || '');
      
      if (!hasMetadata) {
        this.log('warning', 'Missing metadata (frontmatter)', file);
        missingMetadata++;
      } else if (!hasOwner) {
        this.log('warning', 'Missing owner in metadata', file);
        missingMetadata++;
      }
    }
    
    const total = files.filter(f => 
      path.basename(f).toLowerCase() !== 'readme.md' &&
      path.basename(f).toLowerCase() !== 'changelog.md'
    ).length;
    
    const percentage = ((total - missingMetadata) / total * 100).toFixed(1);
    console.log(`✓ Metadata coverage: ${percentage}%\n`);
    
    return missingMetadata;
  }

  checkFreshness(files) {
    console.log('## Checking Freshness...\n');
    
    const now = new Date();
    const maxAge = this.options.maxAge;
    let staleCount = 0;
    
    for (const file of files) {
      // Skip archive and scratch
      if (file.includes('/archive/') || file.includes('/scratch/')) {
        continue;
      }
      
      const stat = fs.statSync(file);
      const age = (now - stat.mtime) / (1000 * 60 * 60 * 24);
      
      if (age > maxAge) {
        this.log('warning', `Stale document (${Math.floor(age)} days old)`, file);
        staleCount++;
      }
    }
    
    if (staleCount === 0) {
      console.log('✓ All documents fresh\n');
    }
    
    return staleCount;
  }

  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('DOCUMENTATION HEALTH REPORT');
    console.log('='.repeat(80) + '\n');
    
    console.log(`Status: ${this.errors.length === 0 ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`Errors: ${this.errors.length}`);
    console.log(`Warnings: ${this.warnings.length}`);
    console.log(`\nDetails:`);
    
    if (this.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.errors.forEach(e => console.log(`   ${e.file}: ${e.message}`));
    }
    
    if (this.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      this.warnings.slice(0, 10).forEach(w => console.log(`   ${w.file}: ${w.message}`));
      if (this.warnings.length > 10) {
        console.log(`   ... and ${this.warnings.length - 10} more`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    
    // Exit codes
    if (this.errors.length > 0) {
      return 1;
    }
    if (this.options.failOnWarnings && this.warnings.length > 0) {
      return 2;
    }
    return 0;
  }

  run() {
    console.log('🔍 Running documentation health checks...\n');
    
    const files = this.findMarkdownFiles();
    console.log(`Found ${files.length} Markdown files\n`);
    
    if (this.options.checkBrokenLinks) {
      this.checkBrokenLinks(files);
    }
    
    if (this.options.checkMetadata) {
      this.checkMetadata(files);
    }
    
    if (this.options.maxAge) {
      this.checkFreshness(files);
    }
    
    return this.generateReport();
  }
}

// CLI entry point
if (require.main === module) {
  const linter = new DocumentationLinter({
    failOnWarnings: process.argv.includes('--fail-on-warnings'),
    checkBrokenLinks: !process.argv.includes('--skip-links'),
    checkMetadata: !process.argv.includes('--skip-metadata')
  });
  
  const exitCode = linter.run();
  process.exit(exitCode);
}

module.exports = DocumentationLinter;
