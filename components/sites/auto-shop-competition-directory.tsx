// components/sites/auto-shop-competition-directory.tsx
//
// Public directory that fronts an auto-shop competition apex (<city>-auto-repair.com).
// Driver-facing: "trusted auto shops in {city}" — the SecondSet transparency wedge ("shops
// that show you the work"). The competition WINNER is featured; the rest of the cohort is
// listed. No "competition" framing shown to drivers. Server component.

import type { AutoShopDirectory } from '@/lib/outreach/autoShopCompetitionDirectory';
import { SECONDSET_ENABLED } from '@/lib/flags/secondset';

export default function AutoShopCompetitionDirectory({ dir }: { dir: AutoShopDirectory }) {
  // Server component — the flag is read server-side, so this never ships an unfulfilled promise.
  const secondsetLive = SECONDSET_ENABLED;
  const place = dir.region ? `${dir.city}, ${dir.region}` : dir.city;
  const entries = dir.entries;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="text-center">
        <p className="text-xs uppercase tracking-widest text-zinc-500">Auto repair · {place}</p>
        <h1 className="mt-2 text-3xl font-bold md:text-4xl">Trusted auto shops in {place}</h1>
        <p className="mx-auto mt-3 max-w-xl text-zinc-500">
          {/* ⚠️ TWO SUBHEADS, AND WHICH ONE SHOWS IS NOT A STYLE CHOICE.
              The SecondSet line describes a capability behind SECONDSET_ENABLED, which is OFF. On a
              domain we have bought and are actively sending mechanics to, promising a photo-of-the-
              actual-problem flow that does not exist is the same failure as the scaffold FAQ that
              asserted a stranger's business was "fully licensed and insured" (#787) — a claim the
              reader can rely on and we cannot honour.
              The default line says only what the page verifiably does: these shops are real, local,
              and have no website of their own. */}
          {secondsetLive ? (
            <>
              Shops that <span className="font-semibold text-zinc-700">show you the work</span> — a photo
              of the actual problem and the tech&apos;s note, so you approve the repair before it happens.
            </>
          ) : (
            <>
              Independent shops in {place}, each with their own page — hours, directions and a phone
              number that rings the shop. No booking fees, no middleman.
            </>
          )}
        </p>
      </header>

      {entries.length === 0 ? (
        <p className="mt-10 text-center text-zinc-500">Shops are being added — check back soon.</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((e) => (
            <a
              key={e.templateId}
              href={e.url}
              className={`group block overflow-hidden rounded-2xl border transition hover:shadow-lg ${
                e.isWinner ? 'border-emerald-400 bg-emerald-50/40 sm:col-span-2' : 'border-zinc-200 bg-white'
              }`}
            >
              {e.heroUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={e.heroUrl} alt={e.businessName} className={`w-full object-cover ${e.isWinner ? 'h-56' : 'h-40'}`} />
              ) : (
                <div className={`flex w-full items-center justify-center bg-zinc-100 text-4xl ${e.isWinner ? 'h-56' : 'h-40'}`}>🔧</div>
              )}
              <div className="p-4">
                {e.isWinner ? (
                  <span className="inline-block rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-semibold text-white">★ Featured</span>
                ) : null}
                <div className="mt-1 text-lg font-semibold">{e.businessName}</div>
                <div className="mt-0.5 text-sm text-emerald-700 group-hover:underline">Visit shop →</div>
              </div>
            </a>
          ))}
        </div>
      )}

      <footer className="mt-12 text-center text-xs text-zinc-400">
        {dir.domain}
        {secondsetLive ? ' · shops on this page show their work with SecondSet.' : ''}
      </footer>
    </main>
  );
}
