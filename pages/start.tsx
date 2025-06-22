'use client';
import { useEffect, useState } from 'react';
import { json } from '@/lib/api/json';
import { useRouter } from 'next/navigation';
import { useUser, useSession } from '@supabase/auth-helpers-react';

export default function StartPage() {
  const user = useUser();
  const session = useSession();
  const router = useRouter();

  const [templates, setTemplates] = useState([]);
  const [loc, setLoc] = useState<GeolocationCoordinates | null>(null);
  const [selected, setSelected] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setLoc(pos.coords),
      () => setLoc(null)
    );
    fetch('/api/habit-templates')
      .then((_res) => _res.json())
      .then(setTemplates);
  }, []);

  const handleAdd = async () => {
    if (!selected || !user || !session || !loc) return;
    setStatus('saving');

    const accessToken = session.access_token;

    const res = await fetch('/api/create-block', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        lat: loc.latitude,
        lon: loc.longitude,
        title: selected.charAt(0).toUpperCase() + selected.slice(1),
        message: `Tracking: ${selected}`,
        emoji: selected === 'floss' ? '🦷' : selected === 'water' ? '💧' : '🧘',
        slug: selected,
        type: 'tracking',
        actions: [{ label: 'Check In', type: 'check-in', target: selected }],
      }),
    });

    if (res.ok) {
      setStatus('done');
      router.push('/world/me');
    } else {
      setStatus('error');
    }
  };

  return (
    <div className="text-white p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">👋 Welcome to Your AR Habit Tracker</h1>
      <p className="text-zinc-400 mb-4">
        Choose a habit to start tracking, and we&apos;ll place it in your world:
      </p>
      <ul className="space-y-3">
        {templates.map((t: any) => (
          <li key={t.slug}>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="habit"
                value={t.slug}
                checked={selected === t.slug}
                onChange={() => setSelected(t.slug)}
                className="form-radio"
              />
              <span>
                {t.emoji} {t.title}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <button
        onClick={handleAdd}
        disabled={!selected || !loc || status === 'saving'}
        className="mt-6 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
      >
        {status === 'saving' ? 'Creating...' : '➕ Add to My World'}
      </button>
      {status === 'error' && (
        <p className="text-red-500 mt-4">Something went wrong. Please try again.</p>
      )}
    </div>
  );
}
