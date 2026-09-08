'use client';

// components/welcome/trade-site-upgrade.tsx
//
// The one paid thing on the post-claim page: a custom domain we register and manage. Price and
// availability come from the server — this component never states a number of its own.
import { useState } from 'react';

export default function TradeSiteUpgrade({
  templateId,
  priceLabel,
  businessName,
}: {
  templateId: string;
  priceLabel: string;
  businessName: string;
}) {
  const [domain, setDomain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/trade-sites/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ templateId, domain }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.url) {
        setError(j?.error || 'Could not start checkout.');
        return;
      }
      window.location.href = j.url;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-10 w-full rounded-2xl border border-border bg-card p-6 text-left text-card-foreground">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">Put it on your own domain</h2>
        <span className="text-sm text-muted-foreground">{priceLabel}</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        We register the domain, point it at {businessName}, and keep it renewed. Your subdomain keeps working either
        way. Cancel any time; the site stays yours.
      </p>
      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) void start();
        }}
      >
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="smithtowing.com"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-emerald-500/40"
        />
        <button
          type="submit"
          disabled={busy || !domain.trim()}
          className="rounded-xl bg-emerald-400 px-4 py-2 font-semibold text-zinc-950 transition hover:bg-emerald-300 disabled:opacity-50"
        >
          {busy ? 'Checking…' : 'Check & continue'}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}
    </div>
  );
}
