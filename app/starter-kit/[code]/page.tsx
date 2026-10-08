// app/starter-kit/[code]/page.tsx
//
// The rep's printable starter kit, keyed by their referral code: /starter-kit/abdou.
// Public URL, noindex, linked from the rep's /for-<name> page. What goes on the paper is decided
// in lib/starterKit/starterKit.ts (pure, forbidden-promise tested); this page fetches and lays
// out three letter-size sheets with print CSS. The only JavaScript is the Print button.
//
// ⚠️ THE SHEETS ARE WHITE ON PURPOSE. The app chrome is always dark (CLAUDE.md §7) and that
// rule exists for screens; this page's product is paper, and a dark card on an inkjet is a
// soaked page. The screen wrapper stays dark; each sheet is explicitly a white page.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCode } from '@/lib/referrals/codes';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { qrDataUrlFor } from '@/lib/outreach/competitionPoster';
import { buildStarterKit, type StarterKit } from '@/lib/starterKit/starterKit';
import PrintButton from '@/components/starter-kit/print-button';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const metadata: Metadata = {
  title: 'QuickSites — starter kit',
  robots: { index: false, follow: false },
};

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

/** Built, unclaimed drafts in the rep's city — the "your site is ready" sheets. */
async function loadDrafts(city: string, region: string) {
  if (!city) return [];
  let q = supabaseAdmin
    .from('outreach_prospects')
    .select('id, business_name, template_id')
    .eq('city', city)
    .eq('status', 'draft_built')
    .not('template_id', 'is', null)
    .limit(40);
  if (region) q = q.eq('region', region);
  const { data } = await q;
  // Two plain queries, never an embed: `templates:template_id (…)` is not a declared FK and
  // PostgREST fails the whole select — the kit printed no draft sheets on its first deploy.
  const prospects = ((data ?? []) as any[]).filter((p) => p.template_id && p.business_name);
  const { data: tpls } = prospects.length
    ? await supabaseAdmin.from('templates').select('id, slug, data').in('id', prospects.map((p) => p.template_id))
    : { data: [] as any[] };
  const tplById = new Map<string, any>(((tpls ?? []) as any[]).map((t) => [t.id, t]));
  const base = (process.env.NEXT_PUBLIC_MENU_BASE_DOMAIN || '').trim();
  return prospects
    .filter((p) => tplById.get(p.template_id)?.slug)
    .map((p) => {
      const tpl = tplById.get(p.template_id);
      const slug: string = tpl.slug;
      const blocks: any[] = tpl?.data?.pages?.[0]?.blocks ?? [];
      const menu = blocks.find((b) => b?.type === 'menu');
      const items = (menu?.content?.sections ?? []).reduce((n: number, s: any) => n + (s?.items?.length ?? 0), 0);
      return {
        prospectId: String(p.id),
        businessName: String(p.business_name),
        // The apex form linkifies on a phone; the bare <slug>.delivered.menu does not (new gTLD).
        previewUrl: base ? `https://deliveredmenu.com/${slug}` : `https://www.quicksites.ai/sites/${slug}`,
        needsMenu: items === 0,
      };
    });
}

export default async function StarterKitPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<Search> }) {
  const { code } = await params;
  const sp = await searchParams;
  const row = await getCode(code);
  if (!row || row.status === 'disabled') notFound();

  const city = one(sp.city).trim();
  const region = one(sp.region).trim().toUpperCase();
  const drafts = await loadDrafts(city, region);
  const kit = buildStarterKit({ code: row.code, label: row.label, phone: one(sp.phone), territory: one(sp.territory) || null, drafts });

  const refQr = await qrDataUrlFor(kit.refUrl);
  const draftQrs = await Promise.all(kit.drafts.map((d) => qrDataUrlFor(d.claimUrl)));

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 print:bg-white">
      <style>{`
        @page { size: letter; margin: 0.4in; }
        @media print { .sheet { break-after: page; box-shadow: none !important; margin: 0 !important; } .sheet:last-child { break-after: auto; } }
        .sheet { background: #fff; color: #111; width: 7.7in; min-height: 10in; padding: 0.35in; box-sizing: border-box; }
        .card { width: 3.5in; height: 2in; box-sizing: border-box; border: 1px dashed #cfcfcf; padding: 0.18in; display: flex; gap: 0.14in; }
      `}</style>

      {/* Controls — screen only */}
      <div className="mx-auto max-w-[8.3in] px-4 pt-8 print:hidden">
        <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">Starter kit · {kit.rep.name}</p>
        <h1 className="mt-2 text-2xl font-bold">Print, cut, walk.</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Three sheets: business cards (cut on the dashed lines), a leave-behind flyer, and one page for each site
          already built in your area. Every scan uses your code <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-200">{kit.rep.code}</code>.
        </p>
        <form method="get" className="mt-4 flex flex-wrap items-end gap-3 text-sm">
          <label className="flex flex-col gap-1 text-zinc-400">
            Your phone (printed on the cards)
            <input name="phone" defaultValue={one(sp.phone)} placeholder="(206) 555-0100" className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100" />
          </label>
          <label className="flex flex-col gap-1 text-zinc-400">
            Area
            <input name="territory" defaultValue={one(sp.territory) || kit.rep.territory || ''} placeholder="Vashon Island" className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100" />
          </label>
          <label className="flex flex-col gap-1 text-zinc-400">
            City (for the built-site pages)
            <input name="city" defaultValue={city} placeholder="Vashon" className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100" />
          </label>
          <label className="flex flex-col gap-1 text-zinc-400">
            State
            <input name="region" defaultValue={region} placeholder="WA" className="w-20 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100" />
          </label>
          <button type="submit" className="rounded-md border border-zinc-700 px-4 py-2 text-zinc-200 hover:bg-zinc-800">Update</button>
          <PrintButton />
        </form>
        <p className="mt-3 text-xs text-zinc-500">
          {kit.drafts.length
            ? `${kit.drafts.length} built site${kit.drafts.length === 1 ? '' : 's'} in ${city}${region ? `, ${region}` : ''} — one page each, below the flyer.`
            : city
              ? `No built sites in ${city} yet — the kit prints cards and the flyer.`
              : 'Add a city to include a page for each site already built there.'}
        </p>
        <p className="mt-1 text-xs text-zinc-600">
          Back to <Link href={`/for-${kit.rep.code}`} className="underline">your page</Link>.
        </p>
      </div>

      <div className="mx-auto flex max-w-[8.3in] flex-col gap-8 px-4 py-8 print:gap-0 print:p-0">
        <CardsSheet kit={kit} qr={refQr} />
        <FlyerSheet kit={kit} qr={refQr} />
        {kit.drafts.map((d, i) => (
          <DraftSheet key={d.prospectId} kit={kit} draft={d} qr={draftQrs[i]} />
        ))}
      </div>
    </div>
  );
}

function RepLine({ kit, size = 'sm' }: { kit: StarterKit; size?: 'sm' | 'md' }) {
  const big = size === 'md';
  return (
    <div className={big ? 'text-base' : 'text-[11px] leading-snug'}>
      <div className={`font-bold ${big ? 'text-lg' : 'text-sm'}`}>{kit.rep.name}</div>
      {kit.rep.territory && <div className="text-zinc-600">{kit.rep.territory}</div>}
      {kit.rep.phone && <div className="font-medium">{kit.rep.phone}</div>}
    </div>
  );
}

function CardsSheet({ kit, qr }: { kit: StarterKit; qr: string }) {
  return (
    <section className="sheet shadow-xl">
      <div className="grid grid-cols-2 justify-center gap-0">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="card">
            <div className="flex min-w-0 flex-1 flex-col justify-between">
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-700">{kit.copy.brand}</div>
                <div className="mt-1 text-[12px] font-semibold leading-tight">{kit.copy.cardLine}</div>
              </div>
              <RepLine kit={kit} />
              <div className="text-[9px] leading-tight text-zinc-600">
                {kit.copy.cardScan} <span className="font-semibold text-zinc-900">{kit.rep.code}</span>
                <br />
                {kit.refUrlPrinted}
              </div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="" className="h-[1.15in] w-[1.15in] self-center" />
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-[10px] text-zinc-500 print:hidden">Ten cards · cut on the dashed lines · 3.5 × 2 in</p>
    </section>
  );
}

function FlyerSheet({ kit, qr }: { kit: StarterKit; qr: string }) {
  return (
    <section className="sheet shadow-xl">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">{kit.copy.brand}</div>
      <h2 className="mt-4 text-[34px] font-extrabold leading-[1.05] tracking-tight">{kit.copy.flyerHeadline}</h2>
      <p className="mt-4 max-w-[5.8in] text-[15px] leading-relaxed text-zinc-700">{kit.copy.flyerSub}</p>
      <ul className="mt-6 max-w-[5.8in] space-y-3 text-[14px] leading-relaxed">
        {kit.copy.flyerBullets.map((b) => (
          <li key={b} className="flex gap-3">
            <span aria-hidden className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-emerald-600" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <div className="mt-8 grid grid-cols-[1fr_auto] items-end gap-6">
        <ol className="space-y-2 text-[14px] leading-relaxed">
          {kit.copy.flyerSteps.map((s, i) => (
            <li key={s} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[12px] font-bold text-white">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="" className="mx-auto h-[2in] w-[2in]" />
          <div className="mt-1 text-[12px] font-semibold">{kit.refUrlPrinted}</div>
          <div className="text-[12px] text-zinc-600">
            code <span className="font-semibold text-zinc-900">{kit.rep.code}</span>
          </div>
        </div>
      </div>
      <div className="mt-10 flex items-end justify-between border-t border-zinc-200 pt-4">
        <div>
          <div className="text-[12px] text-zinc-600">{kit.copy.flyerClose}</div>
          <div className="mt-1">
            <RepLine kit={kit} size="md" />
          </div>
        </div>
        <div className="text-right text-[11px] text-zinc-500">www.quicksites.ai</div>
      </div>
    </section>
  );
}

function DraftSheet({ kit, draft, qr }: { kit: StarterKit; draft: StarterKit['drafts'][number]; qr: string }) {
  return (
    <section className="sheet shadow-xl">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">{kit.copy.brand}</div>
      <h2 className="mt-4 text-[32px] font-extrabold leading-[1.08] tracking-tight">{kit.copy.draftHeadline(draft.businessName)}</h2>
      <p className="mt-4 text-[15px] text-zinc-700">{kit.copy.draftSub}</p>
      <div className="mt-2 rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-3 text-[20px] font-semibold tracking-tight">
        {draft.previewUrl.replace(/^https?:\/\//, '')}
      </div>
      <p className="mt-5 max-w-[5.8in] text-[14px] leading-relaxed text-zinc-700">
        {draft.needsMenu ? kit.copy.draftNeedsMenu : kit.copy.draftHasMenu}
      </p>
      <div className="mt-8 grid grid-cols-[auto_1fr] items-center gap-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="" className="h-[2.2in] w-[2.2in]" />
        <div>
          <div className="text-[22px] font-bold">{kit.copy.draftClaim}</div>
          <div className="mt-1 text-[14px] leading-relaxed text-zinc-700">{kit.copy.draftClaimSub}</div>
        </div>
      </div>
      <div className="mt-10 flex items-end justify-between border-t border-zinc-200 pt-4">
        <div>
          <div className="text-[12px] text-zinc-600">{kit.copy.flyerClose}</div>
          <div className="mt-1">
            <RepLine kit={kit} size="md" />
          </div>
        </div>
        <div className="max-w-[3in] text-right text-[11px] text-zinc-500">{kit.copy.draftFootnote}</div>
      </div>
    </section>
  );
}
