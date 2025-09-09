// components/cart/CheckoutPageClient.tsx
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Apple, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CartSummary from '@/app/cart/checkout/page';
import { useCartStore } from '@/components/cart/cart-store';

/* ----------------------- tiny validators ----------------------- */
function onlyDigits(s: string) { return s.replace(/\D+/g, ''); }

function luhnOk(num: string) {
  let sum = 0, dbl = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = Number(num[i]);
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d; dbl = !dbl;
  }
  return sum % 10 === 0;
}

function expiryOk(mmYY: string) {
  const m = mmYY.match(/^(\d{2})\s*\/\s*(\d{2})$/);
  if (!m) return false;
  const mm = Number(m[1]), yy = Number(m[2]);
  if (mm < 1 || mm > 12) return false;
  const now = new Date();
  const curYY = now.getFullYear() % 100;
  const curMM = now.getMonth() + 1;
  if (yy < curYY) return false;
  if (yy === curYY && mm < curMM) return false;
  return true;
}
function cvcOk(cvc: string) { return /^\d{3,4}$/.test(cvc); }
function emailOk(e: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

/* ----------------------- helpers ----------------------- */
function makeOrderId() {
  // QS-<base36 timestamp>-<4 rand>
  return `QS-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
}

/* ----------------------- component ----------------------- */
export default function CheckoutPageClient() {
  // SSR-safe selectors
  const merchantId = useCartStore((s) => s.merchantId || '');
  const subtotalCents = useCartStore((s) => s.subtotalCents || 0);
  const items = useCartStore((s) => s.items);

  const isEmpty = !items.length || subtotalCents <= 0;
  const router = useRouter();

  // Card form state
  const [name, setName] = React.useState('');
  const [card, setCard] = React.useState('');
  const [expiry, setExpiry] = React.useState('');
  const [cvc, setCvc] = React.useState('');
  const [email, setEmail] = React.useState('');

  // Processing state
  const [processing, setProcessing] = React.useState(false);
  const [expressProcessing, setExpressProcessing] = React.useState<null | 'apple' | 'google'>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const backToCart = React.useCallback(() => {
    const path = window.location.pathname;
    const m = path.match(/^\/sites\/([^/]+)/);
    if (m) router.push(`/sites/${m[1]}/cart`);
    else router.push('/cart');
  }, [router]);

  const routeToThankYou = React.useCallback((orderId?: string | null) => {
    const path = window.location.pathname;
    const m = path.match(/^\/sites\/([^/]+)/);
    const q = orderId ? `?order=${encodeURIComponent(orderId)}` : '';
    if (m) router.push(`/sites/${m[1]}/thank-you${q}`);
    else router.push(`/thank-you${q}`);
  }, [router]);

  /* ----------------------- Express checkout ----------------------- */
  const expressPay = React.useCallback(
    async (provider: 'apple' | 'google') => {
      if (isEmpty) return;
      setErr(null);
      setExpressProcessing(provider);

      try {
        window.dispatchEvent(new CustomEvent('qs:checkout:express', {
          detail: { provider, merchantId, subtotalCents, items },
        }));
      } catch {}

      // fake authorization & capture
      await new Promise((r) => setTimeout(r, 900));

      const orderId = makeOrderId();
      // stash receipt snapshot
      try {
        sessionStorage.setItem('qs_last_order', JSON.stringify({
          id: orderId,
          provider,
          merchantId,
          subtotalCents,
          items,
          email: null,
          ts: Date.now(),
        }));
      } catch {}

      try {
        window.dispatchEvent(new CustomEvent('qs:checkout:complete', {
          detail: { provider, merchantId, subtotalCents, items, email: null, orderId },
        }));
      } catch {}

      routeToThankYou(orderId);
    },
    [isEmpty, merchantId, subtotalCents, items, routeToThankYou],
  );

  /* ----------------------- Standard card checkout ----------------------- */
  const payNow = React.useCallback(async () => {
    setErr(null);

    const cc = onlyDigits(card);
    if (!name.trim()) return setErr('Name on card is required.');
    if (cc.length < 12 || !luhnOk(cc)) return setErr('Please enter a valid card number.');
    if (!expiryOk(expiry)) return setErr('Expiry must be a valid future MM/YY.');
    if (!cvcOk(cvc)) return setErr('CVC must be 3–4 digits.');
    if (!emailOk(email)) return setErr('Please enter a valid email for the receipt.');

    setProcessing(true);

    try {
      window.dispatchEvent(new CustomEvent('qs:checkout:confirm', {
        detail: { merchantId, subtotalCents, items, email },
      }));
    } catch {}

    await new Promise((r) => setTimeout(r, 1200));

    const orderId = makeOrderId();
    // stash receipt snapshot
    try {
      sessionStorage.setItem('qs_last_order', JSON.stringify({
        id: orderId,
        provider: 'card',
        merchantId,
        subtotalCents,
        items,
        email,
        ts: Date.now(),
        name,
        last4: onlyDigits(card).slice(-4),
      }));
    } catch {}

    try {
      window.dispatchEvent(new CustomEvent('qs:checkout:complete', {
        detail: { merchantId, subtotalCents, items, email, orderId },
      }));
    } catch {}

    routeToThankYou(orderId);
  }, [card, cvc, email, expiry, items, merchantId, name, routeToThankYou, subtotalCents]);

  // input masks
  const onCardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const d = onlyDigits(e.target.value).slice(0, 19);
    const parts = d.match(/.{1,4}/g) || [];
    setCard(parts.join(' '));
  };
  const onExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const d = onlyDigits(e.target.value).slice(0, 4);
    if (d.length <= 2) setExpiry(d);
    else setExpiry(`${d.slice(0, 2)}/${d.slice(2)}`);
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="outline" onClick={backToCart} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to cart
        </Button>
        <h1 className="text-xl font-semibold">Checkout</h1>
        <div className="w-[110px]" /> {/* spacer */}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left: Payment form + Express */}
        <div className="space-y-4">
          {/* Express checkout */}
          <div className="rounded-xl border p-3">
            <div className="mb-2 text-sm font-medium">Express checkout</div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1 gap-2"
                onClick={() => expressPay('apple')}
                disabled={isEmpty || expressProcessing !== null || processing}
                aria-disabled={isEmpty || expressProcessing !== null || processing}
                title={isEmpty ? 'Add an item to checkout' : 'Pay with Apple Pay (demo)'}
              >
                {expressProcessing === 'apple' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Apple className="h-4 w-4" />
                )}
                Apple&nbsp;Pay
              </Button>

              <Button
                variant="secondary"
                className="flex-1 gap-2"
                onClick={() => expressPay('google')}
                disabled={isEmpty || expressProcessing !== null || processing}
                aria-disabled={isEmpty || expressProcessing !== null || processing}
                title={isEmpty ? 'Add an item to checkout' : 'Pay with Google Pay (demo)'}
              >
                {expressProcessing === 'google' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4" />
                )}
                Google&nbsp;Pay
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Demo buttons — no real payment. Proceeds directly to Thank You.
            </p>
          </div>

          {/* Card form */}
          <div className="rounded-xl border p-4 space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Name on card</label>
              <input
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="cc-name"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Card number</label>
              <input
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm tracking-widest"
                placeholder="4242 4242 4242 4242"
                value={card}
                onChange={onCardChange}
                inputMode="numeric"
                autoComplete="cc-number"
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">Expiry (MM/YY)</label>
                <input
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  placeholder="12/29"
                  value={expiry}
                  onChange={onExpiryChange}
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  maxLength={5}
                />
              </div>
              <div className="w-28">
                <label className="text-xs text-muted-foreground">CVC</label>
                <input
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  placeholder="123"
                  value={cvc}
                  onChange={(e) => setCvc(onlyDigits(e.target.value).slice(0, 4))}
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  maxLength={4}
                />
              </div>
            </div>

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

            {err && (
              <div className="rounded-md border border-red-600/40 bg-red-950/30 px-3 py-2 text-xs text-red-300">
                {err}
              </div>
            )}

            <Button
              className="w-full justify-center gap-2"
              disabled={processing || isEmpty || expressProcessing !== null}
              aria-disabled={processing || isEmpty || expressProcessing !== null}
              onClick={payNow}
              title={isEmpty ? 'Add an item to checkout' : 'Pay now'}
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {processing ? 'Processing…' : `Pay $${(subtotalCents / 100).toFixed(2)}`}
            </Button>

            <p className="text-[11px] text-muted-foreground">
              This is a demo payment. No card is charged; the next screen will confirm your order and clear your cart.
            </p>
          </div>
        </div>

        {/* Right: Order summary (items, steppers, totals, coupon chip) */}
        <div className="rounded-xl border p-4">
          <CartSummary merchantId={merchantId} subtotalCents={subtotalCents} />
        </div>
      </div>
    </div>
  );
}
