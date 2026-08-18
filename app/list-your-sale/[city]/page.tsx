// app/list-your-sale/[city]/page.tsx
//
// "List your yard sale in <city>" — the SELLER-intent city page.
//
// ⚠️ WHAT THIS PAGE MAY AND MAY NOT PROMISE. It offers a free page for your sale, which is a thing
// we deliver the moment you fill the form in. It must never promise shoppers: the directory is
// empty, and a seller who reads "more buyers will find you" and gets none has been mis-sold — in a
// hyperlocal market that seller is also the only distribution there is. See
// docs/YARDSALE_TOOL_HANDOFF.md §1. That is why the buyer query, which has ~100× the volume, is
// deliberately NOT what these pages target.
//
// ⚠️ EVERYTHING CITY-SPECIFIC HERE IS TRUE BY CONSTRUCTION. The city name, its county, its real
// adjacent cities, and the sales actually listed there. Nothing is invented to make the page feel
// local — an invented local detail on a page carrying a real place name is the same class of
// dishonesty as the invented menus (CLAUDE.md §5b). When there is nothing local to say, the page
// says less rather than more.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import SiteHeader from '@/components/site/site-header';
import YardSaleSurface from '@/components/garage-sales/yard-sale-surface';
import { ActivateForm } from '@/app/s/[code]/sticker-client';
import { YARD_SALE_CITIES, findCity, neighborsOf, cityLabel } from '@/lib/yardSale/cities';
import { listSales } from '@/lib/garageSales/sales';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// See the same constant on /garage-sales: the shared header is dark-only and `sticky` makes it
// translucent, which is illegible over this light surface.
const HEADER_ON_LIGHT = 'bg-zinc-950 border-zinc-800';

/** Only these five render; anything else 404s rather than generating a page on demand. */
export function generateStaticParams() {
  return YARD_SALE_CITIES.map((c) => ({ city: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city: slug } = await params;
  const c = findCity(slug);
  if (!c) return { title: 'Yard sales', robots: { index: false, follow: false } };
  const label = cityLabel(c);
  return {
    // Seller intent, stated plainly. No "near me", no shopper claim.
    title: `List your yard sale in ${label} — free page, no account | YardSaleSites`,
    description: `Make a free page for your ${c.city} yard or garage sale: what you're selling, when, and where. Share the link in one text and print a sign with a QR code. No sticker, no account, no fee.`,
    alternates: { canonical: `https://yardsalesites.com/list-your-sale/${c.slug}` },
    openGraph: {
      title: `List your yard sale in ${label}`,
      description: 'A free page for your sale that you can text to anyone.',
      url: `https://yardsalesites.com/list-your-sale/${c.slug}`,
      type: 'website',
    },
  };
}

export default async function ListYourSaleInCity({ params }: { params: Promise<{ city: string }> }) {
  const { city: slug } = await params;
  const c = findCity(slug);
  if (!c) notFound();

  const label = cityLabel(c);
  const neighbors = neighborsOf(c);

  // Sales actually listed here. Today this is empty everywhere — and the page is written so that
  // the empty case reads as a fact rather than a failure, the same way the directory does.
  const all = await listSales({ limit: 60 });
  const local = all.filter(({ sale }) => (sale.address.city ?? '').toLowerCase() === c.city.toLowerCase());

  return (
    <>
      <SiteHeader sticky className={HEADER_ON_LIGHT} />
      <YardSaleSurface>
        <section className="mx-auto max-w-2xl px-6 pt-14 pb-8">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {c.county} · {c.region}
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">
            List your yard sale in {label}
          </h1>
          <p className="mt-3 text-muted-foreground">
            Fill this in once and you get a link you can text to anyone, plus a printable sign with a
            QR code for the corner. It takes about a minute and costs nothing — no sticker, no
            account, no fee.
          </p>

          {/* ⚠️ Says what this does NOT do. The directory is real and thin; promising a crowd we
              cannot send is the one thing that would cost us the seller permanently. */}
          <p className="mt-4 rounded-lg border border-border bg-card/70 p-4 text-sm text-muted-foreground backdrop-blur-sm">
            <strong className="text-foreground">What this is:</strong> a page for your sale that
            works on its own — you share it. We also list it here, but this is a new listing in{' '}
            {c.city} and we are not going to promise you a crowd we cannot yet send.
          </p>
        </section>

        <section className="mx-auto max-w-2xl px-6 pb-10">
          <ActivateForm />
        </section>

        {local.length > 0 && (
          <section className="mx-auto max-w-2xl px-6 pb-10">
            <h2 className="text-lg font-semibold">Sales on in {c.city} right now</h2>
            <ul className="mt-3 space-y-2">
              {local.map(({ sale }) => (
                <li key={sale.id} className="text-sm">
                  {sale.stickerCode ? (
                    <Link href={`/s/${sale.stickerCode}`} className="text-foreground underline underline-offset-4">
                      {sale.title}
                    </Link>
                  ) : (
                    <span className="text-foreground">{sale.title}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {neighbors.length > 0 && (
          <section className="mx-auto max-w-2xl px-6 pb-20">
            <h2 className="text-sm font-semibold text-foreground">Nearby</h2>
            {/* True by construction: mutual adjacency is enforced by test, so "nearby" is not a
                claim this page is making up to look local. */}
            <p className="mt-2 text-sm text-muted-foreground">
              {neighbors.map((n, i) => (
                <span key={n.slug}>
                  {i > 0 && ' · '}
                  <Link href={`/list-your-sale/${n.slug}`} className="underline underline-offset-4 hover:text-foreground">
                    {n.city}
                  </Link>
                </span>
              ))}
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Or see{' '}
              <Link href="/garage-sales" className="underline underline-offset-4 hover:text-foreground">
                every sale on this week
              </Link>
              .
            </p>
          </section>
        )}
      </YardSaleSurface>
    </>
  );
}
