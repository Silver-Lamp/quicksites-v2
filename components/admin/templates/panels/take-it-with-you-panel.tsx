'use client';

// "Download this site" — the panel that makes "it's yours" checkable.
//
// ⚠️ IT ANSWERS THE QUESTION A PROSPECT ACTUALLY ASKS. Not "how experienced are you" but "what
// happens to my site if you disappear". A credential answers that badly and a promise answers it
// with a dependency; a button they press without asking is the only version that survives us being
// small, new and one person. The catch people hunt for when something is free IS lock-in, and the
// way to disprove lock-in is to remove it.
//
// ⚠️ AND IT SAYS WHAT THE FILE IS, PLAINLY. Not "export your data" — a JSON dump of block schemas
// would be technically an export and practically a puzzle that needs our renderer to mean
// anything. This is the rendered page: it opens in any browser, forever, with no software from us.

import * as React from 'react';

export default function TakeItWithYouPanel({
  templateId,
  slug,
  published,
}: {
  templateId: string;
  slug?: string | null;
  published?: boolean;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sites/${templateId}/export`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slug || 'site'}.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      // The real reason, not "something went wrong" — this is the button whose entire purpose is
      // to demonstrate we are not holding their site hostage.
      setError(e?.message ?? 'Could not build the file.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-3">
      <h3 className="text-sm font-semibold text-card-foreground">Take it with you</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Download this site as one file. It opens in any browser, works offline, and you can host it
        anywhere — no account with us required.
      </p>

      <button
        type="button"
        onClick={download}
        disabled={busy}
        className="mt-3 w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {busy ? 'Building your file…' : 'Download my site'}
      </button>

      {/* ⚠️ NO LONGER GATED ON `published`, AND THE GATE WAS BACKWARDS. An unclaimed
          listing-import draft is already publicly readable at its delivered.menu URL — that is the
          whole design — so there is something to export. Worse, the gate asked an owner to PUBLISH
          a page in order to test the feature that proves they can leave, which is an irreversible
          public act traded for a safety check. Sandon refused to press it, correctly. */}
      {!published && (
        <p className="mt-2 text-xs text-muted-foreground">
          This copies the page as it is published today — a draft downloads whatever is currently
          live at its address.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </section>
  );
}
