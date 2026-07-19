// Add to package.json scripts
const scripts = {
  "docs:health": "node scripts/docs-health.js",
  "docs:lint": "node scripts/docs-lint.js",
  "docs:graph": "node scripts/docs-graph.js"
};

console.log("Add these scripts to package.json:");
console.log(JSON.stringify(scripts, null, 2));
