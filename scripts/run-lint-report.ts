import { existsSync } from 'fs';
import { execSync } from 'child_process';

if (!existsSync('.lint-tmp/scripts/lint-digest.js')) {
  console.log('🔧 lint-digest.js not found. Building...');
  execSync('npm run build:lint', { stdio: 'inherit' });
}

console.log('🚀 Running lint digest...');
execSync('node .lint-tmp/scripts/lint-digest.js', { stdio: 'inherit' });
s