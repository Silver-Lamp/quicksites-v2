const fs = require('fs');
const path = require('path');

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const pattern = /<Link[^>]*>\s*<a[^>]*>/g;
  return pattern.test(content);
}

function scanDirectory(dir) {
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx')) {
      if (checkFile(fullPath)) {
        console.error(`❌ Invalid <Link><a> pattern in: ${fullPath}`);
        process.exitCode = 1;
      }
    }
  }
}

scanDirectory('./pages');
scanDirectory('./components');
