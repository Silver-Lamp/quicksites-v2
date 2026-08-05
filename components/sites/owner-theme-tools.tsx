'use client';

// Owner-only theme controls on a published site: hover the wordmark, get a gear, shuffle a look.
//
// ⚠️ A VISITOR MUST NEVER SEE THIS, AND "never" HAS TO SURVIVE A MISTAKE. The page this sits on is
// someone's business — or, in the first case, a person's job search. A gear icon on a résumé page
// a hiring manager is reading is worse than a missing feature. So the component returns null
// before it renders anything, on a signal computed server-side, and the DOM anchor it attaches to
// (`[data-qs-wordmark]`) is inert on its own.
//
// ⚠️ WHY THE OWNER SIGNAL IS NOT SIMPLY "IS THERE A SESSION". Auth cookies here are HOST-ONLY —
// nothing configures a cookie domain — so a session on www.quicksites.ai is not sent to
// sandon.quicksites.ai, to delivered.menu, or to a customer's custom domain. On exactly the hosts
// where an owner would most want this, the server cannot distinguish them from a stranger. That is
// the same wall components/sites/admin-edit-pill.tsx hit, and this reuses its two triggers rather
// than inventing a third: the cookie where it is visible, `?edit=1` everywhere else.
//
// ⚠️ SHUFFLING IS A PREVIEW. IT DOES NOT TOUCH THE LIVE SITE. A theme shuffle rewrites CSS
// variables in this browser tab only; nothing is written and nobody else sees it. Publishing is a
// separate, explicit button that says what it does, because a live page can be open in a
// stranger's browser at the moment you press it, and "I was just trying things" is not a state a
// published site should be able to enter by accident.

import * as React from 'react';
import { CANONICAL_ORIGIN } from '@/lib/site/canonicalOrigin';

type ThemePreview = { accent: string; backdrop: string; label: string };

/**
 * Accents drawn from the same family the industry presets use. Deliberately a short, curated
 * list: "shuffle" that can produce an unreadable page is a toy, and contrast against the card
 * surface is not something a random hex can promise.
 */
const ACCENTS: Array<{ hex: string; label: string }> = [
  { hex: '#e11d48', label: 'Rose' },
  { hex: '#0ea5e9', label: 'Sky' },
  { hex: '#10b981', label: 'Emerald' },
  { hex: '#f59e0b', label: 'Amber' },
  { hex: '#8b5cf6', label: 'Violet' },
  { hex: '#14b8a6', label: 'Teal' },
  { hex: '#ef4444', label: 'Red' },
  { hex: '#6366f1', label: 'Indigo' },
];

/** Pure-CSS backdrop styles only — the painterly one costs money to generate and is not shuffleable. */
const BACKDROPS = ['wash', 'mesh', 'aurora', 'grid', 'dots', 'paper', 'none'] as const;

function hexToHsl(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let s = 0;
  let hue = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    hue =
      max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hue *= 60;
  }
  return `${Math.round(hue)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export default function OwnerThemeTools({
  enabled,
  slug,
  host,
}: {
  /** Computed server-side. See the header: this is the whole guard. */
  enabled: boolean;
  slug: string;
  /** Custom domain, if this site has one — the editor resolves by slug + host. */
  host?: string | null;
}) {
  const [anchor, setAnchor] = React.useState<DOMRect | null>(null);
  const [hovering, setHovering] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [preview, setPreview] = React.useState<ThemePreview | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  /**
   * ⚠️ THE ANCHOR ARRIVES LATE, AND THE FIRST VERSION GAVE UP ON IT. Block renderers are lazily
   * imported, so `[data-qs-wordmark]` is not in the DOM when this effect first runs — a single
   * querySelector found nothing, returned early, and the gear never appeared for anyone. Caught by
   * driving the real page rather than reasoning about it. A MutationObserver waits for the header
   * instead, and disconnects the moment it has it.
   */
  React.useEffect(() => {
    if (!enabled) return;
    let el: HTMLElement | null = null;
    let cleanup: (() => void) | null = null;

    const attach = (node: HTMLElement) => {
      el = node;
      const measure = () => setAnchor(node.getBoundingClientRect());
      const enter = () => { measure(); setHovering(true); };
      const leave = () => setHovering(false);

      node.addEventListener('mouseenter', enter);
      node.addEventListener('mouseleave', leave);
      window.addEventListener('scroll', measure, { passive: true });
      window.addEventListener('resize', measure);
      measure();

      cleanup = () => {
        node.removeEventListener('mouseenter', enter);
        node.removeEventListener('mouseleave', leave);
        window.removeEventListener('scroll', measure);
        window.removeEventListener('resize', measure);
      };
    };

    const found = document.querySelector('[data-qs-wordmark]') as HTMLElement | null;
    if (found) attach(found);

    let obs: MutationObserver | null = null;
    if (!found) {
      obs = new MutationObserver(() => {
        const node = document.querySelector('[data-qs-wordmark]') as HTMLElement | null;
        if (node) { attach(node); obs?.disconnect(); obs = null; }
      });
      obs.observe(document.body, { childList: true, subtree: true });
    }

    return () => { cleanup?.(); obs?.disconnect(); };
  }, [enabled]);

  // Visible while the pointer is on the wordmark or the tools, and always while the panel is open —
  // otherwise the gear disappears in the gap between the two, which reads as a broken control.
  const visible = enabled && !!anchor && (hovering || open);
  if (!visible) return null;

  const shuffle = () => {
    const accent = ACCENTS[Math.floor(Math.random() * ACCENTS.length)];
    const backdrop = BACKDROPS[Math.floor(Math.random() * BACKDROPS.length)];
    const next = { accent: accent.hex, backdrop, label: `${accent.label} · ${backdrop}` };
    setPreview(next);
    setMsg(null);

    // ⚠️ ONLY THE ACCENT ACTUALLY PREVIEWS, AND THE COPY BELOW SAYS SO. Rewriting `--primary`
    // repaints every themed surface immediately because they all read that variable. The backdrop
    // is rendered server-side from `data.meta.backdrop` by the theme wrapper, so it cannot change
    // in this tab — and claiming a preview that does not preview is the small dishonesty that
    // makes someone distrust the whole control.
    document.documentElement.style.setProperty('--primary', hexToHsl(accent.hex));
  };

  const revert = () => {
    document.documentElement.style.removeProperty('--primary');
    setPreview(null);
    setMsg(null);
  };

  const publish = async () => {
    if (!preview || busy) return;
    if (!confirm('Publish this look? The live site changes for everyone.')) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/sites/theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, accent: preview.accent, backdrop: preview.backdrop }),
      });
      const json = await res.json().catch(() => ({}));
      setMsg(res.ok && json?.ok ? 'Published.' : json?.error ?? `Failed (HTTP ${res.status})`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  /**
   * ⚠️ THE SAME TARGET AS THE BOTTOM-LEFT PILL, BUILT THE SAME WAY. Two edit affordances that
   * resolve differently is how one of them silently rots. It carries no template id and lands on
   * /admin/templates/resolve, which requires an admin session before it resolves anything — so
   * the worst case for anyone who reached this via ?edit=1 is a login screen.
   */
  const editHref =
    `${CANONICAL_ORIGIN}/admin/templates/resolve` +
    `?slug=${encodeURIComponent(slug)}` +
    (host ? `&host=${encodeURIComponent(host)}` : '');

  return (
    <div
      className="flex items-center gap-1.5"
      style={{ position: 'fixed', top: anchor.top + anchor.height / 2 - 14, left: anchor.right + 8, zIndex: 60 }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Edit first: it is the thing an owner hovering their own site name almost always wants,
          and a theme shuffle is the occasional one. Ordering by frequency, not by novelty. */}
      <a
        href={editHref}
        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-card/90 px-2.5 py-1 text-xs font-medium text-emerald-300 shadow-sm backdrop-blur transition hover:border-emerald-400"
        title="Open this site in the QuickSites editor"
      >
        <span aria-hidden>✎</span>
        Edit
      </a>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Site settings"
        title="Site settings (only you can see this)"
        className="grid h-7 w-7 place-items-center rounded-full border border-border bg-card/90 text-sm shadow-sm backdrop-blur transition hover:border-sky-500/50"
      >
        ⚙
      </button>

      {open && (
        <div className="mt-2 w-64 rounded-xl border border-border bg-card p-3 text-card-foreground shadow-lg">
          {/* Says whose view this is, every time. An owner-only control that doesn't announce
              itself is one screen-share away from looking like part of the site. */}
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Only you can see this
          </p>

          <button
            type="button"
            onClick={shuffle}
            className="mt-2 w-full rounded-lg border border-border px-3 py-2 text-sm font-medium transition hover:border-sky-500/50"
          >
            🎲 Shuffle theme
          </button>

          {preview && (
            <>
              <p className="mt-2 text-xs text-muted-foreground">
                <span className="text-foreground">{preview.label}</span> — the colour is previewing
                in this browser only; the backdrop applies when you publish. Nothing has changed
                for anyone else yet.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={publish}
                  disabled={busy}
                  className="flex-1 rounded-lg bg-sky-400 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-sky-300 disabled:opacity-40"
                >
                  {busy ? 'Publishing…' : 'Publish this look'}
                </button>
                <button
                  type="button"
                  onClick={revert}
                  className="rounded-lg border border-border px-3 py-2 text-xs transition hover:border-border/80"
                >
                  Revert
                </button>
              </div>
            </>
          )}

          {msg && <p className="mt-2 text-xs text-muted-foreground">{msg}</p>}
        </div>
      )}
    </div>
  );
}
