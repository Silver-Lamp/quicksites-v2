import CartCouponChip from '@/components/cart/cart-coupon-chip';
import { useCartStore } from '@/components/cart/cart-store';

export default function CartSummary({ merchantId, subtotalCents }:{
  merchantId: string; subtotalCents: number;
}) {
  const { couponCode, discountPreviewCents, setCoupon, clearCoupon } = useCartStore();

  return (
    <div className="space-y-3">
      <CartCouponChip
        merchantId={merchantId}
        subtotalCents={subtotalCents}
        onApply={(code, preview) => setCoupon(code, preview)}
      />

      {/* Order totals */}
      <div className="rounded-xl border p-3 text-sm">
        <div className="flex justify-between"><span>Subtotal</span><span>${(subtotalCents/100).toFixed(2)}</span></div>
        {couponCode ? (
          <div className="flex justify-between text-emerald-700">
            <span>Discount ({couponCode})</span>
            <span>- ${((discountPreviewCents || 0)/100).toFixed(2)}</span>
          </div>
        ) : null}
        {/* taxes/fees… */}
        <div className="flex justify-between font-semibold border-t mt-2 pt-2">
          <span>Total (est.)</span>
          <span>
            ${((subtotalCents - (couponCode ? discountPreviewCents || 0 : 0)) / 100).toFixed(2)}
          </span>
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
