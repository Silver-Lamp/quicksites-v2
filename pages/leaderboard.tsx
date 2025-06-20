'use client';
import { NextSeo } from 'next-seo';
import { json } from '@/lib/api/json';
import { usePageSeo } from '@/lib/usePageSeo';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function WeeklyLeaderboard() {
  const [campaigns, setCampaigns] = useState([]);

  useEffect(() => {
    fetch('/api/weekly-leaderboard')
      .then((res) => json())
      .then(setCampaigns);
  }, []);

  return (
    <>
      <NextSeo
        {...usePageSeo({
          description: 'Leaderboard page.',
        })}
      />
      <div className="max-w-3xl mx-auto p-6 text-white">
        <h1 className="text-3xl font-bold mb-6">🏆 Weekly Leaderboard</h1>
        <p className="text-zinc-400 mb-4">
          Top 10 campaigns this week by cheers, check-ins, echoes, or reflections.
        </p>
        <ol className="space-y-4">
          {campaigns.map((c: any, i: number) => (
            <li key={c.slug} className="bg-zinc-800 rounded p-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                {i < 3 && (
                  <img
                    src={`/api/badge/${c.slug}`}
                    alt="badge"
                    className="w-12 h-12 rounded border border-zinc-700"
                  />
                )}
                <div>
                  <Link
                    href={`/support/${c.slug}`}
                    className="text-blue-400 font-semibold hover:underline"
                  >
                    {c.headline}
                  </Link>
                  <p className="text-xs text-zinc-400">{c.action.toUpperCase()}</p>
                </div>
              </div>
              <span className="text-xl font-bold text-green-400">{c.count}</span>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
