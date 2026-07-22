// app/whats-new-smoke/page.tsx
//
// Smoke harness for HiveJournal's About That `whats_new` register (contract:
// crosstalk/contracts/about-that-embed.md § whats_new). A dedicated, noindex page
// with a STABLE URL whose visible content we change between deploys — exactly what
// whats_new needs to diff (it extracts page text per (embed, url) and narrates what
// changed on a return visit).
//
// Smoke steps:
//   1. Deploy v1 → visit → tap "What's new": first-sighting orientation ("here's what
//      this page is; I'll tell you what changes next time"). Never a fabricated changelog.
//   2. Bump SMOKE_VERSION + make a FAVORABLE change → deploy v2.
//   3. Return visit → "What's new" narrates the grounded diff.
//   4. Re-visit unchanged → stable cache hit (no re-spend).
//
// COMMERCE GUARDRAIL (locked by Sandon, baked into #1469): whats_new OMITS guest-negative
// diffs — price/fee HIKES, stricter rules, and removed items/amenities are silently
// skipped; an only-negative or no-net-change edit narrates a bare "the page was updated."
// So to see a real narrated diff the v2 edit MUST be favorable: LOWER a price, ADD an
// item, or add a guest-positive note (e.g. later hours). Raising a price = correctly silent.
//
// The "What's new" chip appears automatically because our about_that block is pure HJ
// loader (generic-by-construction) — no QS kinds code. It only shows once HJ has
// enabled `whats_new` on the embed AND allowed this domain.

import type { Metadata } from 'next';
import { AboutThatEmbed } from '@/components/admin/templates/render-blocks/about-that';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: "What's-new smoke",
  robots: { index: false, follow: false },
};

// HJ sandbox embed dedicated to this smoke (contracts/about-that-embed.md). enabled_kinds
// includes whats_new (default skip-negatives toggle), and quicksites.ai is domain-allowed.
// A public embed id is not a secret (it ships in the client <script data-embed=…> anyway),
// so it's baked in as the default — the page works on deploy with no env config. The env
// var still overrides it if we ever swap sandboxes, no code redeploy needed.
const SMOKE_EMBED_ID =
  process.env.NEXT_PUBLIC_WHATS_NEW_SMOKE_EMBED_ID || '22e4692a-2538-4d8b-a2df-9fce1a7abdb9';
const PAGE_URL = 'https://www.quicksites.ai/whats-new-smoke';

// ─── EDIT THIS BLOCK BETWEEN DEPLOYS TO DRIVE THE DIFF ──────────────────────────────
// v2 = FAVORABLE diff vs v1: Oat-Milk Latte price DROP ($5.25 → $4.25), a NEW item
// (Cold Brew), and LATER closing hours (2pm → 4pm). All guest-positive → whats_new
// should narrate them (default skip-negatives toggle does not suppress favorable diffs).
const SMOKE_VERSION = 'v2';
const SMOKE_ITEMS: { name: string; price: string; note?: string }[] = [
  { name: 'House Drip Coffee', price: '$3.00' },
  { name: 'Oat-Milk Latte', price: '$4.25' },
  { name: 'Morning Bun', price: '$4.50', note: 'baked daily' },
  { name: 'Avocado Toast', price: '$9.00' },
  { name: 'Cold Brew', price: '$4.00', note: 'new' },
];
const SMOKE_NOTE = 'Open 7am–4pm daily. Patio seating now open.';
// ────────────────────────────────────────────────────────────────────────────────────

export default function WhatsNewSmokePage() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px', fontFamily: 'system-ui, sans-serif' }}>
      <p style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.55, margin: 0 }}>
        About That · whats_new smoke · {SMOKE_VERSION}
      </p>
      <h1 style={{ fontSize: 30, margin: '8px 0 4px' }}>Cedar Hollow Coffee — Today's Menu</h1>
      <p style={{ opacity: 0.75, marginTop: 0 }}>{SMOKE_NOTE}</p>

      <section style={{ margin: '20px 0' }}>
        <AboutThatEmbed embedId={SMOKE_EMBED_ID} url={PAGE_URL} />
        {!SMOKE_EMBED_ID && (
          <div style={{ padding: 12, border: '1px dashed #ccc', borderRadius: 10, fontSize: 13, opacity: 0.7 }}>
            🎙️ Player renders once <code>NEXT_PUBLIC_WHATS_NEW_SMOKE_EMBED_ID</code> is set to the
            whats_new-enabled sandbox embed.
          </div>
        )}
      </section>

      <ul style={{ listStyle: 'none', padding: 0, margin: 0, borderTop: '1px solid #eee' }}>
        {SMOKE_ITEMS.map((it) => (
          <li
            key={it.name}
            style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #eee' }}
          >
            <span>
              {it.name}
              {it.note ? <em style={{ opacity: 0.6, fontSize: 13 }}> — {it.note}</em> : null}
            </span>
            <strong>{it.price}</strong>
          </li>
        ))}
      </ul>

      <p style={{ marginTop: 24, fontSize: 12, opacity: 0.5 }}>
        Diagnostic page for the About That whats_new register. Content here is edited between
        deploys to exercise the diff narration. Not indexed.
      </p>
    </main>
  );
}
