import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const defaultLayout = [
  { type: 'hero', active: true },
  { type: 'features', active: true },
  { type: 'testimonials', active: true },
  { type: 'cta', active: true }
];

export default function OGLayoutEditor() {
  const router = useRouter();
  const { id } = router.query;
  const [layout, setLayout] = useState(defaultLayout);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (!id || typeof id !== 'string') return;

    supabase
      .from('branding_profiles')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data?.layout) setLayout(data.layout);
        setProfile(data);
      });
  }, [id]);

  const toggleBlock = (type: string) => {
    setLayout(layout.map(b => b.type === type ? { ...b, active: !b.active } : b));
  };

  const saveLayout = async () => {
    await supabase.from('branding_profiles').update({ layout }).eq('id', id);
    alert('Layout saved!');
  };

  const previewURL = `/api/og/snapshot?snapshotId=${id}`;

  return (
    <div className="min-h-screen bg-gray-900 text-white px-6 py-10">
      <div className="max-w-xl mx-auto bg-gray-800 p-6 rounded-lg shadow space-y-6">
        <h1 className="text-xl font-bold mb-4">OG Layout Editor: {profile?.name}</h1>

        {layout.map((block, index) => (
          <label key={index} className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              className="accent-blue-500"
              checked={block.active}
              onChange={() => toggleBlock(block.type)}
            />
            <span className="capitalize">{block.type}</span>
          </label>
        ))}

        <button
          onClick={saveLayout}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded"
        >
          Save Layout
        </button>

        <div className="pt-6">
          <p className="text-sm text-muted-foreground mb-1">OG Preview:</p>
          <img src={previewURL} alt="Preview" className="rounded border border-gray-700" />
        </div>
      </div>
    </div>
  );
}
