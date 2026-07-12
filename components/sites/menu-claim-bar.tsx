'use client';

// Conversion bar shown on an unclaimed delivered.menu draft (a site we auto-built
// for a restaurant during outreach). Turns the watermarked preview into the claim
// entry point: "this is your site — take it over." Links to the token-gated claim
// flow (`/claim-site/<id>?token=…`), which itself re-checks the draft is still
// claimable. Dismissible for the session so it never blocks reading the menu.
import * as React from 'react';

export default function MenuClaimBar({
  templateId,
  token,
  businessName,
}: {
  templateId: string;
  token: string;
  /** The restaurant's name, so the bar reads "Is this {name}?" instead of the generic prompt. */
  businessName?: string | null;
}) {
  const [dismissed, setDismissed] = React.useState(false);

  const claimHref = `/claim-site/${templateId}?token=${encodeURIComponent(token)}`;
  const name = businessName?.trim();

  // Dismissed → collapse to a small persistent pill (never fully gone) so a returning
  // owner can still find the claim path without reloading.
  if (dismissed) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-[2147483647] flex justify-end px-3 pb-3 print:hidden">
        <a
          href={claimHref}
          className="rounded-full border border-amber-400/40 bg-neutral-900/95 px-4 py-2 text-sm font-semibold text-amber-300 shadow-2xl backdrop-blur transition hover:bg-neutral-900"
        >
          Claim this site →
        </a>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[2147483647] print:hidden">
      <div className="mx-auto flex max-w-4xl items-center gap-3 px-3 pb-3">
        <div className="flex w-full items-center gap-3 rounded-2xl border border-amber-400/30 bg-neutral-900/95 px-4 py-3 text-sm text-neutral-100 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-neutral-900/80">
          <span aria-hidden className="hidden text-lg sm:inline">👋</span>
          <p className="min-w-0 flex-1 leading-snug">
            <span className="font-semibold text-amber-300">
              {name ? `Is this ${name}?` : 'Is this your restaurant?'}
            </span>{' '}
            <span className="text-neutral-300">
              We built this site free. Claim it to edit, take online orders, and go live —
            </span>{' '}
            <span className="text-neutral-400">takes about 2 minutes.</span>
          </p>
          <a
            href={claimHref}
            className="shrink-0 rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-amber-300"
          >
            Claim this site →
          </a>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Minimize"
            className="shrink-0 rounded-full p-1 text-neutral-500 transition hover:text-neutral-300"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
