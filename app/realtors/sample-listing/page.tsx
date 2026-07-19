// app/realtors/sample-listing/page.tsx
//
// Live demo of the /realtors hook: a REAL listing page an agent would publish, with
// HiveJournal's "About That" agent-voice player wired in ("🎙️ Hear about this home").
// About That narrates page CONTENT, so this is a genuine listing_card (address / price /
// beds / baths / description) — not marketing copy. The embed's data-url defaults to this
// page's own URL, so the audio is grounded in what's rendered here.
//
// Embed: the minted "QuickSites Realtors Demo" prod embed (agent preset, owner's own
// consented clone → voice:self per the ratified Consent v2). A public embed id is not a
// secret (it ships in the client <script data-embed=…> anyway); NEXT_PUBLIC_REALTORS_DEMO_EMBED_ID
// still overrides it if needed. See crosstalk/contracts/about-that-embed.md.

import Link from 'next/link';
import SiteHeader from '@/components/site/site-header';
import RenderListingCard from '@/components/admin/templates/render-blocks/listing-card';

export const metadata = {
  title: 'Sample listing — hear it in the agent’s voice | QuickSites',
  description:
    'A live sample real-estate listing with agent-voice “About That” audio — the same audio a buyer hears scanning the QR on your yard sign.',
  // A demo listing (not a real home) — keep it out of search; the value is the click-through
  // from /realtors, and About That's domain gate works regardless of indexing.
  robots: { index: false, follow: true },
};

// HJ sandbox embed (contracts/about-that-embed.md) — house narrator voice, allowed on
// quicksites.ai. Swap to the minted prod embed via env, no redeploy of code needed.
const ABOUT_THAT_EMBED_ID =
  process.env.NEXT_PUBLIC_REALTORS_DEMO_EMBED_ID || '9b0a931f-5277-4de4-bc30-54e0d1e9269f';

// A FICTIONAL, narration-rich listing (HJ content spec 2026-07-18). The town is invented
// (Cedar Hollow) so it never maps to a real home, and the prose is the "money shot" for the
// pitch_panel/summary. About That reads THIS content, so concrete detail makes better audio.
const SAMPLE_LISTING = {
  headline: 'Easy-Living 4-Bed on a Cedar Hollow Cul-de-Sac',
  address: '142 Maple Crossing Lane, Cedar Hollow, OR 97402',
  price: '$475,000',
  status: 'For sale',
  beds: '4',
  baths: '2.5',
  sqft: '2,340',
  description:
    'Tucked at the end of a quiet cul-de-sac in Cedar Hollow, this 2016-built four-bedroom is the ' +
    'kind of home that just feels easy to live in. The open kitchen — quartz counters, a big island, ' +
    'and room for everyone — flows into a bright living space and out to a covered patio and fully ' +
    'fenced yard. Upstairs, the primary suite has a walk-in closet and dual-vanity bath, with three ' +
    'more bedrooms and a finished bonus room downstairs for a home office or playroom. A new 2022 ' +
    'HVAC, hardwood main floor, and attached two-car garage round it out. Minutes to parks and ' +
    'downtown, in the sought-after Summit school district.',
  cta_text: 'Request a showing',
  cta_link: 'mailto:realtors@quicksites.ai?subject=Showing%20request%20%E2%80%94%20142%20Maple%20Crossing%20Lane',
  images: [
    'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1200&q=70',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=70',
    'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=70',
  ],
  about_that_embed_id: ABOUT_THAT_EMBED_ID,
};

// Extra facts rendered as READABLE TEXT (the listing_card block has no fields for these). About
// That's FAQ answers STRICTLY from page content, so stating HOA / taxes / schools / HVAC / parking
// here is what lets a visitor ask "what's the HOA?" and get answerable:true (not a decline).
const PROPERTY_DETAILS: Array<[string, string]> = [
  ['Property type', 'Single-family'],
  ['Year built', '2016'],
  ['Lot size', '0.28 acre'],
  ['HOA', '$45 / month'],
  ['Property taxes', '≈ $5,200 / year'],
  ['Parking', 'Attached 2-car garage'],
  ['Heating / cooling', 'Forced-air gas + central A/C (new HVAC 2022)'],
  ['Appliances included', 'Refrigerator, range, dishwasher, washer/dryer'],
  ['Schools', 'Cedar Hollow Elementary · Riverbend Middle · Summit High'],
  ['Flooring', 'Hardwood on the main level'],
];

const KEY_FEATURES = [
  'Open-concept kitchen with quartz counters + island',
  'Primary suite with walk-in closet + dual vanity',
  'Finished bonus room downstairs (office or playroom)',
  'Fully fenced backyard with a covered patio',
  'Quiet cul-de-sac lot',
];

export default function SampleListingPage() {
  return (
    <>
      <SiteHeader sticky />
      <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-950 to-black">
        <div className="mx-auto max-w-5xl px-4 pt-10">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            <span className="font-semibold">Live demo.</span> Tap ▶ on <span className="font-medium">“🎙️ Hear about this home”</span>{' '}
            below to hear an agent describe this listing — the same audio a buyer gets scanning the QR on your yard sign.
          </div>
        </div>

        {/* The real listing_card block — same one agents publish, wired to About That. */}
        <RenderListingCard content={SAMPLE_LISTING} />

        {/* Property details + features as readable text — this is what lets the About That FAQ
            answer "what's the HOA / taxes / schools / HVAC?" with answerable:true. */}
        <section className="mx-auto w-full max-w-5xl px-4 py-2">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Property details</h3>
              <dl className="mt-3 divide-y divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-900/40">
                {PROPERTY_DETAILS.map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
                    <dt className="text-sm text-zinc-400">{label}</dt>
                    <dd className="text-right text-sm font-medium text-zinc-100">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Key features</h3>
              <ul className="mt-3 space-y-2">
                {KEY_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-zinc-200">
                    <span aria-hidden className="mt-0.5 text-emerald-400">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 text-center">
          <p className="text-sm text-zinc-400">Want your listings to talk like this?</p>
          <Link
            href="/realtors"
            className="mt-2 inline-flex rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-2.5 text-sm font-semibold text-emerald-300 transition hover:border-emerald-400 hover:bg-emerald-500/20"
          >
            Get a free agent site with voice listings →
          </Link>
          <p className="mt-6 text-xs text-zinc-600">Sample listing — not a real property. For demonstration only.</p>
        </div>
      </main>
    </>
  );
}
