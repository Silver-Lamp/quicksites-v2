'use client';
import { useEffect, useState } from 'react';
import { json } from '@/lib/api/json';
import Link from 'next/link';
import { useUser } from '@supabase/auth-helpers-react';

export default function MyCampaigns() {
  const user = useUser();
  const [campaigns, setCampaigns] = useState([]);

  useEffect(() => {
    if (!user) return;
    fetch('/api/my-campaigns?user_id=' + user.id)
      .then((res) => json())
      .then(setCampaigns);
  }, [user]);

  return (
    <div className="max-w-2xl mx-auto p-6 text-white space-y-6">
      <h1 className="text-2xl font-bold">🎯 My Campaigns</h1>
      <ul className="space-y-4">
        {campaigns.map((c: any) => (
          <li key={c.slug} className="bg-zinc-800 p-4 rounded">
            <Link
              href={`/support/${c.slug}`}
              className="text-blue-400 text-lg font-semibold hover:underline"
            >
              {c.headline}
            </Link>
            <p className="text-sm text-zinc-400">
              {c.goal_count} {c.target_action}s goal • Created{' '}
              {new Date(c.created_at).toLocaleDateString()}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
