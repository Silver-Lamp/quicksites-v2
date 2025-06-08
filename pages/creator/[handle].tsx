'use client';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function PublicHandlePage() {
  const router = useRouter();
  const { handle } = router.query;
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!handle) return;
    fetch('/api/handle-profile?handle=' + handle)
      .then(res => res.json())
      .then(setData);
  }, [handle]);

  if (!data) return <div className="text-white p-6">Loading...</div>;

  return (
    <div className="text-white p-6 text-center max-w-2xl mx-auto">
      <img src={data.avatar} alt="avatar" className="w-20 h-20 rounded-full mx-auto mb-4" />
      <h1 className="text-2xl font-bold">@{handle}</h1>
      {data.badge && (
        <p className="text-yellow-400">{data.badge.icon} {data.badge.title}</p>
      )}
      <p className="text-zinc-400 mt-2">{data.bio}</p>
    </div>
  );
}
