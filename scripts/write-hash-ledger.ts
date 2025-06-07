import fs from 'fs';
import crypto from 'crypto';

export function writeAuditHashes(logs, filename = 'security-hashes.json') {
  const result = logs.map((entry) => {
    const hash = crypto.createHash('sha256').update(JSON.stringify(entry)).digest('hex');
    return { ...entry, hash };
  });

  fs.writeFileSync(`reports/${filename}`, JSON.stringify(result, null, 2));
}
