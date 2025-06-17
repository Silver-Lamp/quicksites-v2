'use client';
import { useEffect, useState } from 'react';
import { json } from '@/lib/api/json';

export default function HabitLibrary() {
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    fetch('/api/habit-templates')
      .then((res) => json())
      .then(setTemplates);
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-6 text-white">
      <h1 className="text-2xl font-bold mb-4">📚 Habit Library</h1>
      <ul className="space-y-4">
        {templates.map((t: any) => (
          <li key={t.slug} className="bg-zinc-800 rounded p-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-lg font-semibold">
                  {t.emoji} {t.title}
                </div>
                <div className="text-sm text-zinc-400">{t.message}</div>
              </div>
              <a
                href={`/habits/add?slug=${t.slug}`}
                className="text-sm px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white"
              >
                ➕ Add
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
