'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function PublicWorldShare() {
  const router = useRouter();
  const { handle } = router.query;
  const [profile, setProfile] = useState<any>(null);
  const [blocks, setBlocks] = useState([]);

  useEffect(() => {
    if (!handle) return;
    fetch('/api/public-profile?handle=' + handle)
      .then(res => res.json())
      .then(setProfile);

    fetch('/api/blocks-by-handle?handle=' + handle)
      .then(res => res.json())
      .then(setBlocks);
  }, [handle]);

  if (!profile) return <div className="p-6 text-white">Loading...</div>;
  if (!profile.visible) return <div className="p-6 text-white">🌒 This page is private.</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto text-white space-y-6">
      <h1 className="text-3xl font-bold">{profile.emoji} @{handle}</h1>
      {profile.bio && <p className="text-zinc-400">{profile.bio}</p>}
      {profile.goal_tags?.length > 0 && (
        <div className="text-xs text-green-400 uppercase tracking-wider">
          {profile.goal_tags.join(' • ')}
        </div>
      )}

      <div className="mt-6 space-y-3">
        {blocks.map((b: any) => (
          <div key={b.id} className="bg-zinc-800 p-4 rounded">
            <div className="text-lg">{b.emoji} {b.title}</div>
            <div className="text-sm text-zinc-400">{b.message}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
