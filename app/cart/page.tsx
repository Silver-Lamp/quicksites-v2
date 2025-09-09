'use client';

import CartCouponChip from '@/components/cart/cart-coupon-chip';
import { useCartStore } from '@/components/cart/cart-store';

export default function CartSummary({
  merchantId: propMerchantId,
  subtotalCents: propSubtotalCents,
}: {
  merchantId?: string;
  subtotalCents?: number;
}) {
  const {
    items,
    merchantId: storeMerchantId,
    subtotalCents: storeSubtotal,
    couponCode,
    discountPreviewCents,
    setCoupon,
    clearCoupon,
  } = useCartStore((s) => ({
    items: s.items,
    merchantId: s.merchantId || '',
    subtotalCents: s.subtotalCents || 0,
    couponCode: s.couponCode,
    discountPreviewCents: s.discountPreviewCents || 0,
    setCoupon: s.setCoupon,
    clearCoupon: s.clearCoupon,
  }));

  const merchantId = propMerchantId ?? storeMerchantId;
  const subtotalCents = propSubtotalCents ?? storeSubtotal;

  const totalAfterDiscount = Math.max(
    0,
    subtotalCents - (couponCode ? discountPreviewCents || 0 : 0),
  );

  return (
    <div className="space-y-3">
      {/* (Optional) quick line items list */}
      {items.length > 0 && (
        <ul className="divide-y rounded-xl border">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-3 p-3">
              <div className="h-10 w-10 rounded bg-muted overflow-hidden">
                {it.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.image_url} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{it.title}</div>
                <div className="text-xs text-muted-foreground">
                  ${(it.price_cents / 100).toFixed(2)} × {it.qty}
                </div>
              </div>
              <button
                className="text-xs underline"
                onClick={() => useCartStore.getState().removeItem(it.id)}
              >
                Remove
              </button>
            </li>
          ))}
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

      {/* Order totals */}
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
