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

      <div className="mt-6 space-y-3" style={{ border: '1px solid #222' }}>
        {blocks.map((b: any) => (
          <div key={b.id} className="flex flex-col gap-3" style={{ border: '1px solid #222' }}>
          <div key={b.id} className="bg-zinc-800 p-4 rounded">
            <div className="text-lg">{b.emoji} {b.title}</div>
            <div className="text-sm text-zinc-400">{b.message}</div>
            <div className="flex gap-3 text-xs text-zinc-400 mt-2">
              {b.cheer_count > 0 && <span>🎉 {b.cheer_count}</span>}
              {b.echo_count > 0 && <span>🔁 {b.echo_count}</span>}
              {b.reflect_count > 0 && <span>🪞 {b.reflect_count}</span>}
            </div>
          </div>
          <div className="mt-3 flex gap-2 text-sm">
            <button
              className="bg-green-700 hover:bg-green-800 text-white px-3 py-1 rounded"
              onClick={async () => {
                await fetch('/api/cheer', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${user?.access_token}`
                  },
                  body: JSON.stringify({ block_id: b.id })
                });
                alert('🎉 Sent cheer!');
              }}
            >
              🎉 Cheer
            </button>
            <button
              className="bg-blue-700 hover:bg-blue-800 text-white px-3 py-1 rounded"
              onClick={async () => {
                await fetch('/api/echo', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${user?.access_token}`
                  },
                  body: JSON.stringify({ block_id: b.id })
                });
                alert('🔁 Echoed!');
              }}
            >
              🔁 Echo
            </button>
            <button
              className="bg-purple-700 hover:bg-purple-800 text-white px-3 py-1 rounded"
              onClick={async () => {
                const message = prompt('What reflection would you like to send?');
                if (!message) return;
                await fetch('/api/reflect', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${user?.access_token}`
                  },
                  body: JSON.stringify({ block_id: b.id, message })
                });
                alert('🪞 Reflection sent');
              }}
            >
              🪞 Reflect
            </button>
          </div>
          </div>
          ))}
      </div>
    </div>
  );
}
