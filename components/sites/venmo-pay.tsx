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
export default function VenmoPay({ handle, amountHint }: { handle: string; amountHint?: string }) {
  const url = venmoProfileUrl(handle);
  if (!url) return null;

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
          <p className="mt-1 text-sm text-muted-foreground">
            Scan the code, or{' '}
            <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">
              open @{handle} in Venmo
            </a>
            . {amountHint ? `Enter ${amountHint} when you pay.` : 'Enter the amount when you pay.'}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            This goes straight to the seller — this site doesn&apos;t process it, so you won&apos;t
            get an order confirmation here.
          </p>
        </div>
      </div>
    </div>
  );
}
