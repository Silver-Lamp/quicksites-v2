import { readFileSync, writeFileSync } from 'fs';
import path from 'node:path';

const raw = readFileSync('lint-report.json', 'utf-8');
const results = JSON.parse(raw);

type LintEntry = {
  file: string;
  errors: number;
  warnings: number;
  total: number;
};

function getTopFolder(filePath: string) {
  const parts = filePath.split('/');
  const idx = parts.findIndex((p) => p === 'quicksites-v2');
  return parts[idx + 1] || 'root';
}

const filtered: LintEntry[] = results
  .filter(
    (entry: any) =>
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
  .filter((entry: LintEntry) => entry.total > 0);

const grouped = new Map<string, LintEntry[]>();

for (const entry of filtered) {
  const folder = getTopFolder(entry.file);
  if (!grouped.has(folder)) grouped.set(folder, []);
  grouped.get(folder)!.push(entry);
}

// Sort each group: files with errors first, then by total issues desc
for (const [folder, entries] of grouped.entries()) {
  entries.sort((a, b) => {
    if (a.errors > 0 && b.errors === 0) return -1;
    if (a.errors === 0 && b.errors > 0) return 1;
    return b.total - a.total;
  });
}

const output: string[] = [];

output.push(`Found ${filtered.length} files with issues:\n`);

for (const [folder, entries] of [...grouped.entries()].sort()) {
  output.push(`📁 ${folder}/`);
  for (const entry of entries) {
    output.push(
      `  ${entry.total} issues (${entry.errors} errors, ${entry.warnings} warnings): ${entry.file}`
    );
  }
  output.push(''); // blank line between folders
}

writeFileSync('lint-summary.txt', output.join('\n'));
console.log('✅ Summary written to lint-summary.txt');
