'use client';

import { useEffect, useMemo, useState } from 'react';

type Coupon = {
  code: string;
  type: 'percent'|'fixed';
  percent?: number | null;
  amount_cents?: number | null;
  min_subtotal_cents: number;
  currency: string;
  expires_at?: string | null;
};

export function useActiveCoupon(merchantId: string | undefined, subtotalCents: number) {
  const [loading, setLoading] = useState(false);
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [preview, setPreview] = useState<{ valid:boolean; discountCents:number; reason?:string } | null>(null);

  useEffect(() => {
    if (!merchantId) return;
    (async () => {
      setLoading(true);
      const r = await fetch(`/api/public/coupons/my-active?merchantId=${encodeURIComponent(merchantId)}`);
      const d = await r.json();
      setCoupon(d.coupon || null);
      setLoading(false);
    })();
  }, [merchantId]);

  useEffect(() => {
    (async () => {
      if (!coupon || !merchantId || !Number.isFinite(subtotalCents)) {
        setPreview(null); return;
      }
      const r = await fetch('/api/public/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ code: coupon.code, merchantId, subtotalCents })
      });
      if (!r.ok) { setPreview({ valid:false, discountCents:0, reason:'server' }); return; }
      const d = await r.json();
      setPreview({ valid: !!d.valid, discountCents: d.discountCents || 0, reason: d.reason });
    })();
  }, [coupon, merchantId, subtotalCents]);

  const minSpendLeft = useMemo(() => {
    if (!coupon) return 0;
    const need = (coupon.min_subtotal_cents || 0) - (subtotalCents || 0);
    return Math.max(0, need);
  }, [coupon, subtotalCents]);

  return { loading, coupon, preview, minSpendLeft };
}
