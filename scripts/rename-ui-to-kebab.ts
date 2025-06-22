import fs from 'node:fs';
import path from 'node:path';

const UI_DIR = path.resolve('components/ui');

function isPascalCase(name: string) {
  return /^[A-Z][a-z0-9]+/.test(name) && !name.includes('-');
}

function toKebabCase(str: string) {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/\.tsx$/, '')
    .toLowerCase();
}

function renamePascalFilesToKebab(dir: string) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isFile() && file.endsWith('.tsx') && isPascalCase(file)) {
      const kebabName = toKebabCase(file) + '.tsx';
      const newPath = path.join(dir, kebabName);

      if (fs.existsSync(newPath)) {
        console.warn(`⚠️  Skipping rename: ${file} → ${kebabName} (target already exists)`);
        continue;
      }

      fs.renameSync(fullPath, newPath);
      console.log(`✅ Renamed: ${file} → ${kebabName}`);
    }
  }
}

renamePascalFilesToKebab(UI_DIR);
