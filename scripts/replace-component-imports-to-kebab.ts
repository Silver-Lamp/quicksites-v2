import fs from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = path.resolve('.');
const FILE_EXTS = ['.ts', '.tsx', '.js', '.jsx'];
const COMPONENT_ALIAS = '@/components/';

function toKebabCase(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

function walk(dir: string, files: string[] = []) {
  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath, files);
    } else if (FILE_EXTS.includes(path.extname(fullPath))) {
      files.push(fullPath);
    }
  }
  return files;
}

function updateImportsToKebabCase() {
  const files = walk(PROJECT_ROOT);
  let updated = 0;

  for (const file of files) {
    let code = fs.readFileSync(file, 'utf-8');
    const original = code;

    // Replace '@/components/some-component' → '@/components/some-component'
    code = code.replace(/(['"])@\/components\/((?:[A-Za-z0-9]+\/)*)([A-Z][A-Za-z0-9]*)\1/g, (_, quote, pathPart, filePart) => {
      return `${quote}@/components/${pathPart}${toKebabCase(filePart)}${quote}`;
    });

    if (code !== original) {
      fs.writeFileSync(file, code, 'utf-8');
      console.log(`📝 Updated imports in: ${path.relative(PROJECT_ROOT, file)}`);
      updated++;
    }
  }

  console.log(`\n✅ Done. Updated ${updated} file(s).`);
}

updateImportsToKebabCase();
