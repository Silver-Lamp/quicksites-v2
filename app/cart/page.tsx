import AutoApplyFromQuery from '@/components/cart/auto-apply-from-query';
import CartSummary from './checkout/page';
import { useState } from 'react';

export default function CartPage({ merchantId, subtotalCents }: { merchantId: string; subtotalCents: number }) {
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <>
      <AutoApplyFromQuery
        merchantId={merchantId}
        subtotalCents={subtotalCents}
        onNotice={(m)=>setMsg(m)}
      />
      {msg && <div className="mb-2 rounded-md border px-3 py-2 text-xs">{msg}</div>}
      <CartSummary merchantId={merchantId} subtotalCents={subtotalCents} />
    </>
  );
}
