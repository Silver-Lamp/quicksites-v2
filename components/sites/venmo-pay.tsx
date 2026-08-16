'use client';

import * as React from 'react';
import QRCode from 'react-qr-code';
import { venmoProfileUrl } from '@/lib/payments/venmo';

/**
 * "Pay with Venmo" — a direct link to the seller, with the platform not in the middle.
 *
 * ⚠️ TWO PEOPLE LOOK AT THIS AND THEY NEED DIFFERENT THINGS, so it renders both.
 *   • The seller, showing their phone or tablet at the stand → the QR is the whole point.
 *   • The buyer, already holding their own phone on this page → a QR is useless (you cannot
 *     scan your own screen). They need a tap.
 * Shipping only the QR would have left every buyer who arrived by scanning the stand's sign
 * staring at a code they cannot use.
 *
 * ⚠️ AND IT SAYS WE ARE NOT PROCESSING IT. There is no order, no receipt, no refund path and
 * no inventory decrement behind this — see lib/payments/venmo.ts. Rendering a payment method
 * implies a payment record unless you say otherwise, and the seller is the one who would be
 * hurt by the wrong assumption: they would go looking in an Orders list that will never have
 * the row. The line is not fine print for that reason.
 */
export default function VenmoPay({
  handle,
  amountHint,
  amountCents,
  context = 'menu',
}: {
  handle: string;
  amountHint?: string;
  /** Cart total, when this renders somewhere a total is actually known. */
  amountCents?: number;
  /** 'cart' adds the "this does not place an order" warning — see below. */
  context?: 'menu' | 'cart';
}) {
  const url = venmoProfileUrl(handle);
  if (!url) return null;

  const amount =
    typeof amountCents === 'number' && amountCents > 0
      ? `$${(amountCents / 100).toFixed(2)}`
      : null;

  return (
    <div className="mt-6 rounded-xl border border-border bg-card p-4 text-card-foreground sm:p-5">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <div className="shrink-0 rounded-lg bg-white p-2">
          {/* The QR needs a white quiet zone to scan reliably, on either theme — this is the
              one place a literal white is correct, because it is the code's substrate rather
              than a surface colour. Keep the fg literal too: it must contrast the substrate,
              not the page. */}
          <QRCode value={url} size={104} bgColor="#ffffff" fgColor="#000000" />
        </div>

        <div className="min-w-0">
          <div className="text-base font-semibold">Pay with Venmo</div>

          {/* The amount is the whole reason to show this on the cart: the link cannot carry one
              (see venmo.ts), so the number has to be legible enough to type from. */}
          {amount && (
            <p className="mt-1 text-sm">
              Send <span className="text-xl font-bold tabular-nums">{amount}</span> to{' '}
              <span className="font-semibold">@{handle}</span>
            </p>
          )}

          <p className="mt-1 text-sm text-muted-foreground">
            Scan the code, or{' '}
            <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">
              open @{handle} in Venmo
            </a>
            .{' '}
            {amount
              ? 'Venmo can’t prefill the amount, so type it in.'
              : amountHint
                ? `Enter ${amountHint} when you pay.`
                : 'Enter the amount when you pay.'}
          </p>

          <p className="mt-2 text-xs text-muted-foreground">
            {context === 'cart' ? (
              <>
                Paying this way doesn&apos;t place an order here — nothing is sent to the seller,
                so show them your payment. Your cart stays as it is.
              </>
            ) : (
              <>
                This goes straight to the seller — this site doesn&apos;t process it, so you
                won&apos;t get an order confirmation here.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
