// app/realtors/sample-agency/page.tsx
//
// Live demo of the /realtors "agency site" template direction: a FICTIONAL realty company
// (Cedar & Vine Realty) with branded chrome, a roster of agents — each with a headshot, bio,
// and their OWN About That voice — and narrated listings. Wraps the single-listing sample
// (/realtors/sample-listing) in full-agency chrome. Composes the real registered blocks
// (agent_roster + listing_card) with hardcoded content, exactly like sample-listing renders
// listing_card directly, so this page IS the seed for a reusable real_estate_agency template.
//
// Voices: today every agent + listing uses the one minted "QuickSites Realtors Demo" embed
// (9b0a931f) as a stand-in. HiveJournal is minting a palette of distinct voices (crosstalk,
// 2026-07-19) — when it lands, each agent gets their own embed_id here (one line each).
//
// Fictional agency, not a real firm — kept noindex; the value is the click-through from
// /realtors, not search.

import Link from 'next/link';
import SiteHeader from '@/components/site/site-header';
import RenderAgentRoster from '@/components/admin/templates/render-blocks/agent-roster';
import RenderListingCard from '@/components/admin/templates/render-blocks/listing-card';

export const metadata = {
  title: 'Cedar & Vine Realty — a sample agency site with voiced agents | QuickSites',
  description:
    'A live sample real-estate AGENCY site: a roster of agents who each introduce themselves and their listings in their own “About That” voice — the kind of site QuickSites builds for a whole brokerage.',
  robots: { index: false, follow: true },
};

// Stand-in voice until HiveJournal delivers the per-agent palette (crosstalk 2026-07-19).
const DEMO_EMBED = process.env.NEXT_PUBLIC_REALTORS_DEMO_EMBED_ID || '9b0a931f-5277-4de4-bc30-54e0d1e9269f';

const AGENCY = {
  name: 'Cedar & Vine Realty',
  tagline: 'A boutique brokerage for the Cedar Hollow valley — where every listing talks back.',
};

const AGENTS = {
  title: 'Meet the Cedar & Vine team',
  subtitle: 'Three agents, three voices. Tap ▶ on any card to hear them introduce themselves — the same way a buyer hears them scanning a QR on the yard sign.',
  columns: 3,
  agents: [
    {
      name: 'Jordan Avery',
      title: 'Listing Agent',
      photo_url: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=256&q=70',
      bio: 'Fifteen years matching families to the right block, not just the right house. Knows every cul-de-sac in the district and prices a home to actually sell.',
      email: 'jordan@example.com',
      phone: '',
      about_that_embed_id: DEMO_EMBED, // → per-agent voice when HJ palette lands
    },
    {
      name: 'Priya Nair',
      title: 'Buyer’s Agent',
      photo_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=256&q=70',
      bio: 'First-time buyers are her specialty — patient, straight about the numbers, and relentless on the inspection details that save you later.',
      email: 'priya@example.com',
      phone: '',
      about_that_embed_id: DEMO_EMBED,
    },
    {
      name: 'Marcus Bellamy',
      title: 'Broker / Owner',
      photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=70',
      bio: 'Runs the desk and the luxury portfolio. If it has a view and a story, Marcus has the pitch — and the comps to back it up.',
      email: 'marcus@example.com',
      phone: '',
      about_that_embed_id: DEMO_EMBED,
    },
  ],
};

const LISTINGS = [
  {
    headline: 'Easy-Living 4-Bed on a Cedar Hollow Cul-de-Sac',
    address: '142 Maple Crossing Lane, Cedar Hollow, OR 97402',
    price: '$475,000',
    status: 'For sale',
    beds: '4',
    baths: '2.5',
    sqft: '2,340',
    description:
      'Tucked at the end of a quiet cul-de-sac, this 2016-built four-bedroom feels easy to live in — open quartz kitchen, covered patio, fenced yard, and a finished bonus room. Listed by Jordan Avery.',
    cta_text: 'Request a showing',
    cta_link: '#contact',
    images: [
      'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1200&q=70',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=70',
    ],
    about_that_embed_id: DEMO_EMBED,
  },
  {
    headline: 'Modern Ridge-View Retreat with Walls of Glass',
    address: '8 Vineyard Ridge, Cedar Hollow, OR 97402',
    price: '$862,000',
    status: 'For sale',
    beds: '3',
    baths: '3',
    sqft: '3,010',
    description:
      'A luxury ridge-view build — floor-to-ceiling glass, chef’s kitchen, and a primary wing that opens to the valley. Listed by Marcus Bellamy.',
    cta_text: 'Request a private tour',
    cta_link: '#contact',
    images: [
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=70',
      'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=70',
    ],
    about_that_embed_id: DEMO_EMBED,
  },
];

export default function SampleAgencyPage() {
  return (
    <>
      <SiteHeader sticky logoText={AGENCY.name} logoHref="/realtors/sample-agency" />
      <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-950 to-black text-zinc-100">
        {/* Agency hero / brand chrome */}
        <header className="border-b border-zinc-800/80">
          <div className="mx-auto max-w-6xl px-4 py-16 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-300">
              🌿 {AGENCY.name}
            </div>
            <h1 className="mx-auto mt-5 max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">
              {AGENCY.tagline}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-zinc-400 sm:text-base">
              Every agent and every listing on this site can be heard, not just read — powered by QuickSites + “About That” voice.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#listings"
                className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
              >
                Browse listings
              </a>
              <a
                href="#team"
                className="rounded-xl border border-zinc-700 px-5 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-zinc-500"
              >
                Meet the team
              </a>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-4 pt-8">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            <span className="font-semibold">Live demo.</span> This is a sample agency site — tap ▶ on any agent or listing to hear the voice player in action.
          </div>
        </div>

        {/* Roster — the new agent_roster block */}
        <div id="team" className="scroll-mt-20">
          <RenderAgentRoster content={AGENTS} />
        </div>

        {/* Featured listings — the real listing_card block, each narrated */}
        <section id="listings" className="scroll-mt-20 pt-2">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Featured listings</h2>
          </div>
          {LISTINGS.map((l) => (
            <RenderListingCard key={l.address} content={l} />
          ))}
        </section>

        {/* Contact / CTA */}
        <section id="contact" className="scroll-mt-20 border-t border-zinc-800/80">
          <div className="mx-auto max-w-6xl px-4 py-16 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">Thinking of buying or selling in Cedar Hollow?</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-400">
              Reach the Cedar &amp; Vine team and we’ll get you the voice tour first.
            </p>
            <a
              href="mailto:hello@example.com?subject=Cedar%20%26%20Vine%20inquiry"
              className="mt-6 inline-flex rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
            >
              Contact the team
            </a>

            <div className="mt-12 border-t border-zinc-800/60 pt-8">
              <p className="text-sm text-zinc-400">Want a whole-brokerage site like this — with voiced agents?</p>
              <Link
                href="/realtors"
                className="mt-2 inline-flex rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-2.5 text-sm font-semibold text-emerald-300 transition hover:border-emerald-400 hover:bg-emerald-500/20"
              >
                See how QuickSites builds agent + agency sites →
              </Link>
              <p className="mt-6 text-xs text-zinc-600">
                Cedar &amp; Vine Realty is a fictional agency. Sample agents, listings, and voices for demonstration only.
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
