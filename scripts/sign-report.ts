import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const dir = './reports/security';
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.pdf'));
const output = [];

for (const file of files) {
  const buffer = fs.readFileSync(path.join(dir, file));
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  output.push(`${file}  ${hash}`);
}

fs.writeFileSync(
  './public/reports/security-hashes.json',
  JSON.stringify(output, null, 2)
);
console.log('✅ security-hashes.json updated');
