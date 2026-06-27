'use client';

// app/merchant/connect/page.tsx
// Drive Stripe Connect onboarding + status for a merchant. Pass ?merchant=<id>.
// Stripe onboarding returns here (?state=return) and the status auto-refreshes.
import * as React from 'react';
import { useSearchParams } from 'next/navigation';

type Status = {
  connected: boolean;
  status?: string;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  accountId?: string;
  collectPlatformFee?: boolean;
  platformFeePercent?: number;
  hint?: string;
};

function ConnectInner() {
  const sp = useSearchParams();
  const merchantId = sp.get('merchant') || '';
  const returned = sp.get('state') === 'return';

  const [status, setStatus] = React.useState<Status | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    if (!merchantId) return;
    setError(null);
    try {
      const res = await fetch(`/api/connect/status?merchantId=${encodeURIComponent(merchantId)}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'status failed');
      setStatus(json);
    } catch (e: any) {
      setError(e?.message || 'failed');
    }
  }, [merchantId]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/connect/onboard', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ merchantId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'onboard failed');
      window.location.href = json.url;
    } catch (e: any) {
      setError(e?.message || 'failed');
      setBusy(false);
    }
  };

  const openDashboard = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/connect/login-link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ merchantId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'login-link failed');
      window.open(json.url, '_blank');
    } catch (e: any) {
      setError(e?.message || 'failed');
    } finally {
      setBusy(false);
    }
  };

  if (!merchantId) {
    return (
      <main className="mx-auto max-w-lg px-4 py-12">
        <p className="text-sm text-muted-foreground">
          Pass <code>?merchant=&lt;merchantId&gt;</code> in the URL.
        </p>
      </main>
    );
  }

  const active = status?.status === 'active' && !!status?.chargesEnabled;

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="mb-1 text-2xl font-bold">Stripe Connect</h1>
      <p className="mb-6 text-xs text-muted-foreground">
        Merchant <code>{merchantId}</code>
      </p>

      <div className="mb-4 space-y-1 rounded-xl border p-4 text-sm">
        <div>
          Status:{' '}
          <b className={active ? 'text-green-600' : 'text-amber-600'}>{status?.status ?? '…'}</b>
        </div>
        <div>Charges enabled: {String(status?.chargesEnabled ?? false)}</div>
        <div>Payouts enabled: {String(status?.payoutsEnabled ?? false)}</div>
        {status?.platformFeePercent != null && (
          <div>Platform fee: {(Number(status.platformFeePercent) * 100).toFixed(2)}%</div>
        )}
        {status?.hint && <div className="text-amber-600">⚠ {status.hint}</div>}
      </div>

      {error && <div className="mb-3 text-sm text-red-500">{error}</div>}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={connect}
          disabled={busy}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {active ? 'Re-onboard' : 'Connect Stripe'}
        </button>
        <button onClick={() => void refresh()} disabled={busy} className="rounded-md border px-4 py-2 text-sm">
          Refresh status
        </button>
        {active && (
          <button onClick={openDashboard} disabled={busy} className="rounded-md border px-4 py-2 text-sm">
            Open Stripe dashboard
          </button>
        )}
      </div>

      {returned && (
        <p className="mt-4 text-xs text-muted-foreground">Returned from Stripe onboarding — status refreshed above.</p>
      )}
    </main>
  );
}

export default function MerchantConnectPage() {
  return (
    <React.Suspense fallback={null}>
      <ConnectInner />
    </React.Suspense>
  );
}
