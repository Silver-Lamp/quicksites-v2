'use client';
import { useEffect, useState } from 'react';

export default function SecurityTimelinePage() {
  const [log, setLog] = useState('');

  useEffect(() => {
    fetch('/reports/security.log')
      .then((res) => res.text())
      .then(setLog);
  }, []);

  const lines = log.split('\n').filter(Boolean);

  return (
    <div className="p-6 text-text">
      <h1 className="text-xl font-bold mb-4">📆 Security Audit Timeline</h1>
      <ul className="space-y-2 text-sm font-mono">
        {lines.reverse().map((line, i) => (
          <li key={i} className="bg-zinc-900 p-2 rounded border border-zinc-800">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}
