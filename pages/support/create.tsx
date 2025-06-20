'use client';
import { useState } from 'react';
import { json } from '@/lib/api/json';

export default function PublicCampaignCreate() {
  const [slug, setSlug] = useState('');
  const [headline, setHeadline] = useState('');
  const [goal, setGoal] = useState(10);
  const [action, setAction] = useState('cheer');
  const [blockId, setBlockId] = useState('');
  const [submitted, setSubmitted] = useState('');

  const submit = async () => {
    const res = await fetch('/api/create-campaign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        slug,
        headline,
        goal_count: goal,
        target_action: action,
        blockId,
      }),
    });

    const json = await json();
    setSubmitted(json.error ? 'Error: ' + json.error : '✅ Campaign created!');
  };

  return (
    <div className="max-w-xl mx-auto p-6 text-white space-y-4">
      <h1 className="text-2xl font-bold">📣 Launch a Campaign</h1>
      <p className="text-sm text-zinc-400">
        Create a public support goal around a habit or mission.
      </p>
      <input
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        placeholder="Slug (e.g. floss)"
        className="p-2 text-black w-full rounded"
      />
      <input
        value={headline}
        onChange={(e) => setHeadline(e.target.value)}
        placeholder="Headline"
        className="p-2 text-black w-full rounded"
      />
      <input
        type="number"
        value={goal}
        onChange={(e) => setGoal(Number(e.target.value))}
        className="p-2 text-black w-full rounded"
      />
      <select
        value={action}
        onChange={(e) => setAction(e.target.value)}
        className="p-2 text-black w-full rounded"
      >
        <option value="cheer">🎉 Cheer</option>
        <option value="echo">🔁 Echo</option>
        <option value="reflect">🪞 Reflect</option>
        <option value="checkin">✅ Check-in</option>
      </select>
      <input
        value={blockId}
        onChange={(e) => setBlockId(e.target.value)}
        placeholder="Block ID (optional)"
        className="p-2 text-black w-full rounded"
      />
      <button onClick={submit} className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded">
        Create Campaign
      </button>
      {submitted && <p className="text-green-300 text-sm">{submitted}</p>}
    </div>
  );
}
