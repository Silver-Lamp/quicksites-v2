'use client';
import { useEffect, useState } from 'react';
import { json } from '@/lib/api/json';

type ForkRecord = {
  name: string;
  base?: string;
  count: number;
};

export default function ForksPage() {
  const [data, setData] = useState<ForkRecord[]>([]);

  useEffect(() => {
    fetch('/api/forks')
      .then((res) => res.json())
      .then(setData);
  }, []);

  return (
    <div className="p-6 text-white max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">🔁 Forked Templates</h1>
      <table className="w-full text-sm">
        <thead className="text-zinc-400 text-xs border-b border-zinc-600">
          <tr>
            <th className="text-left p-2">Template</th>
            <th className="text-left p-2">Forked From</th>
            <th className="text-right p-2">Times Forked</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-zinc-700">
              <td className="p-2">{row.name}</td>
              <td className="p-2">{row.base || '—'}</td>
              <td className="p-2 text-right">{row.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
