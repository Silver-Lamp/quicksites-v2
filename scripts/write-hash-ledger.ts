import fs from 'fs';
import crypto from 'crypto';

export type AuditLog = {
  id?: string;
  block_id: string;
  action: 'cheer' | 'echo' | 'reflect' | string;
  handle?: string;
  timestamp: string;
  ip_address?: string;
  user_id?: string;
  metadata?: Record<string, any>;
};

export function writeAuditHashes(logs: AuditLog[], filename = 'security-hashes.json') {
  const result = logs.map((entry) => {
    const hash = crypto.createHash('sha256').update(JSON.stringify(entry)).digest('hex');
    return { ...entry, hash };
  });

  fs.writeFileSync(`reports/${filename}`, JSON.stringify(result, null, 2));
}
