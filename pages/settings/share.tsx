'use client';
import { useEffect, useState } from 'react';
import { json } from '@/lib/api/json';
import { useUser, useSession } from '@supabase/auth-helpers-react';

export default function ShareSettings() {
  const user = useUser();
  const session = useSession();
  const accessToken = session?.access_token;

  const [profile, setProfile] = useState<any>(null);
  const [bio, setBio] = useState('');
  const [emoji, setEmoji] = useState('🌱');
  const [tags, setTags] = useState('');
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>(
    'idle'
  );

  useEffect(() => {
    if (!user) return;
    fetch('/api/public-profile?handle=' + user.user_metadata.handle)
      .then((res) => json())
      .then((data) => {
        setProfile(data);
        setBio(data.bio || '');
        setEmoji(data.emoji || '🌱');
        setTags((data.goal_tags || []).join(', '));
        setVisible(data.visible);
      });
  }, [user]);

  const handleSave = async () => {
    if (!accessToken || !user) return;
    setStatus('saving');
    const res = await fetch('/api/update-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        bio,
        emoji,
        visible,
        goal_tags: tags.split(',').map((t) => t.trim()),
        handle: user.user_metadata.handle,
      }),
    });
    setStatus(res.ok ? 'done' : 'error');
  };

  return (
    <div className="p-6 text-white max-w-xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">📡 Share My World</h1>
      <p className="text-zinc-400 text-sm">
        This page controls what others can see at /world/[handle]/share
      </p>

      <div>
        <label className="block text-sm mb-1">Emoji</label>
        <input
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          className="text-black w-full p-1 rounded"
        />
      </div>

      <div>
        <label className="block text-sm mb-1">Short Bio</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={2}
          className="text-black w-full p-1 rounded"
        />
      </div>

      <div>
        <label className="block text-sm mb-1">
          Goal Tags (comma separated)
        </label>
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className="text-black w-full p-1 rounded"
        />
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={visible}
          onChange={() => setVisible(!visible)}
        />
        <label>Make my page public</label>
      </div>

      <button
        onClick={handleSave}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
      >
        {status === 'saving' ? 'Saving...' : 'Save Changes'}
      </button>
      {status === 'done' && (
        <p className="text-green-400 text-sm">✅ Updated</p>
      )}
      {status === 'error' && (
        <p className="text-red-500 text-sm">⚠️ Something went wrong</p>
      )}
    </div>
  );
}
