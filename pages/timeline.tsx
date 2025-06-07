'use client';
import { useEffect, useState } from 'react';

export default function Timeline() {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetch('/api/timeline')
      .then((res) => res.json())
      .then(setHistory);
  }, []);

  return (
    <div className="max-w-3xl mx-auto p-6 text-white">
      <h1 className="text-3xl font-bold mb-6 text-center">📈 Network Timeline</h1>
      <ul className="space-y-3 text-sm">
        {history.map((event, i) => (
          <li key={i} className="border-l-2 border-blue-500 pl-3">
            <div className="text-zinc-300">{event.date}</div>
            <div className="text-white">{event.description}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
