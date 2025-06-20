'use client';
import { NextSeo } from 'next-seo';
import { json } from '@/lib/api/json';
import { usePageSeo } from '@/lib/usePageSeo';
import { useEffect, useState } from 'react';

export default function HallOfFame() {
  const seo = usePageSeo({
    description: 'Hall of fame page.',
  });

  const [entries, setEntries] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/hall-of-fame')
      .then((res) => json())
      .then(setEntries);
  }, []);

  return (
    <>
      <NextSeo {...seo} />
      <div className="max-w-4xl mx-auto p-6 text-white">
        <h1 className="text-3xl font-bold mb-6 text-center">🏅 Hall of Fame</h1>
        <p className="text-center text-zinc-400 mb-8 text-sm">
          Celebrating those who grew the network with care and courage.
        </p>

        <table className="w-full text-sm text-zinc-200">
          <thead className="text-xs uppercase text-zinc-400 border-b border-zinc-700">
            <tr>
              <th className="text-left p-2">Name / Alias</th>
              <th className="text-right p-2">Claims</th>
              <th className="text-right p-2">Referrals</th>
              <th className="text-right p-2 font-bold">Impact</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-zinc-900' : 'bg-zinc-800'}>
                <td className="p-2">{entry.alias || '🕶 Anonymous'}</td>
                <td className="p-2 text-right">{entry.claims}</td>
                <td className="p-2 text-right">{entry.referrals}</td>
                <td className="p-2 text-right font-bold">{entry.claims + entry.referrals}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
