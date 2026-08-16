// components/cart/CheckoutPageClient.tsx
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CartSummary from '@/app/cart/checkout/page';
import { useCartStore } from '@/components/cart/cart-store';
import VenmoPay from '@/components/sites/venmo-pay';
import type { MenuIconSet } from '@/lib/menu/foodIcons';

/* ----------------------- tiny validators ----------------------- */
function emailOk(e: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

/* ----------------------- component ----------------------- */
export default function CheckoutPageClient({ venmoHandle, iconSet = 'none' }: { venmoHandle?: string | null; iconSet?: MenuIconSet } = {}) {
  // SSR-safe selectors
  const merchantId = useCartStore((s) => s.merchantId || '');
  const subtotalCents = useCartStore((s) => s.subtotalCents || 0);
  const items = useCartStore((s) => s.items);

  const isEmpty = !items.length || subtotalCents <= 0;
  const router = useRouter();

  const [email, setEmail] = React.useState('');

  // Processing state
  const [processing, setProcessing] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const backToCart = React.useCallback(() => {
    const path = window.location.pathname;
    const m = path.match(/^\/sites\/([^/]+)/);
    if (m) router.push(`/sites/${m[1]}/cart`);
    else router.push('/cart');
  }, [router]);

  const continueShopping = React.useCallback(() => {
    const path = window.location.pathname;
    const m = path.match(/^\/sites\/([^/]+)/);
    router.push(m ? `/sites/${m[1]}` : '/');
  }, [router]);

  const routeToThankYou = React.useCallback((orderId?: string | null) => {
    const path = window.location.pathname;
    const m = path.match(/^\/sites\/([^/]+)/);
    const q = orderId ? `?order=${encodeURIComponent(orderId)}` : '';
    if (m) router.push(`/sites/${m[1]}/thank-you${q}`);
    else router.push(`/thank-you${q}`);
  }, [router]);

  /* ----------------------- Real card checkout (Stripe) -----------------------
   *
   * ⚠️ THIS USED TO BE A SIMULATION ON A LIVE SITE. It collected a card number, waited
   * 1200ms, minted a client-side order id and routed to a receipt that said "Total paid".
   * No API call, no order row, no charge — verified against the database after a $5.00
   * "order" appeared on the lemonade stand.
   *
   * Two things are now true that were not:
   *
   *   1. It calls the real money path. POST /api/commerce/checkout reprices every line from
   *      catalog_items (authorizeCheckoutItems), computes the platform fee, creates the draft
   *      order and returns a Stripe Checkout URL. The client sends IDS AND QUANTITIES ONLY —
   *      a title or amount in the payload is ignored server-side, so nobody sets their own price.
   *
   *   2. WE NEVER TOUCH THE CARD. Stripe's hosted page collects it. The old form put a real PAN
   *      into our DOM and our state, which is a PCI obligation we have no business taking on for
   *      a $3 lemonade — and it was doing that to throw the number away.
   */
  const payNow = React.useCallback(async () => {
    setErr(null);

    if (!merchantId) return setErr('This site is not set up to take payments yet.');
    if (email && !emailOk(email)) return setErr('Please enter a valid email, or leave it blank.');

    const lineItems = items
      .map((it) => ({
        catalogItemId: it.catalog_item_id || it.id.split('::')[0],
        variantId: it.variant_id || undefined,
        addonIds: it.addon_ids?.length ? it.addon_ids : undefined,
        quantity: Number(it.qty) || 1,
      }))
      .filter((l) => l.catalogItemId);

    if (!lineItems.length) {
      return setErr('These items are not orderable yet. Ask the seller to enable ordering.');
    }

    setProcessing(true);
    try {
      window.dispatchEvent(new CustomEvent('qs:checkout:confirm', {
        detail: { merchantId, subtotalCents, items, email },
      }));
    } catch {}

    try {
      const slug = window.location.pathname.match(/^\/sites\/([^/]+)/)?.[1] ?? '';
      const res = await fetch('/api/commerce/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId,
          siteSlug: slug,
          items: lineItems,
          // Come back to THIS site's receipt rather than the platform one, and carry the
          // server's order id so the receipt can tell a real order from a demo.
          successUrl: `${window.location.origin}${slug ? `/sites/${slug}` : ''}/thank-you?order={ORDER_ID}`,
          cancelUrl: `${window.location.origin}${slug ? `/sites/${slug}` : ''}/checkout`,
        }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.checkoutUrl) {
        setProcessing(false);
        // Surface the server's own words — "Some items just sold out", "no active payment
        // account" — instead of a generic failure that tells the buyer nothing.
        setErr(json?.error || 'Could not start checkout. Please try again.');
        return;
      }

      // Snapshot for the receipt, stamped with the SERVER's order id. Its presence is what
      // lets the receipt claim payment; a demo run has no such id (see ThankYouPageClient).
      try {
        sessionStorage.setItem('qs_last_order', JSON.stringify({
          id: json.orderId,
          serverOrderId: json.orderId,
          provider: 'stripe',
          merchantId,
          subtotalCents: json.totalCents ?? subtotalCents,
          items,
          email: email || null,
          ts: Date.now(),
        }));
      } catch {}

      window.location.href = json.checkoutUrl;
    } catch (e: any) {
      setProcessing(false);
      setErr(e?.message || 'Could not reach the payment service.');
    }
  }, [email, items, merchantId, subtotalCents]);

  // Empty cart → don't strand the shopper on a disabled form.
  if (isEmpty) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        {/* Same header treatment as the populated state — see the note there. Two copies of one
            header is why the first fix only reached half of them. */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <Button variant="outline" onClick={backToCart} className="gap-2 shrink-0">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to cart</span>
            <span className="sm:hidden">Cart</span>
          </Button>
          <h1 className="text-lg font-semibold sm:text-xl">Checkout</h1>
          <div className="hidden w-[110px] sm:block" />
        </div>

        <div className="rounded-xl border p-10 text-center">
          <p className="text-sm text-muted-foreground">Your cart is empty — add something to check out.</p>
          <Button onClick={continueShopping} className="mt-4">
            Continue shopping
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      {/* The spacer exists to centre the title on a wide screen. On a phone it is 110px of
          nothing competing with a back button and a heading for ~320px — so it only exists
          from `sm` up, where there is width to spend on symmetry. */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <Button variant="outline" onClick={backToCart} className="gap-2 shrink-0">
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back to cart</span>
          <span className="sm:hidden">Cart</span>
        </Button>
        <h1 className="text-lg font-semibold sm:text-xl">Checkout</h1>
        <div className="hidden w-[110px] sm:block" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left: Payment form + Express */}
        <div className="space-y-4">
          {/* Payment.
              ⚠️ NO CARD FIELDS HERE, DELIBERATELY. This page used to collect a PAN, expiry and
              CVC into React state — a PCI obligation taken on for a $3 lemonade, in order to
              throw the number away. Stripe's hosted page collects it now; we never see it. */}
          <div className="rounded-xl border p-4 space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Email (receipt)</label>
              <input
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                inputMode="email"
                autoComplete="email"
              />
            </div>

            {/* ⚠️ `bg-red-950/30` + `text-red-300` was a DARK-ONLY pairing: near-black ground,
                pale text. On a light site that renders pale pink on pale pink — the error was
                literally unreadable, on the one element whose whole job is to be read, at the
                moment a payment just failed. Alpha tints read on either theme (CLAUDE.md §7),
                and `text-destructive` follows the site's own palette. */}
            {err && (
              <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                {err}
              </div>
            )}

            <Button
              className="w-full justify-center gap-2"
              disabled={processing || isEmpty}
              aria-disabled={processing || isEmpty}
              onClick={payNow}
              title={isEmpty ? 'Add an item to checkout' : 'Pay now'}
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {processing ? 'Taking you to Stripe…' : `Pay $${(subtotalCents / 100).toFixed(2)}`}
            </Button>

            <p className="text-[11px] text-muted-foreground">
              You&apos;ll be taken to Stripe to pay securely. Your card details never touch this site.
            </p>
          </div>
        </div>

        {/* Right: Order summary (items, steppers, totals, coupon chip) */}
        <div className="rounded-xl border p-4">
          <CartSummary merchantId={merchantId} subtotalCents={subtotalCents} iconSet={iconSet} />
        </div>
      </div>
    </div>
  );
}
