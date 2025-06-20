import fs from 'fs';
import path from 'path';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const EXTS = ['.ts', '.tsx', '.js', '.jsx'];
const IMPORT_REGEX = /import\s+[^'"]*['"]([^'"]+)['"]/g;

function walk(dir: string, fileList: string[] = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath, fileList);
    } else if (EXTS.includes(path.extname(file))) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function checkCasing() {
  const allFiles = walk(ROOT_DIR);
  let problems = 0;

  for (const file of allFiles) {
    const contents = fs.readFileSync(file, 'utf-8');
    let match: RegExpExecArray | null;
    IMPORT_REGEX.lastIndex = 0;

    while ((match = IMPORT_REGEX.exec(contents)) !== null) {
      const importPath = match[1];

      if (
        importPath.startsWith('.') || // relative
        importPath.startsWith('@/')    // alias
      ) {
        const resolved = path.resolve(path.dirname(file), importPath.replace(/^@\//, ''));
        const withExtension = EXTS.map(ext => resolved + ext).find(f => fs.existsSync(f));
        if (withExtension) {
          const actual = fs.realpathSync(withExtension);
          const requested = path.resolve(path.dirname(file), importPath.replace(/^@\//, '')) + path.extname(actual);

          if (actual !== requested) {
            problems++;
            console.log(
              `❗ Import casing mismatch in:\n  ${file}\n  → import: ${importPath}\n  → actual: ${path.relative(ROOT_DIR, actual)}\n`
            );
          }
        }
      }
    }
  }

  if (problems === 0) {
    console.log('✅ No import casing mismatches found.');
  } else {
    console.log(`❌ Found ${problems} casing mismatch${problems === 1 ? '' : 'es'}.`);
    process.exit(1);
  }
}

checkCasing();
