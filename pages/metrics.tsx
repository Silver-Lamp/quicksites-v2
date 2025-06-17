'use client';
import { useEffect, useState } from 'react';
import { json } from '@/lib/api/json';

export default function MetricsPage() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetch('/api/metrics')
      .then((res) => json())
      .then(setStats);
  }, []);

  return (
    <div className="p-6 text-white max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">📊 QuickSites Metrics</h1>

      {!stats ? (
        <p>Loading...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 mb-6 text-center">
            <div className="bg-zinc-800 rounded p-4">
              <div className="text-4xl font-bold">{stats.claimed}</div>
              <div className="text-sm text-zinc-400">Sites Claimed</div>
            </div>
            <div className="bg-zinc-800 rounded p-4">
              <div className="text-4xl font-bold">{stats.published}</div>
              <div className="text-sm text-zinc-400">Sites Published</div>
            </div>
            <div className="bg-zinc-800 rounded p-4">
              <div className="text-4xl font-bold">{stats.views7d}</div>
              <div className="text-sm text-zinc-400">Views (Last 7d)</div>
            </div>
            <div className="bg-zinc-800 rounded p-4">
              <div className="text-4xl font-bold">{stats.forks}</div>
              <div className="text-sm text-zinc-400">Forked Sites</div>
            </div>
          </div>
          <p className="text-sm text-zinc-500 text-center">
            Data auto-refreshes daily. For transparency, visit{' '}
            <a href="/announce" className="underline">
              /announce
            </a>
            .
          </p>
        </>
      )}
    </div>
  );
}
