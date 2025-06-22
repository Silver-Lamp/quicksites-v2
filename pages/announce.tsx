'use client';
import { useEffect, useState } from 'react';
import { json } from '@/lib/api/json';

export default function AnnouncePage() {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    fetch('/announcements.json')
      .then((res) => res.json())
      .then(setEntries);
  }, []);

  return (
    <div className="max-w-3xl mx-auto p-6 text-white">
      <h1 className="text-3xl font-bold mb-4">📣 Announcements</h1>
      <ul className="space-y-6">
        {entries.map((a: any, i: number) => (
          <li key={i} className="border-l-2 border-blue-500 pl-4">
            <div className="text-zinc-400 text-sm mb-1">{a.date}</div>
            <div className="text-white font-semibold">{a.title}</div>
            <div className="text-zinc-300 text-sm">{a.body}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
