// components/dev-tools-widget/CookieEditor.tsx
'use client';

import { useState } from 'react';

export function CookieEditor({ cookies, onChange, onDelete }: {
  cookies: { [key: string]: string };
  onChange: (key: string, value: string) => void;
  onDelete: (key: string) => void;
}) {
  const [filter, setFilter] = useState('');

  const filtered = Object.entries(cookies).filter(([key]) =>
    key.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="pt-3">
      <div className="text-white font-semibold mb-1">Cookies</div>
      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter cookies..."
        className="w-full bg-zinc-800 text-white px-2 py-1 mb-2 rounded text-xs"
      />
      {filtered.length === 0 ? (
        <div className="text-zinc-500">No matching cookies</div>
      ) : (
        <ul className="space-y-1">
          {filtered.map(([key, value]) => (
            <li key={key} className="flex items-center gap-2">
              <span className="truncate max-w-[150px] text-zinc-300">{key}</span>
              <input
                type="text"
                value={value}
                onChange={(e) => onChange(key, e.target.value)}
                className="flex-1 bg-zinc-800 text-white px-2 py-1 rounded text-xs border border-zinc-600"
              />
              <button
                onClick={() => onDelete(key)}
                className="text-red-400 hover:underline text-xs"
              >
                Clear
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
