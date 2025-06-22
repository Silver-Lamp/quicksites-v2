import fs from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = process.cwd();
const TARGET_EXT = ['.ts'];
const SEARCH_DIRS = ['app/api', 'app', 'pages', 'admin'];

const args = process.argv.slice(2);
const makeBackup = args.includes('--backup');

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function cleanFile(filePath: string) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;
  let changed = false;

  const isMiddleware = filePath.endsWith('middleware.ts');
  const isRoute = filePath.endsWith('route.ts');

  // Remove next/server imports
  content = content.replace(
    /import\s+{[^}]*Next(Request|Response)[^}]*}\s+from\s+['"]next\/server['"];\s*/g,
    () => {
      changed = true;
      return '';
    }
  );

  // Fix req.json() to await req.json()
  content = content.replace(/([^a-zA-Z0-9_])req\.json\s*\(\s*\)/g, (match, prefix) => {
    if (match.includes('await')) return match;
    changed = true;
    return `${prefix}await req.json()`;
  });

  // Fix route signatures (GET, POST, etc.)
  content = content.replace(
    /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(\s*req\s*\)/g,
    (_match, method) => {
      changed = true;
      return `export async function ${method}(req: Request): Promise<Response>`;
    }
  );

  // Fix middleware signature
  content = content.replace(/export\s+function\s+middleware\s*\(\s*req\s*\)/g, () => {
    changed = true;
    return `export function middleware(req: Request): Response`;
  });

  // Fix NextResponse.json
  content = content.replace(/NextResponse\.json\s*\(/g, () => {
    changed = true;
    return 'json(';
  });

  // Fix NextResponse.next() → new Response()
  content = content.replace(/NextResponse\.next\s*\(\s*\)/g, () => {
    changed = true;
    return 'new Response()';
  });

  // Add runtime = edge if missing
  if (!/export\s+const\s+runtime\s*=/.test(content)) {
    content = `export const runtime = 'experimental-edge';\n\n` + content;
    changed = true;
  }

  // Add import { json } if needed
  if (changed && !content.includes("from '@/lib/api/json'")) {
    content = content.replace(
      /(^|\n)(import .+?;)+/s,
      `$&\nimport { json } from '@/lib/api/json';`
    );
  }

  if (changed && content !== original) {
    if (makeBackup) {
      fs.writeFileSync(filePath + '.bak', original, 'utf8');
    }
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Modernized: ${filePath}`);
  }
}

const allFiles = SEARCH_DIRS.flatMap((dir) =>
  walk(path.join(PROJECT_ROOT, dir)).filter(
    (file) =>
      TARGET_EXT.includes(path.extname(file)) &&
      (file.endsWith('route.ts') || file.endsWith('middleware.ts'))
  )
);

if (allFiles.length === 0) {
  console.log('⚠️  No matching files found.');
  process.exit(0);
}

console.log(`🔧 Modernizing ${allFiles.length} file(s)...\n`);
allFiles.forEach(cleanFile);
console.log('\n🏁 Done.');
