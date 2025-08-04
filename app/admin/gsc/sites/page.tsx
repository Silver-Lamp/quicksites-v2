'use client';

import { useEffect, useState } from 'react';

type TokenRecord = {
  id: string;
  domain: string;
  user_id: string | null;
  expiry: string | null;
  created_at: string;
};

export default function ManageGscSitesPage() {
  const [tokens, setTokens] = useState<TokenRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/gsc/tokens')
      .then((res) => res.json())
      .then((data) => {
        setTokens(data ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="p-6 text-white">
      <h1 className="text-xl font-semibold mb-4">Connected GSC Sites</h1>
      {loading ? (
        <p className="opacity-60">Loading...</p>
      ) : tokens.length === 0 ? (
        <p className="opacity-60">No connected sites found.</p>
      ) : (
        <table className="w-full text-sm table-auto border-collapse">
          <thead className="text-left text-white/60 border-b border-white/10">
            <tr>
              <th className="py-2 pr-4">Domain</th>
              <th className="py-2 pr-4">User ID</th>
              <th className="py-2 pr-4">Expires</th>
              <th className="py-2 pr-4">Created</th>
              <th className="py-2 pr-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tokens.map((t) => (
                <tr key={t.id} className="border-b border-white/10">
                <td className="py-2 pr-4">{t.domain}</td>
                <td className="py-2 pr-4">{t.user_id || '—'}</td>
                <td className="py-2 pr-4">{t.expiry?.split('.')[0] || '—'}</td>
                <td className="py-2 pr-4">{t.created_at.split('.')[0]}</td>
                <td className="py-2 pr-4">
                    <button
                    onClick={async () => {
                        const confirmed = confirm(`Revoke access for ${t.domain}?`);
                        if (!confirmed) return;

                        const res = await fetch(`/api/gsc/tokens/${t.id}`, { method: 'DELETE' });
                        if (res.ok) {
                        setTokens((prev) => prev.filter((x) => x.id !== t.id));
                        } else {
                        alert('Failed to revoke token');
                        }
                    }}
                    className="text-red-400 hover:underline text-xs"
                    >
                    Revoke
                    </button>
                </td>
                </tr>
            ))}
        </tbody>

        </table>
      )}
    </div>
  );
}
