import fs from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = process.cwd();
const TARGET_EXT = ['.ts', '.tsx'];
const SEARCH_DIRS = ['app', 'pages', 'admin', 'src'];

const args = process.argv.slice(2);
const isPreview = args.includes('--preview');
const isBackup = args.includes('--backup');

function walk(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function replaceInFile(filePath: string) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;
  let changed = false;

  // Remove NextResponse import
  content = content.replace(
    /import\s+{[^}]*NextResponse[^}]*}\s+from\s+['"]next\/server['"];/g,
    () => {
      changed = true;
      return '';
    }
  );

  // Replace NextResponse.json(...) → json(...)
  content = content.replace(/NextResponse\.json\s*\(/g, () => {
    changed = true;
    return 'json(';
  });

  // Replace res.status(###).json(...) → json(..., ###)
  content = content.replace(/res\.status\s*\(\s*(\d{3})\s*\)\.json\s*\(/g, (_m, code) => {
    changed = true;
    return `json(`; // Could inline status later
  });

  // Replace res.json(...) → json(...)
  content = content.replace(/res\.json\s*\(/g, () => {
    changed = true;
    return 'json(';
  });

  // Ensure req.json() → await req.json()
  content = content.replace(/([^a-zA-Z0-9_])req\.json\s*\(\s*\)/g, (match, prefix) => {
    if (match.includes('await')) return match;
    changed = true;
    return `${prefix}await req.json()`;
  });

  // Add json import if needed
  if (changed && !content.includes("from '@/lib/api/json'")) {
    content = content.replace(
      /(^|\n)(import .+?;)+/s,
      `$&\nimport { json } from '@/lib/api/json';`
    );
  }

  if (changed && content !== original) {
    if (isPreview) {
      console.log(`🔍 [PREVIEW] Would update: ${filePath}`);
    } else {
      if (isBackup) {
        fs.writeFileSync(filePath + '.bak', original, 'utf-8');
      }
      fs.writeFileSync(filePath, content, 'utf-8');
      console.log(`✅ Updated: ${filePath}`);
    }
  }
}

let updatedCount = 0;
for (const dir of SEARCH_DIRS) {
  const fullDir = path.join(PROJECT_ROOT, dir);
  if (!fs.existsSync(fullDir)) continue;

  const files = walk(fullDir).filter((f) => TARGET_EXT.includes(path.extname(f)));

  for (const file of files) {
    const before = fs.readFileSync(file, 'utf-8');
    replaceInFile(file);
    const after = fs.readFileSync(file, 'utf-8');
    if (before !== after) updatedCount++;
  }
}

console.log(`\n🏁 Done. ${isPreview ? 'Would update' : 'Updated'} ${updatedCount} file(s).`);
