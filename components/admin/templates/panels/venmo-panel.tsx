'use client';

import * as React from 'react';
import { normalizeVenmoHandle, readVenmoHandle, writeVenmoHandle, venmoProfileUrl } from '@/lib/payments/venmo';

/**
 * "Get paid directly" — the seller's own Venmo, with the platform out of the middle.
 *
 * Deliberately separate from the Stripe panel above it, because they are different deals rather
 * than two settings of one thing: Stripe takes a fee and produces an order, Venmo takes nothing
 * and produces no record at all. Presenting them as a toggle pair would imply the site tracks
 * both, and the seller would look for Venmo money in an Orders list that will never show it.
 *
 * Validation is strict-and-silent by design (see lib/payments/venmo.ts): a handle we "helpfully"
 * corrected into a different VALID handle would send a stranger the money, so anything unparseable
 * is rejected here with a visible message rather than saved.
 */
export default function VenmoPanel({
  template,
  onPatch,
}: {
  template: any;
  onPatch: (patch: any) => void;
}) {
  const saved = readVenmoHandle(template?.data) ?? '';
  const [value, setValue] = React.useState(saved);
  const [status, setStatus] = React.useState<'idle' | 'saved' | 'invalid'>('idle');

  React.useEffect(() => { setValue(saved); }, [saved]);

  const normalized = normalizeVenmoHandle(value);
  const dirty = (normalized ?? '') !== saved;

  const save = () => {
    const trimmed = value.trim();
    // Empty means "remove it" — a legitimate action, not an error.
    if (trimmed && !normalized) { setStatus('invalid'); return; }
    // ⚠️ PATCH `meta` ONLY, never the whole `data`. The sidebar's mergeTemplate shallow-merges
    // `patch.data`, so sending a full blob rebuilt from a `template` prop that is one render
    // stale puts an old `pages` array back over the live one. That is exactly how the menu
    // editor silently destroyed its own catalog links (see menu-editor.tsx). Send the one key
    // that changed and nothing else can be collateral.
    const next = writeVenmoHandle(template?.data ?? {}, trimmed);
    onPatch({ data: { meta: next.meta } });
    setStatus('saved');
  };

  const preview = venmoProfileUrl(normalized);

  return (
    <div className="rounded-md border border-border/60 bg-card/40 p-3 text-sm">
      <div className="font-medium text-foreground">Venmo (pay you directly)</div>
      <p className="mt-1 text-xs text-muted-foreground">
        Adds a &ldquo;Pay with Venmo&rdquo; QR and link to your menu. The money goes straight to
        you — no platform fee, and no order is recorded here.
      </p>

      <div className="mt-2 flex gap-2">
        <input
          value={value}
          onChange={(e) => { setValue(e.target.value); setStatus('idle'); }}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
          placeholder="@your-venmo"
          aria-label="Venmo username"
          className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-sky-500"
        />
        <button
          onClick={save}
          disabled={!dirty && status !== 'invalid'}
          className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          Save
        </button>
      </div>

      {status === 'invalid' && (
        <p className="mt-2 text-xs text-red-400">
          That doesn&apos;t look like a Venmo username. Use the name from your profile — 5–30
          letters, numbers, hyphens or underscores.
        </p>
      )}
      {status !== 'invalid' && preview && (
        <p className="mt-2 text-xs text-muted-foreground">
          Links to <span className="font-medium text-foreground">{preview}</span> — open it once to
          check it&apos;s you.
        </p>
      )}
      {status === 'saved' && !preview && (
        <p className="mt-2 text-xs text-muted-foreground">Removed — the Venmo section is off.</p>
      )}
    </div>
  );
}
