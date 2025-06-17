import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function NewSitePage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [form, setForm] = useState({
    snapshot_id: '',
    branding_profile_id: '',
    slug: '',
  });

  useEffect(() => {
    supabase
      .from('branding_profiles')
      .select('id, name')
      .then(({ data }) => setProfiles(data || []));
    supabase
      .from('snapshots')
      .select('id, template_name')
      .then(({ data }) => setSnapshots(data || []));
  }, []);

  const publish = async () => {
    const { error } = await supabase.from('published_sites').insert([
      {
        ...form,
        status: 'published',
        published_at: new Date().toISOString(),
      },
    ]);
    if (!error) router.push('/admin/sites');
  };

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-bold">Publish New Site</h1>

      <label className="block text-sm font-medium">Slug</label>
      <input
        className="border px-2 py-1 w-full rounded"
        placeholder="e.g. towing-pro"
        value={form.slug}
        onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
      />

      <label className="block text-sm font-medium">Snapshot</label>
      <select
        className="w-full border rounded px-2 py-1"
        onChange={(e) =>
          setForm((f) => ({ ...f, snapshot_id: e.target.value }))
        }
      >
        <option value="">Select snapshot</option>
        {snapshots.map((s) => (
          <option key={s.id} value={s.id}>
            {s.template_name}
          </option>
        ))}
      </select>

      <label className="block text-sm font-medium">Branding Profile</label>
      <select
        className="w-full border rounded px-2 py-1"
        onChange={(e) =>
          setForm((f) => ({ ...f, branding_profile_id: e.target.value }))
        }
      >
        <option value="">Select profile</option>
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <button
        onClick={publish}
        className="bg-black text-white px-4 py-2 rounded mt-4"
      >
        Publish
      </button>
    </div>
  );
}
