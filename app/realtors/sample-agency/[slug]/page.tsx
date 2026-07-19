// app/realtors/sample-agency/[slug]/page.tsx
//
// A single listing's detail page for the sample agency (Cedar & Vine Realty). This is the URL
// each agency-page listing card points its About That player at (about_that_url), so the voice
// narrates THIS home. The page is a single listing_card + readable property details/features
// (so About That's FAQ can answer "HOA? taxes? schools?" from page content) — mirroring
// /realtors/sample-listing, one per home.
//
// Fictional listings — noindex; the value is the click-through + the voice tour, not search.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import SiteHeader from '@/components/site/site-header';
import RenderListingCard from '@/components/admin/templates/render-blocks/listing-card';
import { AGENCY, LISTINGS, DEMO_EMBED, getListing } from '../listings';

export function generateStaticParams() {
  return LISTINGS.map((l) => ({ slug: l.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const l = getListing(slug);
  if (!l) return { title: `Listing — ${AGENCY.name}` };
  return {
    title: `${l.headline} — ${AGENCY.name}`,
    description: `${l.price} · ${l.beds} bd / ${l.baths} ba · ${l.address}. Hear the agent describe this home.`,
    robots: { index: false, follow: true },
  };
}

export default async function ListingDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const l = getListing(slug);
  if (!l) notFound();

  return (
    <>
      <SiteHeader sticky logoText={AGENCY.name} logoHref="/realtors/sample-agency" />
      <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-950 to-black text-zinc-100">
        <div className="mx-auto max-w-5xl px-4 pt-8">
          <Link href="/realtors/sample-agency" className="text-sm text-emerald-300 hover:text-emerald-200">
            ← Back to {AGENCY.name}
          </Link>
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            <span className="font-semibold">Listed by {l.agent}.</span> Tap ▶ on “🎙️ Hear about this home” to hear the agent describe this listing.
          </div>
        </div>

        {/* The real listing_card block — about_that_url blank, so it narrates THIS page (this home). */}
        <RenderListingCard
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
            cta_link: 'mailto:hello@example.com?subject=Showing%20request',
            about_that_embed_id: DEMO_EMBED,
            about_that_url: '',
          }}
        />

        {/* Readable details + features — what lets About That's FAQ answer HOA / taxes / schools. */}
        <section className="mx-auto w-full max-w-5xl px-4 py-2">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Property details</h3>
              <dl className="mt-3 divide-y divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-900/40">
                {l.details.map(([label, value]) => (
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
                {l.features.map((f) => (
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
          <Link
            href="/realtors/sample-agency#listings"
            className="inline-flex rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-2.5 text-sm font-semibold text-emerald-300 transition hover:border-emerald-400 hover:bg-emerald-500/20"
          >
            ← See all {AGENCY.name} listings
          </Link>
          <p className="mt-6 text-xs text-zinc-600">Sample listing — not a real property. For demonstration only.</p>
        </div>
      </main>
    </>
  );
}
