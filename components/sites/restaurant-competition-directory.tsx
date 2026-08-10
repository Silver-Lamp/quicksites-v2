// components/sites/restaurant-competition-directory.tsx
//
// Public diner-facing directory that fronts a restaurant domain-competition apex
// (<city>-restaurant.com). Lists the cohort restaurants, WINNER featured up top. No
// "competition" framing is shown to diners — it reads as a clean local-restaurant
// directory. Server component. See [[restaurant-domain-competition]].
import RestaurantInitials from '@/components/sites/restaurant-initials';
import Link from 'next/link';
import type { CompetitionDirectory } from '@/lib/outreach/restaurantCompetitionDirectory';

function Card({
  entry,
  featured,
}: {
  entry: CompetitionDirectory['entries'][number];
  featured?: boolean;
}) {
  return (
    <Link
      href={entry.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group block overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 transition hover:border-amber-500/50 hover:bg-zinc-900 ${
        featured ? 'sm:col-span-2' : ''
      }`}
    >
      <div className={`relative w-full overflow-hidden bg-zinc-800 ${featured ? 'aspect-[2/1]' : 'aspect-[3/2]'}`}>
        {entry.heroUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.heroUrl}
            alt={entry.businessName}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <RestaurantInitials name={entry.businessName} />
        )}
        {entry.isWinner && (
          <span className="absolute left-3 top-3 rounded-full bg-amber-500 px-2.5 py-1 text-xs font-semibold text-zinc-950 shadow">
            ★ Featured
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className={`truncate font-semibold text-white ${featured ? 'text-lg' : 'text-base'}`}>
            {entry.businessName}
          </div>
          {!entry.published && (
            <div className="mt-0.5 text-[11px] text-zinc-500">Opening soon</div>
          )}
        </div>
        <span className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-zinc-950 transition group-hover:bg-amber-400">
          Order →
        </span>
      </div>
    </Link>
  );
}

export default function RestaurantCompetitionDirectory({
  dir,
  compact = false,
}: {
  dir: CompetitionDirectory;
  /** True when rendered BELOW an apex template's own hero (site_type='restaurant_apex')
   *  — skips the directory's h1 section so the page doesn't stack two heroes. */
  compact?: boolean;
}) {
  const place = [dir.city, dir.region].filter(Boolean).join(', ');
  const featured = dir.hasWinner ? dir.entries.find((e) => e.isWinner) ?? null : null;
  const rest = featured ? dir.entries.filter((e) => e.templateId !== featured.templateId) : dir.entries;
  // Unlinked, footer-only attribution: a text-only "powered by" note is the SEO-safe
  // pattern across a network of <city>-restaurant.com domains (no sitewide followed
  // links back to one domain, no repeated hero boilerplate).
  const brand = process.env.NEXT_PUBLIC_MENU_BASE_DOMAIN || 'QuickSites';

  return (
    <div className={compact ? 'bg-zinc-950 text-white' : 'min-h-screen bg-zinc-950 text-white'}>
      {!compact && (
        <section className="relative mx-auto max-w-5xl px-6 pt-14 pb-8 text-center">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -top-16 left-1/2 h-64 w-[32rem] -translate-x-1/2 rounded-full bg-amber-500/15 blur-3xl" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight md:text-5xl">
            {place ? `Order from restaurants in ${place}` : 'Order from local restaurants'}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-zinc-400">
            Tap a restaurant to see the menu and order online — straight from the kitchen.
          </p>
        </section>
      )}

      <section className={`mx-auto max-w-5xl px-6 pb-16 ${compact ? 'pt-10' : ''}`}>
        {dir.entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 px-6 py-16 text-center text-zinc-500">
            Restaurants are being added here soon.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {featured && <Card entry={featured} featured />}
            {rest.map((e) => (
              <Card key={e.templateId} entry={e} />
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-zinc-800/70 py-6 text-center text-xs text-zinc-600">
        {place ? `${place} restaurants` : 'Local restaurants'} · order online, powered by {brand}
      </footer>
    </div>
  );
}
