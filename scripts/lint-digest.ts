import { readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';

const raw = readFileSync('lint-report.json', 'utf-8');
const results = JSON.parse(raw);

const shouldInclude = (path: string) =>
  path.includes('/quicksites-v2/') &&
  !path.includes('/.venv/') &&
  !path.includes('/node_modules/');

const filtered = results
  .filter((entry: any) => shouldInclude(entry.filePath))
  .map((entry: any) => ({
    file: entry.filePath,
    folder: dirname(entry.filePath).split('/quicksites-v2/')[1]?.split('/')[0] || '',
    errors: entry.errorCount,
    warnings: entry.warningCount,
    total: entry.errorCount + entry.warningCount,
    messages: entry.messages.map((m: any) => ({
      line: m.line,
      column: m.column,
      message: m.message,
      ruleId: m.ruleId,
      severity: m.severity === 2 ? 'error' : 'warning',
    })),
  }))
  .filter((entry) => entry.total > 0);

// Write full filtered JSON
writeFileSync('filtered-lint-report.json', JSON.stringify(filtered, null, 2));
console.log(`✅ Wrote ${filtered.length} files to filtered-lint-report.json`);

const grouped: Record<string, { total: number; errors: number; warnings: number; files: any[] }> = {};

for (const entry of filtered) {
  const group = entry.folder || 'root';
  if (!grouped[group]) {
    grouped[group] = { total: 0, errors: 0, warnings: 0, files: [] };
  }
  grouped[group].total += entry.total;
  grouped[group].errors += entry.errors;
  grouped[group].warnings += entry.warnings;
  grouped[group].files.push(entry);
}

const summaryLines = Object.entries(grouped)
  .sort((a, b) => b[1].total - a[1].total)
  .flatMap(([folder, data]) => {
    const header = `\n📂 ${folder} (${data.total} issues — ${data.errors} errors, ${data.warnings} warnings)`;
    const files = data.files
      .sort((a, b) => b.total - a.total)
      .map(
        (f) => `  ${f.total} issues (${f.errors} errors, ${f.warnings} warnings): ${f.file}`
      );
    return [header, ...files];
  });

writeFileSync('lint-summary.txt', summaryLines.join('\n'));
console.log('✅ Summary written to lint-summary.txt');
