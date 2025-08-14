'use client';

import { useEffect, useState } from 'react';
import { useCartStore } from './cart-store';

export default function AutoApplyFromQuery({
  merchantId,
  subtotalCents,
  onNotice, // (msg: string) => void
}: {
  merchantId: string;
  subtotalCents: number;
  onNotice?: (m: string) => void;
}) {
  const { setCoupon } = useCartStore();
  const [done, setDone] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get('apply');
    if (!raw || done) return;

    const code = raw.trim().toUpperCase();

    (async () => {
      // First, is it for this chef?
      const lk = await fetch(`/api/public/coupons/lookup?code=${encodeURIComponent(code)}`).then(r=>r.json());
      if (!lk?.found) {
        onNotice?.('That code is not available.'); cleanup(); return;
      }
      if (lk.coupon.merchant_id !== merchantId) {
        onNotice?.(`That code belongs to ${lk.coupon.merchant_name}.`); cleanup(); return;
      }

      // Validate for this user & cart
      const v = await fetch('/api/public/coupons/validate', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ code, merchantId, subtotalCents })
      }).then(r=>r.json());

      if (v?.valid) {
        setCoupon(code, v.discountCents || 0);
        onNotice?.(`Coupon ${code} applied!`);
      } else {
        // still stash code with zero preview so they see it in the box, or just notify
        onNotice?.(v?.reason === 'not_owner'
          ? 'Please sign in with the account that received this code.'
          : 'Code is not eligible for this cart yet.');
      }
      cleanup();
    })();

    function cleanup() {
      url.searchParams.delete('apply');
      window.history.replaceState({}, '', url.toString());
      setDone(true);
    }
  }, [merchantId, subtotalCents, setCoupon, done, onNotice]);

  return null;
}
