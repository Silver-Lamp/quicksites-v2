import fs from 'fs';
import path from 'path';

export function exportLogsToCSV(logs, filename = 'audit.csv') {
  const rows = logs.map(l =>
    [l.type, JSON.stringify(l.payload).replace(/"/g, '""'), l.created_at].join(',')
  );
  const header = 'type,payload,created_at';
  fs.writeFileSync(path.join('reports', filename), [header, ...rows].join('\n'));
}
