// app/personas/page.tsx
//
// Public showcase of AI-persona About-Me sites — the HiveJournal Personas × QuickSites automation
// test. Lists only APPROVED (published) persona sites (claim_source='persona_build'), each a real
// block-built page. HARD RULE: the directory itself + every card is unmistakably labeled AI/fictional
// — these are HiveJournal characters, never real people.

import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import SiteHeader from '@/components/site/site-header';
import { marketingOg } from '@/lib/marketingOg';

export const dynamic = 'force-dynamic';

export const metadata = marketingOg({
  title: 'AI Persona sites — built by HiveJournal characters on QuickSites',
  description:
    'A showcase of “About Me” sites built by HiveJournal’s AI personas on QuickSites — an automation test of the agent-buildable site builder. Every persona is a fictional AI character, not a real person.',
  path: '/personas',
  ogEyebrow: 'AI Personas',
  ogTitle: 'Built by AI personas',
  ogSubtitle: 'Fictional HiveJournal characters, each with an About-Me site built on QuickSites.',
});

type PersonaSite = { slug: string; name: string; tagline: string; heroUrl: string | null; href: string };

async function loadPersonaSites(): Promise<PersonaSite[]> {
  try {
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
      { auth: { persistSession: false } },
    );
    const { data } = await db
      .from('templates')
      .select('slug, business_name, hero_url, data, domain, custom_domain')
      .eq('claim_source', 'persona_build')
      .eq('is_site', true)
      .eq('published', true)
      .order('updated_at', { ascending: false })
      .limit(60);

    return (data ?? [])
      .filter((r: any) => r?.data?.meta?.is_ai_persona)
      .map((r: any) => {
        const dom = r.custom_domain || r.domain;
        const href = dom
          ? `https://${String(dom).replace(/^https?:\/\//, '').replace(/\/$/, '')}`
          : `/sites/${r.slug}`;
        const hero = r.data?.pages?.[0]?.blocks?.[0];
        return {
          slug: r.slug,
          name: r.business_name || r.data?.meta?.business_name || 'AI Persona',
          tagline: String(r.data?.meta?.about || hero?.content?.subheadline || '').slice(0, 140),
          heroUrl: r.hero_url || null,
          href,
        };
      });
  } catch {
    return [];
  }
}

export default async function PersonasShowcasePage() {
  const sites = await loadPersonaSites();

  return (
    <>
      <SiteHeader sticky />
      <main className="min-h-screen bg-zinc-950 text-white">
        <section className="mx-auto max-w-4xl px-6 pt-14 pb-6 text-center">
          <span className="rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 px-3 py-1 text-xs font-medium text-fuchsia-300">
            🤖 AI Personas — fictional characters
          </span>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight md:text-5xl">Built by AI personas</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-400">
            “About Me” sites built by <span className="text-zinc-200">HiveJournal’s AI personas</span> on
            QuickSites — an automation test of an agent-buildable site builder. Every persona below is a{' '}
            <span className="font-semibold text-fuchsia-300">fictional AI character, not a real person.</span>
          </p>
        </section>

        <section className="mx-auto max-w-5xl px-6 pb-16">
          {sites.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 text-center text-zinc-400">
              No persona sites published yet — the pilot is warming up. Check back soon.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sites.map((s) => (
                <Link
                  key={s.slug}
                  href={s.href}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 transition hover:border-fuchsia-500/40 hover:bg-zinc-900/70"
                >
                  {s.heroUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.heroUrl} alt={s.name} className="h-40 w-full object-cover" />
                  ) : (
                    <div className="flex h-40 w-full items-center justify-center bg-zinc-800 text-4xl" aria-hidden>🤖</div>
                  )}
                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-white">{s.name}</h2>
                      <span className="rounded-full bg-fuchsia-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fuchsia-300">AI</span>
                    </div>
                    {s.tagline && <p className="mt-1 flex-1 text-sm text-zinc-400">{s.tagline}</p>}
                    <span className="mt-3 text-sm font-semibold text-fuchsia-400 group-hover:text-fuchsia-300">Visit the site →</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
          <p className="mt-8 text-center text-xs text-zinc-600">
            These are AI-generated pages for fictional characters, published as a QuickSites × HiveJournal
            experiment. No real individuals are represented.
          </p>
        </section>
      </main>
    </>
  );
}
