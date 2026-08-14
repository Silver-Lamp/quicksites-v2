// app/s/[code]/page.tsx
//
// What a sticker scan lands on. ONE URL, three audiences, decided by the state of the code:
//
//   unknown   → probably a mistyped code. Offer the directory, not an error.
//   unclaimed → a real sticker in someone's hand. Offer to set the sale up, AND show sales
//               nearby — because a shopper can scan a sticker on a sign whose seller never
//               activated it, and "nothing here" would be a dead end at a live junction.
//   live      → the sale: what's for sale, and a way to pay.
//   ended     → say so plainly and point at what's on this weekend.
//
// noindex throughout: these are short-lived pages tied to a physical object, and a garage sale
// that finished in July has no business ranking in September.
import Link from 'next/link';
import type { Metadata } from 'next';
import { readSticker } from '@/lib/garageSales/sales';
import { normalizeCode, formatCode } from '@/lib/garageSales/codes';
import { listSales } from '@/lib/garageSales/sales';
import { ActivateForm, RingUp } from './sticker-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Garage sale',
  robots: { index: false, follow: false },
};

function money(cents: number | null) {
  return cents == null ? null : `$${(cents / 100).toFixed(2)}`;
}

function when(startsAt: string, endsAt: string) {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  const day = s.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const t = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day}, ${t(s)}–${t(e)}`;
}

export default async function StickerPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = normalizeCode(raw);
  const sticker = await readSticker(code);

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-xl px-5 py-10">{children}</div>
    </div>
  );

  if (sticker.state === 'unknown') {
    return shell(
      <div className="text-center">
        <h1 className="text-2xl font-semibold">We don’t recognise that code</h1>
        <p className="mt-2 text-muted-foreground">
          The sticker reads <strong className="text-foreground">{formatCode(code) || raw}</strong>. Codes never
          contain the letters O, I, L or U — those are easy to mistake for 0 and 1, so it may be worth another look.
        </p>
        <Link href="/garage-sales" className="mt-6 inline-block rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground">
          See garage sales near you
        </Link>
      </div>,
    );
  }

  if (sticker.state === 'unclaimed') {
    const nearby = await listSales({ limit: 5 });
    return shell(
      <>
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Sticker {formatCode(code)}
          </p>
          <h1 className="mt-3 text-2xl font-semibold">Is this your sale?</h1>
          <p className="mt-2 text-muted-foreground">
            Set it up in about a minute — list what you’re selling and let people pay by phone.
            Free, and the money goes straight to your own Venmo, Cash App or PayPal.
          </p>
        </div>

        <ActivateForm code={code} />

        {nearby.length > 0 && (
          <div className="mt-12 border-t border-border pt-8">
            <h2 className="text-lg font-semibold">Just looking for a sale?</h2>
            <ul className="mt-3 space-y-2">
              {nearby.map(({ sale }) => (
                <li key={sale.id}>
                  <Link href={`/garage-sales`} className="text-primary hover:underline">
                    {sale.title}
                  </Link>{' '}
                  <span className="text-sm text-muted-foreground">
                    — {sale.address.line ?? sale.address.city ?? 'nearby'}, {when(sale.startsAt, sale.endsAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </>,
    );
  }

  if (sticker.state === 'ended') {
    return shell(
      <div className="text-center">
        <h1 className="text-2xl font-semibold">{sticker.sale.title}</h1>
        <p className="mt-2 text-muted-foreground">This sale has finished.</p>
        <Link href="/garage-sales" className="mt-6 inline-block rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground">
          What’s on this weekend
        </Link>
      </div>,
    );
  }

  const { sale, items } = sticker;
  const forSale = items.filter((i) => !i.sold);

  return shell(
    <>
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{sale.title}</h1>
        <p className="mt-2 text-muted-foreground">{when(sale.startsAt, sale.endsAt)}</p>
        {sale.address.line && (
          <p className="mt-1 text-muted-foreground">
            {sale.address.line}
            {sale.address.city ? `, ${sale.address.city}` : ''}
            {sale.address.state ? ` ${sale.address.state}` : ''}
            {!sale.address.exact && (
              <span className="ml-1 text-sm">(exact address shows when the sale starts)</span>
            )}
          </p>
        )}
        {sale.description && <p className="mt-4 text-foreground">{sale.description}</p>}
      </header>

      {forSale.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">What’s here</h2>
          <ul className="mt-3 divide-y divide-border">
            {forSale.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-3">
                {i.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.imageUrl} alt="" className="h-14 w-14 flex-none rounded-lg object-cover" />
                )}
                <span className="flex-1">{i.name}</span>
                {money(i.priceCents) && <span className="tabular-nums text-muted-foreground">{money(i.priceCents)}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <RingUp handles={sale.handles} saleTitle={sale.title} />
      </section>

      <footer className="mt-10 text-center text-xs text-muted-foreground">
        <Link href="/garage-sales" className="hover:underline">
          Other garage sales near you
        </Link>
      </footer>
    </>,
  );
}
