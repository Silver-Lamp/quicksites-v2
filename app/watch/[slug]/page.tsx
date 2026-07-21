// app/watch/[slug]/page.tsx
//
// The Talking Demo "watch" page — the outreach destination a no-website prospect scans from a
// postcard/QR: "here's the website we built you." Phone-first: the auto-generated reel (the site
// narrating + scrolling through itself) + a button into the full, claimable site. noindex.
//
// Reads the reel from templates.data.meta.talking_demo (persisted by /api/admin/talking-demo/save).

import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } },
  );
}

async function load(slug: string) {
  const { data } = await db()
    .from('templates')
    .select('slug, business_name, template_name, data')
    .eq('slug', slug)
    .maybeSingle();
  if (!data) return null;
  const name = (data as any).business_name || (data as any).template_name || 'your business';
  const td = (data as any)?.data?.meta?.talking_demo ?? null;
  return { name, td };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const r = await load(slug);
  return {
    title: r ? `${r.name} — your new website` : 'Your new website',
    description: 'Press play to see the website we built — it walks you through itself.',
    robots: { index: false, follow: false },
  };
}

export default async function WatchPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await load(slug);

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-950 to-black text-zinc-100">
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-300">
            🔊 We built you a website
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">
            {r?.name ?? 'Your business'}
          </h1>
          <p className="mt-2 text-sm text-zinc-400">Press play — it walks you through itself in about a minute.</p>
        </div>

        {r?.td?.mp4_url ? (
          <div className="mt-6 overflow-hidden rounded-2xl border border-emerald-500/30 bg-black shadow-2xl">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video src={r.td.mp4_url} poster={r.td.poster_url || undefined} controls playsInline className="w-full" />
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-center text-sm text-zinc-400">
            Your website preview is being prepared. Tap below to see it.
          </div>
        )}

        <div className="mt-7 space-y-3">
          <Link
            href={`/sites/${slug}`}
            className="block rounded-xl bg-emerald-500 px-6 py-3.5 text-center text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
          >
            See the full website →
          </Link>
          <Link
            href={`/sites/${slug}`}
            className="block rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-6 py-3.5 text-center text-sm font-semibold text-emerald-300 transition hover:border-emerald-400 hover:bg-emerald-500/20"
          >
            This is mine — claim it
          </Link>
        </div>

        <p className="mt-8 text-center text-xs text-zinc-600">
          Built for you with QuickSites. No cost to look — the site is ready when you are.
        </p>
      </div>
    </main>
  );
}
