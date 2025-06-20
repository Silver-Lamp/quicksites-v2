'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../admin/lib/supabaseClient';
import { useRouter } from 'next/router';

export default function DraftsPage() {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchDrafts = async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('status', 'draft')
        .order('created_at', { ascending: false });

      if (!error) setDrafts(data || []);
      setLoading(false);
    };

    fetchDrafts();
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto text-white">
      <h1 className="text-2xl font-bold mb-6">📝 Draft Campaigns</h1>

      {loading ? (
        <p className="text-sm text-zinc-400">Loading drafts...</p>
      ) : drafts.length === 0 ? (
        <p className="text-sm text-zinc-500">No drafts found.</p>
      ) : (
        <ul className="space-y-4">
          {drafts.map((d) => (
            <li key={d.id} className="border border-zinc-700 rounded p-4 bg-zinc-900">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-lg font-semibold">{d.name}</p>
                  <p className="text-sm text-zinc-400">
                    {d.city}, {d.state} — {d.lead_ids?.length} leads
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => router.push(`/admin/start-campaign?draftId=${d.id}`)}
                    className="text-sm text-blue-400 hover:underline"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={async () => {
                      const confirm = window.confirm('Delete this draft?');
                      if (!confirm) return;
                      await supabase.from('campaigns').delete().eq('id', d.id);
                      setDrafts((prev) => prev.filter((x) => x.id !== d.id));
                    }}
                    className="text-sm text-red-400 hover:underline"
                  >
                    🗑 Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
