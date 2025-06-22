import fs from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = path.resolve('.');
const FILE_EXTS = ['.ts', '.tsx', '.js', '.jsx'];
const TARGET_IMPORT_PREFIX = '@/components/ui/';

function isCodeFile(file: string) {
  return FILE_EXTS.includes(path.extname(file));
}

function toKebabCase(str: string) {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

function walk(dir: string, allFiles: string[] = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath, allFiles);
    } else if (isCodeFile(fullPath)) {
      allFiles.push(fullPath);
    }
  }
  return allFiles;
}

function updateImports() {
  const files = walk(PROJECT_ROOT);
  let count = 0;

  for (const file of files) {
    let content = fs.readFileSync(file, 'utf-8');
    const original = content;

    content = content.replace(
      /from\s+['"]@\/components\/ui\/([A-Z][A-Za-z0-9]+)(\.tsx)?['"]/g,
      (_, compName) => {
        const kebab = toKebabCase(compName);
        count++;
        return `from '@/components/ui/${kebab}'`;
      }
    );

    if (content !== original) {
      fs.writeFileSync(file, content, 'utf-8');
      console.log(`✅ Updated imports in: ${file}`);
    }
  }

  console.log(`\n🔁 Rewrote ${count} imports to kebab-case.`);
}

updateImports();
