import { readdirSync, statSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

// Ensure we're running from the root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Target token name from Supabase
const SUPABASE_TOKEN_KEY = 'sb-';

// Files we want to scan
const fileExtensions = ['.ts', '.tsx', '.js', '.jsx'];

function walk(dir: string): string[] {
  let files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory() && !['node_modules', '.next', 'dist'].includes(entry)) {
      files = files.concat(walk(fullPath));
    } else if (fileExtensions.some((ext) => fullPath.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  return files;
}

function scanFile(filePath: string) {
  const content = readFileSync(filePath, 'utf-8');
  const matches = content.match(/cookies\(\)\.get\(['"`]sb-[^'"`]+['"`]\)/g);
  if (matches) {
    console.log(`\n🔍 Found ${matches.length} match(es) in ${filePath}`);
    matches.forEach((m) => console.log('  →', m));
  }
}

function main() {
  console.log('📦 Scanning for direct Supabase token usage in cookies()...\n');
  const files = walk(projectRoot);
  files.forEach(scanFile);
  console.log('\n✅ Scan complete.\n');
}

main();
