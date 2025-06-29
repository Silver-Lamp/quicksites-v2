// components/admin/traces/group-by-route.tsx
'use client';

import { useState } from 'react';

type TraceEntry = {
  id: string;
  route: string;
  message: string;
  context?: Record<string, any>;
  created_at: string;
};

export function GroupByRoute({
  entries,
}: {
  entries: TraceEntry[];
}) {
  const [grouped, setGrouped] = useState(true);

  const groupedData = entries.reduce((acc, entry) => {
    acc[entry.route] = acc[entry.route] || [];
    acc[entry.route].push(entry);
    return acc;
  }, {} as Record<string, TraceEntry[]>);

  return (
    <div className="space-y-4">
      <div className="mb-2 text-sm text-zinc-400">
        <label>
          <input
            type="checkbox"
            checked={grouped}
            onChange={() => setGrouped((v) => !v)}
            className="mr-2"
          />
          Group by route
        </label>
      </div>

      {grouped
        ? Object.entries(groupedData).map(([route, group]) => (
            <div key={route} className="border border-zinc-700 rounded">
              <div className="bg-zinc-800 px-4 py-2 font-mono text-xs text-indigo-300 border-b border-zinc-700">
                {route}
              </div>
              <div className="divide-y divide-zinc-800">
                {group.map((entry) => (
                  <div key={entry.id} className="p-4">
                    <div className="text-white font-medium mb-1">{entry.message}</div>
                    {entry.context && (
                      <pre className="bg-zinc-950 text-zinc-400 p-3 text-xs rounded overflow-x-auto">
                        {JSON.stringify(entry.context, null, 2)}
                      </pre>
                    )}
                    <div className="text-right text-zinc-500 text-xs mt-2">
                      {new Date(entry.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        : entries.map((entry) => (
            <div key={entry.id} className="bg-zinc-900 border border-zinc-700 rounded-lg p-4">
              <div className="text-white font-medium mb-1">{entry.message}</div>
              <div className="text-zinc-400 text-xs mb-2">{entry.route}</div>
              {entry.context && (
                <pre className="bg-zinc-950 text-zinc-400 p-3 text-xs rounded overflow-x-auto">
                  {JSON.stringify(entry.context, null, 2)}
                </pre>
              )}
              <div className="text-right text-zinc-500 text-xs mt-2">
                {new Date(entry.created_at).toLocaleString()}
              </div>
            </div>
          ))}
    </div>
  );
}
