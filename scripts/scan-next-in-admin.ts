import fs from 'fs';
import path from 'path';

const TARGET_DIR = path.resolve('admin');
const MATCHES = ['next/server', 'next/headers'];
const TARGET_EXT = ['.ts', '.tsx'];

function walk(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

const allFiles = walk(TARGET_DIR).filter((file) =>
  TARGET_EXT.includes(path.extname(file))
);

let count = 0;

console.log(`🔍 Scanning for Next.js-specific imports in /admin...\n`);

for (const file of allFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, i) => {
    for (const match of MATCHES) {
      if (line.includes(match)) {
        count++;
        console.log(`⚠️  ${file}:${i + 1}`);
        console.log(`    ${line.trim()}`);
      }
    }
  });
}

console.log(
  `\n✅ Scan complete. Found ${count} usage${count === 1 ? '' : 's'} of 'next/*' in /admin.`
);
