import fs from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = process.cwd();
const TARGET_EXT = ['.ts', '.tsx'];
const SEARCH_DIRS = ['app', 'pages', 'admin'];

function walk(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function replaceInFile(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf-8');
  if (!content.includes('NextResponse.json')) return;

  let updated = content;

  // Replace import
  updated = updated.replace(
    /import\s+{[^}]*NextResponse[^}]*}\s+from\s+['"]next\/server['"];/g,
    ''
  );

  // Add json import if not present
  if (!updated.includes("from '@/lib/api/json'")) {
    updated = updated.replace(
      /(^|\n)(import .+?;)+/s,
      `$&\nimport { json } from '@/lib/api/json';`
    );
  }

  // Replace NextResponse.json
  updated = updated.replace(/NextResponse\.json\s*\(/g, 'json(');

  fs.writeFileSync(filePath, updated, 'utf-8');
  console.log(`✅ updated: ${filePath}`);
}

for (const dir of SEARCH_DIRS) {
  const fullDir = path.join(PROJECT_ROOT, dir);
  if (!fs.existsSync(fullDir)) continue;

  const files = walk(fullDir).filter((f) => TARGET_EXT.includes(path.extname(f)));

  for (const file of files) {
    replaceInFile(file);
  }
}
