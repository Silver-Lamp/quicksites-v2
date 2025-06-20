import fs from 'fs';
import path from 'path';

const TARGET_DIR = path.resolve('admin');
const EXTENSIONS = ['.ts', '.tsx'];
const REMOVE_HEADERS = true;

const args = process.argv.slice(2);
const makeBackup = args.includes('--backup');

function walk(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function cleanFile(filePath: string) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  let changed = false;

  // Remove next/server imports
  content = content.replace(
    /import\s+{[^}]*Next(Request|Response)[^}]*}\s+from\s+['"]next\/server['"];\s*/g,
    () => {
      changed = true;
      return '';
    }
  );

  // Remove next/headers imports
  content = content.replace(
    /import\s+{[^}]*cookies[^}]*}\s+from\s+['"]next\/headers['"];\s*/g,
    () => {
      changed = true;
      return '';
    }
  );

  // Optionally remove cookies() calls
  if (REMOVE_HEADERS) {
    content = content.replace(/const\s+\w+\s*=\s*cookies\(\);\s*/g, () => {
      changed = true;
      return '';
    });
  }

  if (changed && content !== original) {
    if (makeBackup) {
      fs.writeFileSync(filePath + '.bak', original, 'utf8');
    }
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Cleaned: ${filePath}`);
  }
}

console.log(`🔧 Removing 'next/server' and 'next/headers' from /admin...`);

const allFiles = walk(TARGET_DIR).filter((file) => EXTENSIONS.includes(path.extname(file)));

for (const file of allFiles) {
  cleanFile(file);
}

console.log('🏁 Done.');
