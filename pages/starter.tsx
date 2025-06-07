'use client';
import { useState } from 'react';
import { useRouter } from 'next/router';

export default function StarterPage() {
  const router = useRouter();
  const [bizName, setBizName] = useState('');
  const [location, setLocation] = useState('');
  const [vibe, setVibe] = useState('clean');
  const [template, setTemplate] = useState(null);
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);

  const suggest = async () => {
    setLoading(true);
    const safeSlug = bizName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const suggested = {
      template: vibe === 'bold' ? 'template-dark' : vibe === 'warm' ? 'template-warm' : 'template-clean',
      domain: `${safeSlug}${location ? '-' + location.toLowerCase().split(',')[0].replace(/[^a-z]/g, '') : ''}.com`
    };
    setTemplate(suggested.template);
    setDomain(suggested.domain);
    setLoading(false);
  };

  const claimIt = () => router.push(`/claim/${domain}`);

  return (
    <div className="max-w-xl mx-auto text-white p-6">
      <h1 className="text-3xl font-bold mb-6 text-center">✨ Create Your QuickSite</h1>

      <input
        placeholder="Business name"
        value={bizName}
        onChange={(e) => setBizName(e.target.value)}
        className="w-full mb-3 p-2 rounded bg-zinc-800 text-white"
      />
      <input
        placeholder="Location (optional)"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        className="w-full mb-3 p-2 rounded bg-zinc-800 text-white"
      />
      <select
        value={vibe}
        onChange={(e) => setVibe(e.target.value)}
        className="w-full mb-4 p-2 rounded bg-zinc-800 text-white"
      >
        <option value="clean">🧼 Clean</option>
        <option value="bold">🦍 Bold</option>
        <option value="warm">🌅 Warm</option>
      </select>

      <button
        onClick={suggest}
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white w-full"
      >
        {loading ? 'Suggesting...' : 'Suggest Template + Domain'}
      </button>

      {template && domain && (
        <div className="mt-6 text-center">
          <p className="text-lg">🎨 <strong>{template}</strong></p>
          <p className="text-blue-400 text-sm">{domain}</p>
          <button
            onClick={claimIt}
            className="mt-3 bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-white"
          >
            Claim This Site →
          </button>
        </div>
      )}
    </div>
  );
}
