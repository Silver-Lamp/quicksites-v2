// scripts/lint-summary.ts
import { readFileSync, writeFileSync } from 'fs';

const raw = readFileSync('lint-report.json', 'utf-8');
const results = JSON.parse(raw);

const filtered = results
  .filter((entry: any) =>
    entry.filePath.includes('/quicksites-v2/') &&
    !entry.filePath.includes('/.venv/') &&
    !entry.filePath.includes('/node_modules/')
  )
  .map((entry: any) => ({
    file: entry.filePath,
    errors: entry.errorCount,
    warnings: entry.warningCount,
    total: entry.errorCount + entry.warningCount,
  }))
  .filter((entry) => entry.total > 0)
  .sort((a, b) => b.total - a.total);

const lines = filtered.map(
  (f) => `${f.total} issues (${f.errors} errors, ${f.warnings} warnings): ${f.file}`
);

const output = [
  `Found ${filtered.length} files with issues:\n`,
  ...lines,
].join('\n');

writeFileSync('lint-summary.txt', output);
console.log('✅ Summary written to lint-summary.txt');
