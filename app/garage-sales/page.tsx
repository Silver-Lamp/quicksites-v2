// app/garage-sales/page.tsx
//
// The public directory: garage sales happening in the next week.
//
// ⚠️ ADDRESSES HERE ARE BLOCK-LEVEL UNTIL THE SALE STARTS, and that is enforced in
// lib/garageSales/address.ts rather than here — this page renders whatever `publicAddress()`
// gives it and has no access to the precise line. Putting the rule in the page would mean the
// next surface that lists sales has to remember it.
//
// ⚠️ AND IT TELLS THE TRUTH WHEN IT IS EMPTY. The `delivered.menu` directory shipped a filter
// loose enough to advertise our own directory page and a demo template as "restaurants taking
// orders" — a public page promising something real while listing neither. The equivalent here
// would be padding a thin weekend with expired or unlisted sales. An empty directory is a fact
// about the weekend, not a bug to paper over, and a shopper who drives to a sale that isn't
// there does not come back.
import Link from 'next/link';
import type { Metadata } from 'next';
import SiteHeader from '@/components/site/site-header';
import { listSales } from '@/lib/garageSales/sales';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Targets the query the keyword planner shows demand for ("garage sales near me" /
// "yard sales near me", 10k–100k/mo, low competition), without claiming a coverage we do not
// have. Note what the copy does NOT say: not "every sale in your area", not "the biggest
// listing" — an empty week has to be able to say so (see the empty state below).
export const metadata: Metadata = {
  title: 'Garage sales near me — yard sales this weekend | YardSaleSites',
  description:
    'Find garage sales and yard sales happening near you this weekend. See what each sale has, when it starts, and where — updated as sellers list them.',
  alternates: { canonical: 'https://yardsalesites.com/' },
  openGraph: {
    title: 'Garage sales near me — yard sales this weekend',
    description: 'What’s for sale, when it starts, and where. Updated as sellers list them.',
    url: 'https://yardsalesites.com/',
    type: 'website',
  },
};

function when(startsAt: string, endsAt: string) {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  const day = s.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const t = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day}, ${t(s)}–${t(e)}`;
}

/**
 * ⚠️ A GARAGE SALE IS LITERALLY AN `Event`, AND THAT IS THE WHOLE SEO PLAY.
 *
 * Not `LocalBusiness` (it is not a business and does not persist) and not `Product` (the items
 * are incidental). Event is the schema Google renders date-and-place rich results from, which is
 * exactly the shape of a "garage sales near me" query — a person asking what is on, near them,
 * this weekend.
 *
 * Two things are deliberately absent. There is no `offers` block: a garage sale does not have a
 * price, and inventing one to fill a recommended field is the same dishonesty as the invented
 * menus. And `location` carries only what `publicAddress()` released — before the sale starts
 * that is the block, never the house number, so the structured data cannot leak what the page
 * itself withholds. Schema is a second surface for the same fact, not a bypass around the rule.
 */
function eventJsonLd(rows: Array<{ sale: any }>) {
  const items = rows.map(({ sale }, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    item: {
      '@type': 'Event',
      name: sale.title,
      description: sale.description || undefined,
      startDate: sale.startsAt,
      endDate: sale.endsAt,
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      location: {
        '@type': 'Place',
        name: sale.address.line || sale.address.city || 'Address given at start time',
        address: {
          '@type': 'PostalAddress',
          streetAddress: sale.address.line || undefined,
          addressLocality: sale.address.city || undefined,
          addressRegion: sale.address.state || undefined,
        },
      },
      url: sale.stickerCode ? `https://yardsalesites.com/${sale.stickerCode}` : undefined,
    },
  }));
  return { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: items };
}

export default async function GarageSalesPage() {
  // Server-rendered without a position: the browser's geolocation prompt belongs to a client
  // interaction, not a page load. Chronological is the honest default — see listSales().
  const sales = await listSales({ limit: 60 });

  return (
    <>
      <SiteHeader sticky />
      {/* Emitted only when there is something to describe. Structured data for an empty list is
          a claim about nothing, and Google treats a rich-result markup that renders no result as
          worse than no markup. */}
      {sales.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd(sales)) }}
        />
      )}
      <div className="min-h-screen bg-zinc-950 text-white">
        <section className="mx-auto max-w-3xl px-6 pt-14 pb-10">
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
            Garage sales near you this weekend
          </h1>
          <p className="mt-3 text-zinc-400">
            Yard and garage sales running in the next seven days — what each one has, when it
            starts, and where. Exact addresses appear when a sale begins.
          </p>
        </section>

        <section className="mx-auto max-w-3xl px-6 pb-20">
          {sales.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-center">
              <p className="text-zinc-300">No sales listed for the next week yet.</p>
              <p className="mt-2 text-sm text-zinc-500">
                If you&rsquo;re running one and someone handed you a sticker, scan it to get listed.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {sales.map(({ sale, miles }) => (
                <li key={sale.id} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
                  <div className="flex items-baseline justify-between gap-4">
                    <h2 className="text-lg font-semibold">
                      {sale.stickerCode ? (
                        <Link href={`/s/${sale.stickerCode}`} className="hover:underline">
                          {sale.title}
                        </Link>
                      ) : (
                        sale.title
                      )}
                    </h2>
                    {miles != null && (
                      <span className="flex-none text-sm tabular-nums text-zinc-500">{miles.toFixed(1)} mi</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-zinc-400">{when(sale.startsAt, sale.endsAt)}</p>
                  {sale.address.line && (
                    <p className="mt-1 text-sm text-zinc-400">
                      {sale.address.line}
                      {sale.address.city ? `, ${sale.address.city}` : ''}
                      {sale.address.state ? ` ${sale.address.state}` : ''}
                      {!sale.address.exact && <span className="ml-1 text-zinc-500">· exact address at start time</span>}
                    </p>
                  )}
                  {sale.description && <p className="mt-2 text-sm text-zinc-300">{sale.description}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
