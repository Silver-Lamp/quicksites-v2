import { promises as fs } from 'fs';
import path from 'path';

const PAGES_API = path.join(process.cwd(), 'pages', 'api');
const APP_API = path.join(process.cwd(), 'app', 'api');

const shouldIgnore = (filename: string) =>
  filename.endsWith('.disabled') || filename.includes('.test.') || filename.includes('.spec.');

async function* walk(dir: string): AsyncGenerator<string> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const res = path.resolve(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(res);
    } else if ((res.endsWith('.ts') || res.endsWith('.tsx')) && !shouldIgnore(res)) {
      yield res;
    }
  }
}

function toRoutePath(file: string): { from: string; to: string } {
  const relativePath = path.relative(PAGES_API, file);
  const routePath = path.join(
    APP_API,
    relativePath.replace(/\\.tsx?$/, ''),
    'route' + path.extname(file)
  );
  return { from: file, to: routePath };
}

async function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

async function migrateFile(from: string, to: string) {
  const content = await fs.readFile(from, 'utf8');
  const alreadyHasRuntime = /export const runtime ?=/.test(content);
  const runtimeLine = "export const runtime = 'nodejs';\\n\\n";
  const newContent = alreadyHasRuntime ? content : runtimeLine + content;
  await ensureDir(to);
  await fs.writeFile(to, newContent, 'utf8');
  console.log(`🚚 Migrated: ${from.replace(process.cwd(), '')} → ${to.replace(process.cwd(), '')}`);
}

(async () => {
  for await (const file of walk(PAGES_API)) {
    const { from, to } = toRoutePath(file);

    try {
      await fs.access(to);
      console.log(`⚠️  Skipping (already exists): ${to.replace(process.cwd(), '')}`);
    } catch {
      await migrateFile(from, to);
    }
  }

  console.log('\\n✅ All remaining API files migrated. Review changes before committing.');
})();
