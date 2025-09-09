// components/cart/cart-coupon-chip.tsx
'use client';

import { useState } from 'react';
import { useActiveCoupon } from './useActiveCoupon';

export default function CartCouponChip({
  merchantId,
  subtotalCents,
  onApply,
}: {
  merchantId: string;
  subtotalCents: number;
  onApply: (code: string, discountPreviewCents?: number) => void;
}) {
  const { loading, coupon, preview, minSpendLeft } = useActiveCoupon(merchantId, subtotalCents);
  const [copied, setCopied] = useState(false);

  if (loading || !coupon) return null;

  const pct = coupon.type === 'percent' ? coupon.percent : undefined;
  const save = preview?.valid ? preview.discountCents : 0;

  const disabled = !preview?.valid;
  const hint = disabled && minSpendLeft > 0
    ? `Add $${(minSpendLeft/100).toFixed(2)} to use ${pct || coupon.code}`
    : null;

  return (
    <div className="mt-2 flex items-center gap-2 rounded-xl border px-3 py-2">
      <div className="text-sm">
        {pct ? <b>{pct}% off</b> : <b>Discount</b>} available for you
        {save > 0 ? <> — saves <b>${(save/100).toFixed(2)}</b></> : null}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <code className="rounded bg-muted px-2 py-1 text-xs">{coupon.code}</code>
        <button
          className="rounded-md border px-2 py-1 text-xs"
          onClick={async () => { await navigator.clipboard.writeText(coupon.code); setCopied(true); setTimeout(()=>setCopied(false), 1200); }}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <button
          disabled={disabled}
          aria-disabled={disabled}
          className={`rounded-md px-3 py-1 text-xs border ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={() => onApply(coupon.code, save)}
          title={hint || ''}
        >
          {disabled ? (hint || 'Not eligible yet') : 'Apply'}
        </button>
      </div>
    </div>
  );
}
