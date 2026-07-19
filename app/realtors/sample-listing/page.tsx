// app/realtors/sample-listing/page.tsx
//
// Live demo of the /realtors hook: a REAL listing page an agent would publish, with
// HiveJournal's "About That" agent-voice player wired in ("🎙️ Hear about this home").
// About That narrates page CONTENT, so this is a genuine listing_card (address / price /
// beds / baths / description) — not marketing copy. The embed's data-url defaults to this
// page's own URL, so the audio is grounded in what's rendered here.
//
// Embed: defaults to HJ's SANDBOX embed (allowed on quicksites.ai, house voice) so the
// wiring is fully live for smoke today. When the owner mints the dedicated prod embed
// ("QuickSites Realtors Demo", agent preset), set NEXT_PUBLIC_REALTORS_DEMO_EMBED_ID —
// zero code change. See crosstalk/contracts/about-that-embed.md.

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
  process.env.NEXT_PUBLIC_REALTORS_DEMO_EMBED_ID || '22e4692a-2538-4d8b-a2df-9fce1a7abdb9';

// A real, narration-rich listing. The description is deliberately specific — About That
// reads THIS content, so concrete detail (year, finishes, lot, location) makes better audio.
const SAMPLE_LISTING = {
  headline: 'Sunlit Craftsman on a Cedar Crest Cul-de-Sac',
  address: '1428 Cedar Crest Dr, Renton, WA 98059',
  price: '$724,900',
  status: 'For sale',
  beds: '4',
  baths: '2.5',
  sqft: '2,340',
  description:
    'Tucked on a quiet cul-de-sac in sought-after Cedar Crest, this light-filled 2016 Craftsman ' +
    'pairs an open great room with a chef’s kitchen — quartz counters, a gas range, and a walk-in ' +
    'pantry. Four bedrooms include a convenient main-floor guest suite and a vaulted primary with a ' +
    'spa bath and heated floors. The fully fenced backyard backs to a protected greenbelt, with a ' +
    'covered patio pre-wired for a hot tub and raised garden beds ready for spring. Minutes to ' +
    'top-rated Renton schools, the Cedar River Trail, and I-405.',
  cta_text: 'Request a showing',
  cta_link: 'mailto:realtors@quicksites.ai?subject=Showing%20request%20%E2%80%94%201428%20Cedar%20Crest%20Dr',
  images: [
    'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1200&q=70',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=70',
    'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=70',
  ],
  about_that_embed_id: ABOUT_THAT_EMBED_ID,
};

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

        <div className="mx-auto max-w-5xl px-4 pb-16 text-center">
          <p className="text-sm text-zinc-400">Want your listings to talk like this?</p>
          <Link
            href="/realtors"
            className="mt-2 inline-flex rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-2.5 text-sm font-semibold text-emerald-300 transition hover:border-emerald-400 hover:bg-emerald-500/20"
          >
            Get a free agent site with voice listings →
          </Link>
        </div>
      </main>
    </>
  );
}
