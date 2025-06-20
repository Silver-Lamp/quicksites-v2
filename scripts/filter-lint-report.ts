// scripts/filter-lint-report.ts
import { readFileSync, writeFileSync } from 'fs';

const raw = readFileSync('lint-report.json', 'utf-8');
const results = JSON.parse(raw);

const filtered = results
  .filter(
    (entry: any) =>
      entry.filePath.includes('/quicksites-v2/') &&
      !entry.filePath.includes('/.venv/') &&
      !entry.filePath.includes('/node_modules/')
  )
  .map((entry: any) => ({
    file: entry.filePath,
    errorCount: entry.errorCount,
    warningCount: entry.warningCount,
    messages: entry.messages.map((m: any) => ({
      line: m.line,
      column: m.column,
      message: m.message,
      ruleId: m.ruleId,
      severity: m.severity === 2 ? 'error' : 'warning',
    })),
  }));

writeFileSync('filtered-lint-report.json', JSON.stringify(filtered, null, 2));
console.log(`✅ Wrote ${filtered.length} files with issues to filtered-lint-report.json`);
