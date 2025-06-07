'use client';
import { useEffect, useState } from 'react';

export default function AuditLog() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    fetch('/api/audit-logs')
      .then((res) => res.json())
      .then(setLogs);
  }, []);

  return (
    <div className="p-6 text-white max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">📜 Audit Log</h1>
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="border-b p-2">Type</th>
            <th className="border-b p-2">Details</th>
            <th className="border-b p-2">Time</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log: any, i) => (
            <tr key={i}>
              <td className="p-2">{log.type}</td>
              <td className="p-2 text-zinc-300">{JSON.stringify(log.payload)}</td>
              <td className="p-2 text-zinc-500">{new Date(log.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
