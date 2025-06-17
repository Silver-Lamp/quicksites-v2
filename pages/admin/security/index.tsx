'use client';
import { useEffect, useState } from 'react';

export default function SecurityDashboard() {
  const [summary, setSummary] = useState('');
  const [lastAlert, setLastAlert] = useState('');
  const [cleanupCount, setCleanupCount] = useState(0);

  useEffect(() => {
    fetch('/reports/security.log')
      .then((res) => res.text())
      .then((text) => {
        setSummary(text);
        const match = text.match(/ALERT:.*\n/);
        if (match) setLastAlert(match[0].trim());
        const cleanMatch = text.match(/Expired tokens cleaned: (\d+)/);
        if (cleanMatch) setCleanupCount(Number(cleanMatch[1]));
      });
  }, []);

  return (
    <div className="p-6 text-text">
      <h1 className="text-2xl font-bold mb-4">🛡 Security Overview</h1>
      <div className="space-y-3">
        <p>
          Last Slack Alert:{' '}
          <span className="text-yellow-400">
            {lastAlert || 'None recorded'}
          </span>
        </p>
        <p>
          Expired tokens cleaned:{' '}
          <span className="text-green-400">{cleanupCount}</span>
        </p>
      </div>
      <div className="mt-6 bg-zinc-900 p-4 rounded text-sm">
        <h2 className="font-semibold text-white mb-2">🔍 Log Preview</h2>
        <pre className="whitespace-pre-wrap text-zinc-400 max-h-[60vh] overflow-auto">
          {summary}
        </pre>
      </div>
    </div>
  );
}
