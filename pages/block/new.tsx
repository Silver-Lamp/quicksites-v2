'use client';
import { useState, useEffect } from 'react';

export default function NewBlockPage() {
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [emoji, setEmoji] = useState('🧠');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition((pos) => {
      setLat(pos.coords.latitude);
      setLon(pos.coords.longitude);
    });
  }, []);

  const handleSubmit = async () => {
    if (!lat || !lon) return;
    setSaving(true);
    const res = await fetch('/api/create-block', {
      method: 'POST',
      body: JSON.stringify({
        lat, lon, title, message, emoji
      })
    });
    setSaving(false);
    if (res.ok) setDone(true);
  };

  return (
    <div className="max-w-md mx-auto p-6 text-white">
      <h1 className="text-2xl font-bold mb-4">📍 Create New Block</h1>
      {done ? (
        <p className="text-green-400">✅ Block saved! Visit /world/[you] to see it in action.</p>
      ) : (
        <>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full p-2 mb-3 rounded bg-zinc-800"
          />
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Your message"
            rows={3}
            className="w-full p-2 mb-3 rounded bg-zinc-800"
          />
          <input
            value={emoji}
            onChange={e => setEmoji(e.target.value)}
            className="w-full p-2 mb-4 rounded bg-zinc-800"
            placeholder="Emoji"
          />
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded w-full"
          >
            {saving ? 'Saving...' : 'Pin Block'}
          </button>
        </>
      )}
    </div>
  );
}
