'use client';

// components/admin/templates/seed-starters-button.tsx
//
// Admin tool: seed the per-industry starter templates (every industry, idempotent,
// no AI spend). Storefront industries with a curated product pack get a dedicated
// merchant + priced catalog; everything else gets its tailored industry scaffold.
// Existing starters are skipped, so re-running after adding packs is safe.

import { useState } from 'react';
import { Layers } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function SeedStartersButton() {
  const [busy, setBusy] = useState(false);

  async function seed() {
    if (busy) return;
    if (!window.confirm('Seed starter templates for ALL industries? Idempotent (existing starters are skipped), no AI spend. Storefront industries get a stocked demo catalog.')) {
      return;
    }
    setBusy(true);
    const t = toast.loading('Seeding starters across all industries…');
    try {
      const res = await fetch('/api/admin/templates/seed-starters', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'Seeding failed');
      toast.success(
        `Starters: ${j.created ?? 0} created (${j.withCatalogs ?? 0} with catalogs), ${j.exists ?? 0} already existed${j.failed ? `, ${j.failed} failed` : ''}`,
        { id: t, duration: 6000 },
      );
      if (j.created > 0) window.dispatchEvent(new Event('qs:templates:refetch'));
    } catch (e: any) {
      toast.error(e?.message || 'Seeding failed', { id: t });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={seed}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-60"
      title="Seed per-industry starter templates (idempotent; storefronts get demo catalogs)"
    >
      <Layers className="h-4 w-4" /> {busy ? 'Seeding…' : 'Seed starters'}
    </button>
  );
}
