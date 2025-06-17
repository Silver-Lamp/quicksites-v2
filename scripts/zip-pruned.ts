import archiver from 'archiver';
import fs from 'fs';
import path from 'path';

const OUTPUT_FILE = 'quicksites-pruned.zip';
const BASE_DIR = process.cwd();

const includedPaths = [
  'app',
  'pages',
  'components',
  'hooks',
  'lib',
  'types',
  'public',
  'scripts',
  'tsconfig.json',
  'package.json',
  'next.config.mjs',
  'next.config.js',
  'tailwind.config.ts',
  'postcss.config.cjs',
];

const excludedPatterns = [
  'node_modules',
  '.next',
  '.git',
  '__screenshots__',
  '__snapshots__',
  'playwright-report',
  '*.log',
];

const shouldInclude = (filePath: string) => {
  return !excludedPatterns.some((pattern) => {
    if (pattern.startsWith('*')) {
      return filePath.endsWith(pattern.slice(1));
    }
    return filePath.includes(pattern);
  });
};

const archive = archiver('zip', { zlib: { level: 9 } });
const output = fs.createWriteStream(path.join(BASE_DIR, OUTPUT_FILE));

archive.pipe(output);

(async () => {
  for (const relPath of includedPaths) {
    const fullPath = path.join(BASE_DIR, relPath);
    if (fs.existsSync(fullPath)) {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        archive.directory(fullPath, relPath, (entry: any) => {
          return shouldInclude(entry.name) ? entry : false;
        });
      } else {
        archive.file(fullPath, { name: relPath });
      }
    }
  }

  await archive.finalize();
  console.log(`✅ Created ${OUTPUT_FILE}`);
})();
