import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

console.log('🟡 lint-digest.ts: starting analysis...');

if (typeof process !== 'undefined' && process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log('🟢 lint-digest.ts: running as main module');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Only run if executed directly
if (process.argv[1] === __filename) {
  console.log('🚀 Starting lint-digest.ts...');

  const lintFile = 'lint-report.json';
  const txtOut = 'lint-summary.txt';
  const mdOut = 'lint-summary.md';

  if (!existsSync(lintFile)) {
    console.error(`❌ Missing ${lintFile}. Make sure ESLint ran correctly.`);
    process.exit(1);
  }

  let results: any[];
  try {
    const raw = readFileSync(lintFile, 'utf-8');
    results = JSON.parse(raw);
    if (!Array.isArray(results)) throw new Error('Expected an array of lint results');
  } catch (err) {
    console.error(`❌ Failed to read or parse ${lintFile}:`, err);
    process.exit(1);
  }

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
      messages: entry.messages.map((m: any) => ({
        line: m.line,
        column: m.column,
        message: m.message,
        ruleId: m.ruleId,
        severity: m.severity === 2 ? 'error' : 'warning',
      })),
    }))
    .filter((entry: LintEntry) => entry.total > 0);

  const grouped = new Map<string, LintEntry[]>();
  for (const entry of filtered) {
    const folder = getTopFolder(entry.file);
    if (!grouped.has(folder)) grouped.set(folder, []);
    grouped.get(folder)!.push(entry);
  }

  for (const entries of grouped.values()) {
    entries.sort((a, b) => {
      if (a.errors > 0 && b.errors === 0) return -1;
      if (a.errors === 0 && b.errors > 0) return 1;
      return b.total - a.total;
    });
  }

  // Write .txt summary
  const txtLines: string[] = [];
  txtLines.push(`Found ${filtered.length} files with issues:\n`);
  for (const [folder, entries] of [...grouped.entries()].sort()) {
    txtLines.push(`${folder}/`);
    for (const entry of entries) {
      txtLines.push(
        `  ${entry.total} issues (${entry.errors} errors, ${entry.warnings} warnings): ${entry.file}`
      );
    }
    txtLines.push('');
  }
  console.log('📄 Writing lint-summary.txt...');
  writeFileSync(txtOut, txtLines.join('\n'));

  // Write .md summary
  const mdLines: string[] = [];
  mdLines.push(`# ESLint Report`);
  mdLines.push(`Found **${filtered.length}** files with issues.\n`);
  for (const [folder, entries] of [...grouped.entries()].sort()) {
    mdLines.push(`## 📁 \`${folder}/\``);
    for (const entry of entries) {
      mdLines.push(`### 🔹 \`${entry.file}\``);
      mdLines.push(
        `- **${entry.total} issues**: ${entry.errors} error(s), ${entry.warnings} warning(s)\n`
      );
      for (const m of entry.messages) {
        mdLines.push(
          `  - [${m.severity}] Line ${m.line}:${m.column} – ${m.message} (${m.ruleId || 'unknown'})`
        );
      }
      mdLines.push('');
    }
  }
  console.log('📄 Writing lint-summary.md...');
  writeFileSync(mdOut, mdLines.join('\n'));

  // Final check: confirm both outputs exist
  if (!existsSync(txtOut) || !existsSync(mdOut)) {
    console.error('❌ Failed to write summary files.');
    process.exit(1);
  }

  console.log(`✅ Summary complete — ${grouped.size} folders, ${filtered.length} files`);
}
