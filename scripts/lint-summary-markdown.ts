import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

const raw = readFileSync('lint-report.json', 'utf-8');
const results = JSON.parse(raw);

type Message = {
  line: number;
  column: number;
  message: string;
  ruleId: string | null;
  severity: 'error' | 'warning';
};

type LintEntry = {
  file: string;
  errors: number;
  warnings: number;
  total: number;
  messages: Message[];
};

function getTopFolder(filePath: string) {
  const parts = filePath.split('/');
  const idx = parts.findIndex((p) => p === 'quicksites-v2');
  return parts[idx + 1] || 'root';
}

const filtered: LintEntry[] = results
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
    messages: entry.messages.map((m: any) => ({
      line: m.line,
      column: m.column,
      message: m.message,
      ruleId: m.ruleId,
      severity: m.severity === 2 ? 'error' : 'warning',
    })),
  }))
  .filter((entry) => entry.total > 0);

const grouped = new Map<string, LintEntry[]>();

for (const entry of filtered) {
  const folder = getTopFolder(entry.file);
  if (!grouped.has(folder)) grouped.set(folder, []);
  grouped.get(folder)!.push(entry);
}

// Sort entries in each folder: errors first, then by total issues desc
for (const [folder, entries] of grouped.entries()) {
  entries.sort((a, b) => {
    if (a.errors > 0 && b.errors === 0) return -1;
    if (a.errors === 0 && b.errors > 0) return 1;
    return b.total - a.total;
  });
}

const lines: string[] = [];

lines.push(`# ESLint Report`);
lines.push(`Found **${filtered.length}** files with issues.\n`);

for (const [folder, entries] of [...grouped.entries()].sort()) {
  lines.push(`## 📁 \`${folder}/\``);
  for (const entry of entries) {
    lines.push(`### 🔹 \`${entry.file}\``);
    lines.push(
      `- **${entry.total} issues**: ${entry.errors} error(s), ${entry.warnings} warning(s)\n`
    );
    for (const m of entry.messages) {
      lines.push(
        `  - [${m.severity}] Line ${m.line}:${m.column} – ${m.message} (${m.ruleId || 'unknown'})`
      );
    }
    lines.push('');
  }
}

writeFileSync('lint-summary.md', lines.join('\n'));
console.log('✅ Markdown report written to lint-summary.md');
