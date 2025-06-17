'use client';
import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function TokenManager() {
  const supabase = createClientComponentClient();
  const [tokens, setTokens] = useState<any[]>([]);
  const [fileName, setFileName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const loadTokens = async () => {
    const { data } = await supabase
      .from('report_tokens')
      .select('*')
      .order('expires_at', { ascending: false })
      .limit(20);
    setTokens(data || []);
  };

  useEffect(() => {
    loadTokens();
  }, []);

  const createToken = async () => {
    const raw = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const hash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(raw)
    );
    const tokenHash = Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    await supabase.from('report_tokens').insert({
      file_name: fileName,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    alert(
      `✅ Token created! Link: /api/reports/download?file=${fileName}&token=${raw}`
    );
    setFileName('');
    setExpiresAt('');
    loadTokens();
  };

  return (
    <div className="p-6 text-text max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">🔐 Report Access Tokens</h1>

      <div className="space-y-2">
        <label className="block text-sm">
          File Name (e.g. summary_2025-06-05.pdf)
        </label>
        <input
          type="text"
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          className="w-full px-2 py-1 rounded bg-zinc-900 border border-zinc-700"
        />

        <label className="block text-sm mt-2">Expires At</label>
        <input
          type="datetime-local"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className="w-full px-2 py-1 rounded bg-zinc-900 border border-zinc-700"
        />

        <button
          onClick={createToken}
          className="mt-3 px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
        >
          Generate Token
        </button>
      </div>

      <div className="pt-6">
        <h2 className="font-semibold mb-2">🧾 Recent Tokens</h2>
        <ul className="text-sm bg-zinc-900 rounded p-4 space-y-2">
          {tokens.map((t, i) => (
            <li key={i} className="flex justify-between">
              <span>{t.file_name}</span>
              <span className="text-zinc-400">
                {new Date(t.expires_at).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
