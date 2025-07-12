'use client';

import { useEffect, useState } from 'react';

export default function VectorExplorerPage() {
  const [summary, setSummary] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSummary() {
      try {
        const res = await fetch('/api/vector/summary');
        if (!res.ok) throw new Error('Failed to load vector summary');
        const data = await res.json();
        setSummary(data);
      } catch (err: any) {
        setError(err.message);
      }
    }
    fetchSummary();
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">🧠 Vector Explorer</h1>

      {error && <p className="text-red-500">Error: {error}</p>}
      {!summary && !error && <p className="text-muted-foreground">Loading...</p>}

      {summary && (
        <div className="space-y-4">
          <div className="border p-4 rounded bg-white/5">
            <p><strong>Collection:</strong> {summary.name}</p>
            <p><strong>Status:</strong> {summary.status}</p>
            <p><strong>Total Vectors:</strong> {summary.vectorsCount}</p>
            <p><strong>Vector Size:</strong> {summary.vectorSize}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ExplorerPanel title="Block Types" data={summary.typeCounts} />
            <ExplorerPanel title="Industries" data={summary.industryCounts} />
            <ExplorerPanel title="Tones" data={summary.toneCounts} />
          </div>
        </div>
      )}
    </div>
  );
}

function ExplorerPanel({ title, data }: { title: string; data: Record<string, number> }) {
  return (
    <div className="border p-4 rounded bg-white/5">
      <h2 className="font-semibold mb-2 text-lg">{title}</h2>
      <ul className="text-sm space-y-1">
        {Object.entries(data).map(([key, count]) => (
          <li key={key}>
            <span className="font-medium">{key}</span>: {count}
          </li>
        ))}
      </ul>
    </div>
  );
}
