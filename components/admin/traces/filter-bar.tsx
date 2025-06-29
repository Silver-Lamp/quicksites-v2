// components/admin/traces/filter-bar.tsx
'use client';

import { useState, useEffect } from 'react';

type TraceEntry = {
  id: string;
  message: string;
  created_at: string;
};

type FilterBarProps = {
  entries: TraceEntry[];
  onFilter: (filtered: TraceEntry[]) => void;
};

export function FilterBar({ entries, onFilter }: FilterBarProps) {
  const [query, setQuery] = useState('');
  const [range, setRange] = useState('all');

  useEffect(() => {
    const now = Date.now();
    const filtered = entries.filter((entry) => {
      const matchesQuery = entry.message.toLowerCase().includes(query.toLowerCase());

      const createdAt = new Date(entry.created_at).getTime();
      const matchesTime =
        range === 'all' ||
        (range === '24h' && now - createdAt < 1000 * 60 * 60 * 24) ||
        (range === '7d' && now - createdAt < 1000 * 60 * 60 * 24 * 7);

      return matchesQuery && matchesTime;
    });

    onFilter(filtered);
  }, [query, range, entries]);

  return (
    <div className="mb-4 flex flex-wrap gap-4 items-center text-sm text-zinc-200">
      <input
        type="text"
        placeholder="Search messages..."
        className="bg-zinc-800 border border-zinc-600 rounded px-3 py-1 w-64"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <select
        value={range}
        onChange={(e) => setRange(e.target.value)}
        className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1"
      >
        <option value="all">All Time</option>
        <option value="24h">Last 24h</option>
        <option value="7d">Last 7d</option>
      </select>
    </div>
  );
}
