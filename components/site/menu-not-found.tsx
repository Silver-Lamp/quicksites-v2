// components/site/menu-not-found.tsx
//
// The 404 a visitor sees on delivered.menu.
//
// ⚠️ THE PLATFORM 404 IS THE WRONG PAGE HERE, AND NOT BECAUSE OF BRANDING. The QuickSites 404
// hands the visitor "the whole map" — Build a site free, Resell QuickSites, a sitemap of the
// product — which is exactly right for someone lost on quicksites.ai and exactly wrong for
// someone who mistyped a restaurant's name. That person is hungry, not shopping for a website
// builder, and answering them with a sales page is the same category error as a restaurant's own
// address selling reseller plans.
//
// So this page does one thing: get them to a restaurant. The only outward link is the directory.

import Link from 'next/link';

export default function MenuNotFound({ attempted }: { attempted?: string | null }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-16 text-zinc-100">
      <div className="w-full max-w-lg text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-amber-300/80">
          Not found
        </p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
          No restaurant at this address.
        </h1>
        <p className="mt-4 text-lg text-zinc-300">
          {attempted ? (
            <>
              We don&rsquo;t have a menu for{' '}
              <span className="font-mono text-zinc-100">{attempted}</span> — it may have moved, or
              the address may have a typo.
            </>
          ) : (
            <>The page may have moved, or the address may have a typo.</>
          )}
        </p>

        <div className="mt-8">
          <Link
            href="/"
            className="inline-block rounded-lg bg-amber-400 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300"
          >
            Browse local restaurants
          </Link>
        </div>

        {/* ⚠️ Deliberately the ONLY mention of us, and deliberately not a pitch. An owner who
            recognises their own restaurant is missing needs somewhere to go; a diner does not
            need to know who built the site. */}
        <p className="mt-10 text-sm text-zinc-500">
          Run a restaurant that should be here?{' '}
          <a
            href="https://www.quicksites.ai/restaurants"
            className="underline decoration-zinc-600 underline-offset-4 hover:text-zinc-300"
          >
            Add it
          </a>
          .
        </p>
      </div>
    </main>
  );
}
