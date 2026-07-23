// components/sites/auto-shop-competition-directory.tsx
//
// Public directory that fronts an auto-shop competition apex (<city>-auto-repair.com).
// Driver-facing: "trusted auto shops in {city}" — the SecondSet transparency wedge ("shops
// that show you the work"). The competition WINNER is featured; the rest of the cohort is
// listed. No "competition" framing shown to drivers. Server component.

import type { AutoShopDirectory } from '@/lib/outreach/autoShopCompetitionDirectory';

export default function AutoShopCompetitionDirectory({ dir }: { dir: AutoShopDirectory }) {
  const place = dir.region ? `${dir.city}, ${dir.region}` : dir.city;
  const entries = dir.entries;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="text-center">
        <p className="text-xs uppercase tracking-widest text-zinc-500">Auto repair · {place}</p>
        <h1 className="mt-2 text-3xl font-bold md:text-4xl">Trusted auto shops in {place}</h1>
        <p className="mx-auto mt-3 max-w-xl text-zinc-500">
          Shops that <span className="font-semibold text-zinc-700">show you the work</span> — a photo of
          the actual problem and the tech&apos;s note, so you approve the repair before it happens.
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
        {dir.domain} · shops on this page show their work with SecondSet.
      </footer>
    </main>
  );
}
