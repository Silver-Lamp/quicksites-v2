// app/evolve/[prospectId]/page.tsx
//
// "Evolve your site" — the pitch page for ONE restaurant that has a website and takes no online
// food orders: the offer in one line, why, what they likely pay today (provider's published
// pricing, labelled), their site beside the evolved one, the next step, and a feature matrix.
// Public URL, noindex, reached from the rep's row or the admin page; the prospect id is the only
// key. Requires a built draft — no draft, 404.
//
// Model: lib/evolve/evolve.ts (pure; copy held to the forbidden list by test). Frameability of
// their site is read from its response headers at render (lib/evolve/frameable.ts); a site that
// refuses framing gets a link card instead of a blank box.
//
// ⚠️ A draft with NO MENU gets no evolved frame and no "take it" button (UX review 2026-10-10:
// the generic scaffold was shown as "your menu, orderable"). The call is the only next step then.
// ⚠️ The framed draft carries ?exhibit=1 so its own claim bar and preview strip stay hidden —
// inside the frame they sold a different product at a different price.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SiteHeader from '@/components/site/site-header';
import SiteFooter from '@/components/site/site-footer';
import ScaledFrame from '@/components/evolve/scaled-frame';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { buildEvolveModel, draftHasMenu } from '@/lib/evolve/evolve';
import { isFrameable } from '@/lib/evolve/frameable';
import { publicBaseUrl } from '@/lib/outreach/competitionPoster';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const metadata: Metadata = {
  title: 'Evolve your site — QuickSites',
  robots: { index: false, follow: false },
};

type Row = {
  id: string;
  business_name: string | null;
  website: string | null;
  template_id: string | null;
  industry_key: string | null;
  ordering_platform: string | null;
  site_provider: string | null;
};

export default async function EvolvePage({ params, searchParams }: { params: Promise<{ prospectId: string }>; searchParams: Promise<{ ref?: string }> }) {
  const { prospectId } = await params;
  const { ref } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(prospectId)) notFound();
  const { data } = await supabaseAdmin
    .from('outreach_prospects')
    .select('id, business_name, website, template_id, industry_key, ordering_platform, site_provider')
    .eq('id', prospectId)
    .maybeSingle();
  const p = data as Row | null;
  if (!p || !p.website || !p.template_id || p.industry_key !== 'restaurant' || !(p.business_name ?? '').trim()) notFound();
  const { data: tpl } = await supabaseAdmin.from('templates').select('slug, data').eq('id', p.template_id).maybeSingle();
  const slug = (tpl as { slug: string | null } | null)?.slug ?? null;
  if (!slug) notFound();
  const hasMenu = draftHasMenu((tpl as { data?: unknown } | null)?.data);

  const base = publicBaseUrl();
  const frame = await isFrameable(p.website, base);
  const refCode = typeof ref === 'string' && /^[a-z0-9-]{2,40}$/i.test(ref) ? ref : null;
  const m = buildEvolveModel({
    prospectId: p.id,
    businessName: (p.business_name ?? '').trim(),
    website: p.website,
    slug,
    draftHasMenu: hasMenu,
    orderingPlatform: p.ordering_platform,
    siteProvider: p.site_provider,
    currentFrameable: frame.frameable,
    currentFrameUrl: frame.frameUrl,
    refCode,
    base,
    menuHost: process.env.NEXT_PUBLIC_MENU_BASE_DOMAIN || null,
  });
  const c = m.copy;

  return (
    <>
      {/* A one-restaurant page: no marketing nav (four exits above the fold, and "Book a demo"
          there would drop the rep's code). The page's own two buttons are the navigation. */}
      <SiteHeader sticky links={[]} />
      <main className="min-h-screen bg-zinc-950 text-white">
        {/* The offer, then why */}
        <section className="mx-auto max-w-4xl px-6 pb-6 pt-14">
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">{m.businessName}</span>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight md:text-5xl">{m.headline}</h1>
          <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-zinc-500">{c.whyTitle}</h2>
          <div className="mt-3 space-y-3 text-base leading-relaxed text-zinc-300">
            {m.why.map((para) => (
              <p key={para}>{para}</p>
            ))}
          </div>
        </section>

        {/* Paying today — only a figure when the provider publishes one we have sourced */}
        <section className="mx-auto max-w-4xl px-6 py-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">{m.payingTitle}</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">{m.paying}</p>
            {m.payingSources.length > 0 && (
              <p className="mt-2 text-xs text-zinc-600">
                Published pricing read from:{' '}
                {m.payingSources.map((s, i) => (
                  <span key={s.url}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-400">{s.label}</a>
                    {i < m.payingSources.length - 1 ? ', ' : '.'}
                  </span>
                ))}
              </p>
            )}
          </div>
        </section>

        {/* Side by side */}
        <section className="mx-auto max-w-6xl px-6 py-6">
          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-base font-semibold text-white">{c.nowTitle}</h2>
                <a href={m.currentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-300 hover:underline">{c.ctaOpenCurrent} →</a>
              </div>
              <p className="mt-1 text-xs text-zinc-500">{m.nowLine}</p>
              {m.currentFrameable ? (
                <ScaledFrame src={m.currentUrl} title={`${m.businessName} — current site`} className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900" />
              ) : (
                <div className="mt-3 flex h-[320px] w-full items-center justify-center rounded-lg border border-dashed border-zinc-700 p-6 text-center text-sm text-zinc-400">
                  {c.nowUnframeable}
                </div>
              )}
            </div>
            {m.hasMenu && m.evolvedFrameUrl && m.evolvedUrl ? (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.05] p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-base font-semibold text-white">{c.nextTitle}</h2>
                  <a href={m.evolvedUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-300 hover:underline">{c.ctaOpenEvolved} →</a>
                </div>
                <p className="mt-1 text-xs text-zinc-500">{c.nextNote}</p>
                <iframe
                  src={m.evolvedFrameUrl}
                  title={`${m.businessName} — evolved site`}
                  loading="lazy"
                  className="mt-3 h-[640px] w-full rounded-lg border border-emerald-500/30 bg-zinc-950"
                />
              </div>
            ) : (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.05] p-4">
                <h2 className="text-base font-semibold text-white">{c.nextNoMenuTitle}</h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-300">{c.nextNoMenu}</p>
                {/* A SAMPLE, labelled as one, so the owner can still see ordering work. */}
                {m.exampleFrameUrl && m.exampleUrl && (
                  <div className="mt-4 border-t border-emerald-500/20 pt-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="text-sm font-semibold text-white">{c.exampleTitle}</h3>
                      <a href={m.exampleUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-300 hover:underline">{c.ctaOpenExample} →</a>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">{c.exampleNote(m.exampleName)}</p>
                    <iframe
                      src={m.exampleFrameUrl}
                      title={`Sample ordering site — ${m.exampleName}`}
                      loading="lazy"
                      className="mt-3 h-[560px] w-full rounded-lg border border-emerald-500/30 bg-zinc-950"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* The owner's side */}
          <div className="mt-4 rounded-2xl border border-sky-500/30 bg-sky-500/[0.05] p-5">
            <h2 className="text-base font-semibold text-sky-200">{c.portalTitle}</h2>
            <ul className="mt-2 grid gap-2 text-sm text-zinc-300 sm:grid-cols-3">
              {c.portal.map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <span aria-hidden className="mt-0.5 text-sky-300">✓</span>
                  {line}
                </li>
              ))}
            </ul>
          </div>

          {/* Next step — the fee beside it, in foreground, because it is the sentence that lets the owner say yes */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {m.claimUrl ? (
              <>
                <a href={m.claimUrl} className="rounded-lg bg-emerald-500 px-6 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-emerald-400">{c.ctaClaim}</a>
                <a href={m.callUrl} className="rounded-lg border border-zinc-700 px-6 py-3 text-base font-medium text-zinc-200 transition hover:bg-zinc-800">{c.ctaCall}</a>
              </>
            ) : (
              <a href={m.callUrl} className="rounded-lg bg-emerald-500 px-6 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-emerald-400">{c.ctaCallOnly}</a>
            )}
          </div>
          <p className="mt-3 max-w-2xl text-sm text-zinc-200">{m.fee}</p>
        </section>

        {/* Matrix */}
        <section className="mx-auto max-w-4xl px-6 pb-16 pt-6">
          <h2 className="text-2xl font-semibold">{c.matrixTitle}</h2>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/60 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2 text-left"> </th>
                  <th className="px-3 py-2 text-left">{c.matrixToday}</th>
                  <th className="px-3 py-2 text-left text-emerald-300">{c.matrixEvolved}</th>
                </tr>
              </thead>
              <tbody>
                {m.rows.map((r) => (
                  <tr key={r.key} className="border-t border-zinc-800">
                    <td className="px-3 py-2 font-medium text-zinc-200">{r.label}</td>
                    <td className="px-3 py-2 text-zinc-400">{r.today ?? '—'}</td>
                    <td className="px-3 py-2 text-zinc-200">{r.evolved}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-6 text-xs leading-relaxed text-zinc-600">{c.footer}</p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
