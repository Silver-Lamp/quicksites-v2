// app/admin/candidate/[slug]/edit/page.tsx
import { getServerSupabase } from '@/lib/supabase/server';
import BlocksEditor from '@/components/admin/candidate/BlocksEditor';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function CandidateEditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await getServerSupabase({ serviceRole: true });

  const { data, error } = await supabase
    .from('candidate_pages')
    .select('blocks, allow_text, allow_email, is_paid, enable_donations, enable_events, enable_newsletter, enable_endorsements, enable_volunteer')
    .eq('slug', slug)
    .maybeSingle();

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl p-6 mt-20">
        <div className="mb-4">
          <Link href="/admin/short-links" className="text-sm text-indigo-500 hover:underline">← Back to Short Links</Link>
        </div>
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm">
          Could not load candidate page for <strong>{slug}</strong>.
        </div>
      </div>
    );
  }

  // Pretty print JSON for the editor
  let pretty = '';
  try {
    const raw = typeof data.blocks === 'string' ? JSON.parse(data.blocks) : data.blocks;
    pretty = JSON.stringify(raw?.blocks ?? raw ?? [], null, 2);
  } catch {
    pretty = typeof data.blocks === 'string' ? data.blocks : JSON.stringify(data.blocks ?? [], null, 2);
  }

  return (
    <div className="mx-auto max-w-5xl p-6 mt-20">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/admin/short-links" className="text-sm text-indigo-500 hover:underline">← Back to Short Links</Link>
        <a href={`/candidate/${slug}`} target="_blank" className="text-sm text-gray-400 hover:underline">View public page ↗</a>
      </div>
      <h1 className="text-2xl font-semibold">Edit: {slug}</h1>
      <p className="mt-1 text-sm text-gray-500">This editor saves directly to <code>public.candidate_pages.blocks</code>.</p>

      <div className="mt-6">
        <BlocksEditor
          slug={slug}
          initialBlocksJson={pretty}
          initialFlags={{
            is_paid: !!data.is_paid,
            allow_text: !!data.allow_text,
            allow_email: !!data.allow_email,
            enable_donations: !!data.enable_donations,
            enable_events: !!data.enable_events,
            enable_newsletter: !!data.enable_newsletter,
            enable_endorsements: !!data.enable_endorsements,
            enable_volunteer: !!data.enable_volunteer,
          }}
        />
      </div>
    </div>
  );
}
