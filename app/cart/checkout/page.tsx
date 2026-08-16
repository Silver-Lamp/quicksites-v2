// app/cart/checkout/page.tsx
'use client';

import CartCouponChip from '@/components/cart/cart-coupon-chip';
import { useCartStore } from '@/components/cart/cart-store';
import ItemThumb from '@/components/cart/item-thumb';
import type { MenuIconSet } from '@/lib/menu/foodIcons';

export default function CartSummary({
  merchantId: propMerchantId,
  subtotalCents: propSubtotalCents,
  iconSet = 'none',
}: {
  merchantId?: string;
  subtotalCents?: number;
  /** The site's menu icon set, so a dish with no photo shows its icon instead of a grey tile. */
  iconSet?: MenuIconSet;
}) {
  // SSR-safe selectors (no wrapped object)
  const items = useCartStore((s) => s.items);
  const storeMerchantId = useCartStore((s) => s.merchantId || '');
  const storeSubtotal = useCartStore((s) => s.subtotalCents || 0);
  const couponCode = useCartStore((s) => s.couponCode);
  const discountPreviewCents = useCartStore((s) => s.discountPreviewCents || 0);

  const setCoupon = useCartStore((s) => s.setCoupon);
  const clearCoupon = useCartStore((s) => s.clearCoupon);
  const removeItem = useCartStore((s) => s.removeItem);
  const setQty = useCartStore((s) => s.setQty);

  const merchantId = propMerchantId ?? storeMerchantId;
  const subtotalCents = propSubtotalCents ?? storeSubtotal;

  const totalAfterDiscount = Math.max(
    0,
    subtotalCents - (couponCode ? discountPreviewCents || 0 : 0),
  );

  return (
    <div className="space-y-4">
      {/* Line items with qty controls */}
      {items.length > 0 && (
        <ul className="divide-y rounded-xl border">
          {items.map((it) => {
            const unit = Number(it.price_cents) || 0;
            const qty = Number(it.qty) || 0;
            const lineTotal = unit * qty;

            return (
              <li key={it.id} className="flex items-center gap-3 p-3">
                <ItemThumb imageUrl={it.image_url} title={it.title} iconSet={iconSet} className="h-12 w-12" />

                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-medium">{it.title}</div>
                  <div className="text-xs text-muted-foreground">
                    ${(unit / 100).toFixed(2)} each
                  </div>
                </div>

                {/* Qty stepper */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    aria-label={`Decrease quantity of ${it.title}`}
                    className="h-7 w-7 rounded-md border text-sm leading-none"
                    onClick={() => setQty(it.id, Math.max(0, qty - 1))}
                  >
                    −
                  </button>

                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    aria-label={`Quantity for ${it.title}`}
                    className="h-7 w-14 rounded-md border bg-background text-center text-sm"
                    value={qty}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^0-9]/g, '');
                      const n = v === '' ? 0 : Math.min(9999, Math.max(0, parseInt(v, 10)));
                      setQty(it.id, n);
                    }}
                  />

                  <button
                    type="button"
                    aria-label={`Increase quantity of ${it.title}`}
                    className="h-7 w-7 rounded-md border text-sm leading-none"
                    onClick={() => setQty(it.id, qty + 1)}
                  >
                    +
                  </button>
                </div>

                {/* Line total */}
                <div className="w-24 text-right text-sm font-medium tabular-nums shrink-0">
                  ${(lineTotal / 100).toFixed(2)}
                </div>

                <button
                  className="ml-2 text-xs underline shrink-0"
                  onClick={() => removeItem(it.id)}
                  aria-label={`Remove ${it.title}`}
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Auto-suggest/apply coupon for this merchant */}
      {!!merchantId && (
        <CartCouponChip
          merchantId={merchantId}
          subtotalCents={subtotalCents}
          onApply={(code, preview) => setCoupon(code, preview)}
        />
      )}

      {/* Totals */}
      <div className="rounded-xl border p-3 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>${(subtotalCents / 100).toFixed(2)}</span>
        </div>

        {couponCode ? (
          <div className="flex justify-between text-emerald-700">
            <span>Discount ({couponCode})</span>
            <span>- ${((discountPreviewCents || 0) / 100).toFixed(2)}</span>
          </div>
        ) : null}

        {/* taxes/fees could go here */}

        <div className="mt-2 border-t pt-2 flex justify-between font-semibold">
          <span>Total (est.)</span>
          <span>${(totalAfterDiscount / 100).toFixed(2)}</span>
        </div>

        {couponCode && (
          <button className="mt-2 text-xs underline" onClick={() => clearCoupon()}>
            Remove code
          </button>
        )}
      </div>
    </div>
  );
}
