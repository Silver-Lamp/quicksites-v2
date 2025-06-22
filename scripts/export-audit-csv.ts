import fs from 'node:fs';
import path from 'node:path';

export function exportLogsToCSV(logs: any[], filename = 'audit.csv') {
  const rows = logs.map((l: any) =>
    [l.type, JSON.stringify(l.payload).replace(/"/g, '""'), l.created_at].join(',')
  );
  const header = 'type,payload,created_at';
  fs.writeFileSync(path.join('reports', filename), [header, ...rows].join('\n'));
}
