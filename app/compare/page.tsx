// app/compare/page.tsx
// Public "how we compare" chart. Weaponizes the docs/COMPETITIVE_LANDSCAPE.md §7
// positioning for prospects/partners. Claims are grounded in that doc + the
// competitors' public pricing (sourced at the bottom). Honest by design — the
// "where they lead" section keeps it credible, which is the whole point of the
// wedge. Static server component; on-brand with /partners + /pricing.
import Link from 'next/link';
import SiteHeader from '@/components/site/site-header';
import { MAX_PLATFORM_FEE_PERCENT, PARTNER_FEE_SHARE } from '@/lib/commerce/partner-terms';
import { marketingOg } from '@/lib/marketingOg';

const maxFeePct = Math.round(MAX_PLATFORM_FEE_PERCENT * 100);
const keepPct = Math.round(PARTNER_FEE_SHARE * 100);

export const metadata = marketingOg({
  title: 'QuickSites vs Duda vs GoHighLevel — how we compare',
  description:
    'An honest side-by-side: QuickSites monetizes commerce with a take-rate + lifetime reseller residual on GMV, plus print-on-demand — the model Duda and GoHighLevel structurally chose not to build.',
  path: '/compare',
  ogEyebrow: 'Compare',
  ogTitle: 'QuickSites vs Duda vs GoHighLevel',
  ogSubtitle: 'The commerce take-rate + lifetime reseller residual — the model they structurally chose not to build.',
});

type Mark = 'yes' | 'no' | 'partial';
type Row = {
  feature: string;
  detail?: string;
  qs: { mark: Mark; note: string };
  duda: { mark: Mark; note: string };
  ghl: { mark: Mark; note: string };
};

// Columns: QuickSites vs the real competitive set (Duda = agency builder,
// GoHighLevel = agency CRM/SaaS resale). Grounded in COMPETITIVE_LANDSCAPE.md.
const ROWS: Row[] = [
  {
    feature: 'Hosting cost',
    detail: 'What it costs to keep a client site live',
    qs: { mark: 'yes', note: 'Free hosting' },
    duda: { mark: 'no', note: '$19–$149/mo per plan' },
    ghl: { mark: 'no', note: '$97–$497/mo' },
  },
  {
    feature: 'You earn a % of every sale',
    detail: 'A commerce take-rate that scales with the merchant’s GMV',
    qs: { mark: 'yes', note: `Platform fee up to ${maxFeePct}% via Stripe Connect` },
    duda: { mark: 'no', note: '0% on store transactions' },
    ghl: { mark: 'no', note: 'No real ecommerce to monetize' },
  },
  {
    feature: 'Lifetime reseller residual on GMV',
    detail: 'The reseller keeps a cut of every order — forever, not a one-time markup',
    qs: { mark: 'yes', note: `Keep ${keepPct}% of every order fee, ongoing` },
    duda: { mark: 'no', note: 'Flat markup on a fixed seat price' },
    ghl: { mark: 'partial', note: 'Resell SaaS seats — not sales' },
  },
  {
    feature: 'Print-on-demand (books + merch)',
    detail: 'Sell physical goods with zero inventory — printed & shipped on order',
    qs: { mark: 'yes', note: 'Lulu (books) + Gelato (apparel/posters) built in' },
    duda: { mark: 'no', note: 'Not offered' },
    ghl: { mark: 'no', note: 'Not offered' },
  },
  {
    feature: 'Fee taken on the merchant’s margin',
    detail: 'The printer’s base cost is excluded — we only take a cut of the profit',
    qs: { mark: 'yes', note: 'POD base cost carved out of the fee basis' },
    duda: { mark: 'no', note: 'N/A — no take-rate' },
    ghl: { mark: 'no', note: 'N/A — no take-rate' },
  },
  {
    feature: 'Native online store',
    detail: 'Catalog + checkout without a third-party plugin',
    qs: { mark: 'yes', note: 'Stripe Connect checkout, refunds, ledger' },
    duda: { mark: 'yes', note: 'Mature — up to 20k products, tax/shipping' },
    ghl: { mark: 'no', note: 'No catalog / inventory / fulfillment' },
  },
  {
    feature: 'AI generates a whole site',
    detail: 'Not just copy — the structure, services, and theme',
    qs: { mark: 'yes', note: 'Industry scaffold seeds a full site + copy/hero' },
    duda: { mark: 'partial', note: 'Writes copy; can’t build the canvas' },
    ghl: { mark: 'partial', note: 'Copy / voice assistants' },
  },
  {
    feature: 'Rebuild an existing site from a URL',
    detail: 'Paste a client’s live site → an editable draft, for painless migration',
    qs: { mark: 'yes', note: 'AI rebuild: paste a URL, get a draft in seconds' },
    duda: { mark: 'no', note: 'Manual rebuild' },
    ghl: { mark: 'no', note: 'Manual rebuild' },
  },
  {
    feature: 'White-label & resell under your brand',
    detail: 'Your logo, domain, login, and emails — not ours',
    qs: { mark: 'yes', note: 'Brand the builder, login, and emails' },
    duda: { mark: 'yes', note: 'Excellent, self-serve' },
    ghl: { mark: 'yes', note: 'Good — $497 SaaS mode' },
  },
  {
    feature: 'CRM / SMS / marketing automation',
    detail: 'Pipelines, unified inbox, campaigns',
    qs: { mark: 'no', note: 'Out of scope by design' },
    duda: { mark: 'partial', note: 'Light' },
    ghl: { mark: 'yes', note: 'Dominant — their core strength' },
  },
  {
    feature: 'Deep catalog & many payment gateways',
    detail: '20k+ products, multiple processors',
    qs: { mark: 'partial', note: 'One credible vertical; Stripe-first' },
    duda: { mark: 'yes', note: 'Broad and proven' },
    ghl: { mark: 'no', note: 'Not a commerce platform' },
  },
];

function MarkIcon({ mark }: { mark: Mark }) {
  if (mark === 'yes') {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400" aria-label="Yes">
        ✓
      </span>
    );
  }
  if (mark === 'partial') {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/15 text-amber-400" aria-label="Partial">
        ~
      </span>
    );
  }
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-600/20 text-zinc-500" aria-label="No">
      ✕
    </span>
  );
}

function Cell({ mark, note, highlight = false }: { mark: Mark; note: string; highlight?: boolean }) {
  return (
    <td className={`px-4 py-4 align-top ${highlight ? 'bg-sky-500/5' : ''}`}>
      <div className="flex items-start gap-2">
        <MarkIcon mark={mark} />
        <span className={`text-sm ${highlight ? 'text-zinc-200' : 'text-zinc-400'}`}>{note}</span>
      </div>
    </td>
  );
}

export default function ComparePage() {
  return (
    <>
      <SiteHeader sticky />
      <div className="relative min-h-screen bg-zinc-950 text-white">
        {/* Hero */}
        <section className="mx-auto max-w-5xl px-6 pt-16 pb-10 text-center">
          <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-300">
            How we compare
          </span>
          <h1 className="mt-6 text-4xl md:text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-sky-200">
            Free hosting. A real store. You earn on every sale.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-zinc-400">
            Duda takes <span className="font-semibold text-zinc-200">0%</span> of your merchants’ sales and
            GoHighLevel has <span className="font-semibold text-zinc-200">no real ecommerce</span> — both sell
            flat monthly SaaS seats. QuickSites monetizes the sale itself, and pays the reseller a{' '}
            <span className="font-semibold text-zinc-200">{keepPct}% lifetime residual</span> on every order.
          </p>
        </section>

        {/* The wedge */}
        <section className="mx-auto max-w-4xl px-6 pb-6">
          <div className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-6 text-center">
            <p className="text-lg font-medium text-zinc-100">
              “Free hosting + a real store + the agency earns a lifetime cut of every sale — for
              product/commerce merchants (incl. authors &amp; print-on-demand) that GoHighLevel can’t
              serve and Duda can’t monetize.”
            </p>
          </div>
        </section>

        {/* Comparison table */}
        <section className="mx-auto max-w-6xl px-6 py-10">
          <div className="overflow-x-auto rounded-2xl border border-zinc-800">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/60">
                  <th className="px-4 py-4 text-sm font-semibold text-zinc-300">Feature</th>
                  <th className="px-4 py-4 text-sm font-bold text-sky-300 bg-sky-500/10">QuickSites</th>
                  <th className="px-4 py-4 text-sm font-semibold text-zinc-300">Duda</th>
                  <th className="px-4 py-4 text-sm font-semibold text-zinc-300">GoHighLevel</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.feature} className="border-b border-zinc-800/70 last:border-0">
                    <th className="px-4 py-4 align-top text-left font-normal">
                      <div className="text-sm font-semibold text-zinc-100">{r.feature}</div>
                      {r.detail && <div className="mt-1 text-xs text-zinc-500">{r.detail}</div>}
                    </th>
                    <Cell mark={r.qs.mark} note={r.qs.note} highlight />
                    <Cell mark={r.duda.mark} note={r.duda.note} />
                    <Cell mark={r.ghl.mark} note={r.ghl.note} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-center text-xs text-zinc-600">
            <span className="text-emerald-400">✓</span> yes &nbsp;·&nbsp;
            <span className="text-amber-400">~</span> partial &nbsp;·&nbsp;
            <span className="text-zinc-500">✕</span> no
          </p>
        </section>

        {/* Pricing strip */}
        <section className="border-t border-zinc-800/70 bg-zinc-950/60">
          <div className="mx-auto max-w-6xl px-6 py-14">
            <h2 className="text-2xl md:text-3xl font-semibold">What it costs you</h2>
            <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
              <div className="rounded-xl border border-sky-500/40 bg-sky-500/5 p-5">
                <div className="text-sm font-semibold text-sky-300">QuickSites</div>
                <div className="mt-2 text-2xl font-bold">Free hosting</div>
                <p className="mt-2 text-sm text-zinc-400">
                  + a per-order fee you set (up to {maxFeePct}%). No monthly seat charge. You get paid when your
                  merchants get paid.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
                <div className="text-sm font-semibold text-zinc-300">Duda</div>
                <div className="mt-2 text-2xl font-bold text-zinc-200">$19–$149/mo</div>
                <p className="mt-2 text-sm text-zinc-400">
                  per plan, plus a <span className="text-zinc-300">$8–$52/mo</span> eCommerce add-on per site.
                  You mark it up manually; your margin doesn’t move with sales.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
                <div className="text-sm font-semibold text-zinc-300">GoHighLevel</div>
                <div className="mt-2 text-2xl font-bold text-zinc-200">$97–$497/mo</div>
                <p className="mt-2 text-sm text-zinc-400">
                  plus usage rebilling (SMS/email/AI). Resell seats for a monthly fee — there’s no sale to take
                  a cut of.
                </p>
              </div>
            </div>
            <p className="mt-6 text-center text-sm">
              <Link href="/partners/calculator" className="text-sky-400 underline underline-offset-4 hover:text-sky-300">
                See your earnings vs. a flat-markup builder →
              </Link>
            </p>
          </div>
        </section>

        {/* Switching / migration — the #1 objection for resellers leaving a flat-fee tool */}
        <section className="border-t border-zinc-800/70">
          <div className="mx-auto max-w-4xl px-6 py-12 text-center">
            <h2 className="text-2xl md:text-3xl font-semibold">Switching from Duda or GoHighLevel?</h2>
            <p className="mx-auto mt-3 max-w-2xl text-zinc-400">
              You don’t rebuild your clients by hand. Paste a client’s current site and our AI regenerates it as an
              editable QuickSites draft in seconds — a migration and a live sales demo in one.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link href="/rebuild" className="rounded-lg bg-sky-500 px-6 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-sky-400">
                Rebuild a client’s site — free
              </Link>
              <Link href="/partners/resellers" className="rounded-lg border border-sky-500 px-6 py-3 text-base font-medium text-sky-300 transition hover:bg-sky-500/10 hover:text-sky-200">
                For Duda / GoHighLevel resellers →
              </Link>
            </div>
          </div>
        </section>

        {/* Honesty section — where they lead */}
        <section className="border-t border-zinc-800/70">
          <div className="mx-auto max-w-6xl px-6 py-14">
            <h2 className="text-2xl md:text-3xl font-semibold">Where they’re ahead (we’ll be straight with you)</h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              We win on the <span className="text-zinc-200">model</span>, not on everything. Pick the tool that
              fits the job.
            </p>
            <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
                <h4 className="text-base font-semibold text-white">Choose Duda if…</h4>
                <p className="mt-2 text-sm text-zinc-400">
                  You need the deepest storefront today — thousands of products, automated tax/shipping, and many
                  payment gateways — with the most polished self-serve white-label. Duda’s builder is best-in-class
                  and proven across 18,000+ agencies.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
                <h4 className="text-base font-semibold text-white">Choose GoHighLevel if…</h4>
                <p className="mt-2 text-sm text-zinc-400">
                  Your job is <span className="text-zinc-200">marketing</span>: CRM, pipelines, two-way SMS, a
                  unified inbox, and campaign automation. That’s GHL’s moat and we don’t try to compete with it.
                </p>
              </div>
            </div>
            <div className="mt-6 rounded-xl border border-sky-500/30 bg-sky-500/5 p-5">
              <h4 className="text-base font-semibold text-sky-300">Choose QuickSites if…</h4>
              <p className="mt-2 text-sm text-zinc-300">
                You (or your merchants) <span className="font-semibold">sell things</span> — products, digital goods,
                books, or merch — and you’d rather earn a slice of every sale than pay a flat monthly bill. Free
                hosting brings merchants in; the order economics are yours.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-zinc-800/70 bg-zinc-950/60">
          <div className="mx-auto max-w-4xl px-6 py-16 text-center">
            <h2 className="text-2xl md:text-3xl font-semibold">Earn on every sale, not a flat markup.</h2>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/partners" className="rounded-lg bg-sky-500 px-7 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-sky-400">
                See the partner program
              </Link>
              <Link href="/partners/calculator" className="rounded-lg border border-sky-500 px-7 py-3 text-base font-medium text-sky-300 transition hover:bg-sky-500/10 hover:text-sky-200">
                Estimate your earnings
              </Link>
            </div>
          </div>
        </section>

        <footer className="border-t border-zinc-800/70 py-6 text-center text-xs text-zinc-600">
          <p className="mx-auto max-w-3xl px-6">
            Comparison reflects each platform’s publicly documented features &amp; pricing (2026); competitors’
            plans change — check their sites for current details. Sources:{' '}
            <a href="https://www.duda.co/pricing" className="underline hover:text-zinc-400">Duda pricing</a>,{' '}
            <a href="https://www.duda.co/ecommerce/pricing" className="underline hover:text-zinc-400">Duda eCommerce</a>,{' '}
            <a href="https://www.gohighlevel.com/pricing" className="underline hover:text-zinc-400">GoHighLevel pricing</a>.
          </p>
          <p className="mt-3">
            &copy; {new Date().getFullYear()} QuickSites.ai —{' '}
            <Link href="/" className="underline hover:text-zinc-300">Home</Link>
            <span className="mx-1">•</span>
            <Link href="/pricing" className="underline hover:text-zinc-300">Pricing</Link>
            <span className="mx-1">•</span>
            <Link href="/partners" className="underline hover:text-zinc-300">Partners</Link>
            <span className="mx-1">•</span>
            <Link href="/rebuild" className="underline hover:text-zinc-300">Rebuild tool</Link>
          </p>
        </footer>
      </div>
    </>
  );
}
