import fs from 'node:fs';
import path from 'node:path';

const COMPONENTS_DIR = path.resolve('components');
const EXTS = ['.tsx', '.ts'];

function isPascalCase(name: string) {
  return /^[A-Z][a-zA-Z0-9]+$/.test(name.replace(/\.[^.]+$/, ''));
}

function toKebabCase(str: string) {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

function walk(dir: string, found: string[] = []) {
  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath, found);
    } else if (EXTS.includes(path.extname(fullPath)) && isPascalCase(path.basename(fullPath, path.extname(fullPath)))) {
      found.push(fullPath);
    }
  }
  return found;
}

function renamePascalFilesToKebab() {
  const files = walk(COMPONENTS_DIR);
  for (const file of files) {
    const ext = path.extname(file);
    const dir = path.dirname(file);
    const base = path.basename(file, ext);
    const kebab = toKebabCase(base);
    const newPath = path.join(dir, kebab + ext);

    if (fs.existsSync(newPath)) {
      console.warn(`⚠️  Skipping: ${file} → ${newPath} (already exists)`);
    } else {
      fs.renameSync(file, newPath);
      console.log(`✅ Renamed: ${path.relative('.', file)} → ${path.relative('.', newPath)}`);
    }
  }
}

renamePascalFilesToKebab();
