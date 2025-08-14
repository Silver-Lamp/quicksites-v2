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

export default function ChefCouponBadge({ merchantId }:{ merchantId: string }) {
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const r = await fetch(`/api/public/coupons/my-active?merchantId=${encodeURIComponent(merchantId)}`);
      const d = await r.json().catch(()=>({}));
      setCoupon(d?.coupon || null);
      setLoading(false);
    })();
  }, [merchantId]);

  const daysLeft = useMemo(() => {
    if (!coupon?.expires_at) return null;
    const ms = new Date(coupon.expires_at).getTime() - Date.now();
    return ms > 0 ? Math.ceil(ms / (24*3600*1000)) : 0;
  }, [coupon]);

  if (loading || !coupon) return null;

  const label = coupon.type === 'percent' && coupon.percent
    ? `${coupon.percent}% off available`
    : `Discount available`;

  return (
    <div className="mt-2 flex items-center gap-3 rounded-xl border bg-emerald-50/60 px-3 py-2 text-emerald-900">
      <span className="text-sm">🎁 {label}</span>
      {daysLeft !== null && <span className="text-xs text-emerald-800">expires in {daysLeft} day{daysLeft===1?'':'s'}</span>}
      {coupon.min_subtotal_cents > 0 && (
        <span className="text-xs text-emerald-800">min ${ (coupon.min_subtotal_cents/100).toFixed(2) }</span>
      )}
      <div className="ml-auto flex items-center gap-2">
        <code className="rounded bg-white/80 px-2 py-1 text-xs border">{coupon.code}</code>
        <button
          className="rounded-md border px-2 py-1 text-xs bg-white/80"
          onClick={async () => { await navigator.clipboard.writeText(coupon.code); setCopied(true); setTimeout(()=>setCopied(false), 1200); }}
          title="Copy code"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
