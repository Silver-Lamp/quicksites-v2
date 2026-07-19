// app/realtors/sample-agency/page.tsx
//
// Live demo of the /realtors "agency site" template direction: a FICTIONAL realty company
// (Cedar & Vine Realty) with branded chrome, a roster of agents — each with a headshot, bio,
// and their OWN About That voice — and narrated listings. Wraps the single-listing sample
// (/realtors/sample-listing) in full-agency chrome. Composes the real registered blocks
// (agent_roster + listing_card) with shared content (app/realtors/sample-agency/listings.ts).
//
// Per-listing narration: each listing card's About That player is pointed (about_that_url) at
// that listing's own detail page, so it narrates THAT home — not the whole agency page. The
// card CTA links there too.
//
// Fictional agency, not a real firm — kept noindex; the value is the click-through from
// /realtors, not search.

import Link from 'next/link';
import SiteHeader from '@/components/site/site-header';
import RenderAgentRoster from '@/components/admin/templates/render-blocks/agent-roster';
import RenderListingCard from '@/components/admin/templates/render-blocks/listing-card';
import { AGENCY, AGENTS, LISTINGS, DEMO_EMBED, SITE_BASE } from './listings';

export const metadata = {
  title: 'Cedar & Vine Realty — a sample agency site with voiced agents | QuickSites',
  description:
    'A live sample real-estate AGENCY site: a roster of agents who each introduce themselves and their listings in their own “About That” voice — the kind of site QuickSites builds for a whole brokerage.',
  robots: { index: false, follow: true },
};

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
            <span className="font-semibold">Live demo.</span> Tap ▶ on a listing to hear the agent describe <em>that home</em>; tap an agent to hear them introduce themselves.
          </div>
        </div>

        {/* Roster — the new agent_roster block */}
        <div id="team" className="scroll-mt-20">
          <RenderAgentRoster content={AGENTS} />
        </div>

        {/* Featured listings — the real listing_card block, each narrated by its OWN detail page */}
        <section id="listings" className="scroll-mt-20 pt-2">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Featured listings</h2>
          </div>
          {LISTINGS.map((l) => (
            <RenderListingCard
              key={l.slug}
              content={{
                headline: l.headline,
                address: l.address,
                price: l.price,
                status: l.status,
                beds: l.beds,
                baths: l.baths,
                sqft: l.sqft,
                description: l.description,
                images: l.images,
                cta_text: l.cta_text,
                cta_link: `/realtors/sample-agency/${l.slug}`,
                about_that_embed_id: DEMO_EMBED,
                // Ground the voice at THIS listing's detail page → it narrates this home, not the page.
                about_that_url: `${SITE_BASE}/realtors/sample-agency/${l.slug}`,
              }}
            />
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
