'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { json } from '@/lib/api/json';
import { useEffect, useState } from 'react';

type Badge = {
  icon: string;
  title: string;
};

type HandleProfile = {
  avatar?: string;
  bio?: string;
  badge?: Badge;
};

export default function PublicHandlePage() {
  const searchParams = useSearchParams();
  const handle = searchParams?.get('handle') as string;
  const [data, setData] = useState<HandleProfile | null>(null);

  useEffect(() => {
    if (!handle) return;
    fetch(`/api/handle-profile?handle=${handle}`)
      .then((res) => res.json())
      .then(setData)
      .catch((err) => {
        console.error('Failed to fetch handle profile:', err);
        setData(null);
      });
  }, [handle]);

  if (!data) {
    return <div className="text-white p-6">Loading profile…</div>;
  }

  return (
    <div className="text-white p-6 text-center max-w-2xl mx-auto">
      {data.avatar && (
        <img src={data.avatar} alt="avatar" className="w-20 h-20 rounded-full mx-auto mb-4" />
      )}
      <h1 className="text-2xl font-bold">@{handle}</h1>
      {data.badge && (
        <p className="text-yellow-400">
          {data.badge.icon} {data.badge.title}
        </p>
      )}
      {data.bio && <p className="text-zinc-400 mt-2">{data.bio}</p>}
    </div>
  );
}
