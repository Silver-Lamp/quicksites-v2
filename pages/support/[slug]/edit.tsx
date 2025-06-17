'use client';
import { useEffect, useState } from 'react';
import { json } from '@/lib/api/json';
import { useRouter } from 'next/router';

export default function EditCampaign() {
  const { query } = useRouter();
  const [data, setData] = useState<any>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!query.slug) return;
    fetch('/api/campaign?slug=' + query.slug)
      .then((res) => json())
      .then(setData);
  }, [query.slug]);

  const submit = async () => {
    const res = await fetch('/api/update-campaign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await json();
    setMessage(json.error ? 'Error: ' + json.error : '✅ Updated!');
  };

  if (!data) return <div className="p-6 text-white">Loading...</div>;

  return (
    <div className="max-w-xl mx-auto p-6 text-white space-y-4">
      <h1 className="text-2xl font-bold">✏️ Edit Campaign</h1>
      <input
        value={data.headline}
        onChange={(e) => setData({ ...data, headline: e.target.value })}
        className="w-full p-2 text-black rounded"
      />
      <input
        type="number"
        value={data.goal_count}
        onChange={(e) =>
          setData({ ...data, goal_count: parseInt(e.target.value) })
        }
        className="w-full p-2 text-black rounded"
      />
      <select
        value={data.target_action}
        onChange={(e) => setData({ ...data, target_action: e.target.value })}
        className="w-full p-2 text-black rounded"
      >
        <option value="cheer">🎉 Cheer</option>
        <option value="echo">🔁 Echo</option>
        <option value="reflect">🪞 Reflect</option>
        <option value="checkin">✅ Check-in</option>
      </select>
      <input
        value={data.block_id}
        onChange={(e) => setData({ ...data, block_id: e.target.value })}
        className="w-full p-2 text-black rounded"
      />
      <button
        onClick={submit}
        className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded"
      >
        Save
      </button>
      {message && <p className="text-green-300 text-sm">{message}</p>}
    </div>
  );
}
