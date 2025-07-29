'use client';

import { useEffect, useState } from 'react';

export default function GSCStats({ siteUrl }: { siteUrl: string }) {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    fetch(`/api/gsc/performance?site=${encodeURIComponent(siteUrl)}`)
      .then(res => res.json())
      .then(setData)
      .catch(console.error);
  }, [siteUrl]);

  return (
    <div className="rounded bg-white/5 p-4 text-white">
      <h3 className="font-semibold mb-2">Search Console Performance</h3>
      {data.length === 0 ? (
        <p className="text-sm opacity-60">No data</p>
      ) : (
        <ul className="text-sm space-y-1">
          {data.map((row, i) => (
            <li key={i}>
              <strong>{row.keys?.[0]}</strong> — {row.clicks} clicks, {row.impressions} impressions
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
