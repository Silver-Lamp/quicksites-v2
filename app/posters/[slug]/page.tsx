// app/posters/[slug]/page.tsx

import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function Page({ params }: { params: { slug: string } }) {
  const { slug } = params;

  const { data: campaign, error } = await supabase
    .from('support_campaigns')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!campaign || error) {
    return <p className="p-6 text-red-600">Campaign not found</p>;
  }

  const posterUrl = `/api/posters/${slug}`; // your dynamic PNG poster route

  return (
    <div className="min-h-screen bg-white text-black p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">{campaign.headline}</h1>
        <p className="text-zinc-700">{campaign.description}</p>

        <div className="border rounded overflow-hidden shadow">
          <img
            src={posterUrl}
            alt={`Poster for ${slug}`}
            className="w-full object-contain"
          />
        </div>

        <div className="text-right text-sm text-zinc-500">
          Generated dynamically for: <code>{slug}</code>
        </div>
      </div>
    </div>
  );
}
