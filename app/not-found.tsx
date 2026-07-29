// app/not-found.tsx
//
// The 404 is the one page where the visitor is, by definition, lost — so it hands them the
// whole map instead of a "Go Home" button. Mesh advisory: crosstalk 20260727-015522.
//
// Before this, quicksites.ai served the bare Next.js default: "404 | This page could not be
// found", black, no route back into the product. PorchHearth found the same gap on their side
// and made the point that stuck: the painterly image is the garnish, THE MAP IS THE VALUE.
// So this is built to work with or without the image — if public/brand/404.webp is absent the
// background is simply a gradient and every link still works.
import type { Metadata } from 'next';
import Link from 'next/link';
import SiteMapExplorer from '@/components/site/sitemap-explorer';

export const metadata: Metadata = {
  title: 'Page not found — QuickSites',
  // A 404 must never be indexed; it would compete with the real pages for its own keywords.
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      {/* Painterly backdrop — a committed build-artifact, not a bucket fetch, so it versions
          with this file and has no runtime dependency (painterly recipe, page-level case). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-40"
        style={{ backgroundImage: 'url(/brand/404.webp)' }}
      />
      {/* Legibility scrim. The image is decorative; the text must win regardless of how the
          render came out — a dark corner in the painting must never eat a link. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-zinc-950/85 via-zinc-950/75 to-zinc-950/95"
      />

      <div className="relative mx-auto max-w-5xl px-6 py-16 sm:py-24">
        <p className="text-sm font-medium uppercase tracking-widest text-sky-300/80">404</p>
        <h1 className="mt-3 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-5xl">
          This page moved, or never existed.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-zinc-300">
          Either way it&rsquo;s our job to get you unstuck, not to tell you off. Here&rsquo;s
          everything on the site — search it, or pick a door.
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-lg bg-sky-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-sky-400"
          >
            Go home
          </Link>
          <Link
            href="/build"
            className="rounded-lg border border-sky-400/40 px-5 py-2.5 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/10"
          >
            Build a site free
          </Link>
          <Link
            href="/contact"
            className="rounded-lg border border-white/15 px-5 py-2.5 text-sm font-semibold text-zinc-200 transition hover:bg-white/5"
          >
            Tell us what broke
          </Link>
        </div>

        <div className="mt-12 rounded-2xl border border-white/10 bg-black/30 p-5 backdrop-blur sm:p-7">
          <SiteMapExplorer />
        </div>
      </div>
    </main>
  );
}
