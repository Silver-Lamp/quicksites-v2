// app/rebuild/page.tsx
// Public "AI rebuild" lead magnet. Paste any business site → get a fresh QuickSites
// draft. Doubles as a reseller sales demo (prefill ?url= to open on a client's site).
import Link from 'next/link';
import SiteHeader from '@/components/site/site-header';
import RebuildTool from '@/components/rebuild/rebuild-tool';
import { marketingOg } from '@/lib/marketingOg';

export const metadata = marketingOg({
  title: 'Rebuild any website free — QuickSites',
  description:
    "Paste a business website and we'll regenerate it as a fresh, editable QuickSites draft in seconds. Free, no signup — perfect for agencies migrating clients.",
  path: '/rebuild',
  ogEyebrow: 'AI rebuild',
  ogTitle: 'Rebuild any site in seconds.',
  ogSubtitle: 'Paste a URL — get a fresh, editable QuickSites draft. Free, no signup.',
});

export default async function RebuildPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  const sp = await searchParams;
  const initialUrl = typeof sp?.url === 'string' ? sp.url : '';

  return (
    <>
      <SiteHeader sticky />
      <div className="relative min-h-screen bg-zinc-950 text-white">
        <section className="mx-auto flex max-w-4xl flex-col items-center px-6 pt-16 pb-12 text-center">
          <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-300">
            AI rebuild · free
          </span>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight md:text-6xl">
            Rebuild any website
            <span className="block bg-gradient-to-r from-sky-400 to-sky-200 bg-clip-text text-transparent">
              in seconds.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-zinc-400">
            Paste a business's current website. We read it, understand the business, and generate a
            fresh, fully-editable QuickSites draft — copy, services, and layout included. No importer,
            no rebuild-from-scratch.
          </p>

          <RebuildTool initialUrl={initialUrl} />

          <p className="mt-6 max-w-xl text-sm text-zinc-500">
            Migrating clients from Wix, WordPress, or a flat-fee builder? This is the fast lane —
            generate the new version, tweak it, publish.
          </p>
        </section>

        {/* For agencies */}
        <section className="border-t border-zinc-800/70 bg-zinc-950/60">
          <div className="mx-auto max-w-5xl px-6 py-14">
            <h2 className="text-center text-2xl font-semibold md:text-3xl">Built for people who host for others</h2>
            <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
                <h3 className="font-semibold text-white">Migrate without the grind</h3>
                <p className="mt-2 text-sm text-zinc-400">
                  Don't hand-rebuild a client's site. Point us at their live URL and start from a working draft.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
                <h3 className="font-semibold text-white">Close deals live</h3>
                <p className="mt-2 text-sm text-zinc-400">
                  On a sales call? Rebuild the prospect's site on the spot and show them the upgrade in real time.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
                <h3 className="font-semibold text-white">Earn on every sale</h3>
                <p className="mt-2 text-sm text-zinc-400">
                  Unlike flat-fee builders, you keep a share of every order your merchants process —{' '}
                  <Link href="/partners/calculator" className="text-sky-400 underline underline-offset-2 hover:text-sky-300">
                    run the numbers
                  </Link>.
                </p>
              </div>
            </div>
            <div className="mt-10 text-center">
              <Link
                href="/partners/resellers"
                className="rounded-lg bg-sky-500 px-7 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-sky-400"
              >
                See the reseller program →
              </Link>
            </div>
          </div>
        </section>

        <footer className="border-t border-zinc-800/70 py-6 text-center text-xs text-zinc-600">
          &copy; {new Date().getFullYear()} QuickSites.ai —{' '}
          <Link href="/" className="underline hover:text-zinc-300">Home</Link>
          <span className="mx-1">•</span>
          <Link href="/partners" className="underline hover:text-zinc-300">Partners</Link>
          <span className="mx-1">•</span>
          <Link href="/compare" className="underline hover:text-zinc-300">Compare</Link>
        </footer>
      </div>
    </>
  );
}
