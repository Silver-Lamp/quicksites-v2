'use client';

// Conversion bar shown on an unclaimed delivered.menu draft (a site we auto-built
// for a restaurant during outreach). Turns the watermarked preview into the claim
// entry point: "this is your site — take it over." Links to the token-gated claim
// flow (`/claim-site/<id>?token=…`), which itself re-checks the draft is still
// claimable. Dismissible for the session so it never blocks reading the menu.
import { useFixedBottomVar } from '@/lib/ui/useFixedBottomVar';
import * as React from 'react';

export default function MenuClaimBar({
  templateId,
  token,
  businessName,
  demandCount = 0,
}: {
  templateId: string;
  token: string;
  /** The restaurant's name, so the bar reads "Is this {name}?" instead of the generic prompt. */
  businessName?: string | null;
  /** Order-intents logged on this draft — escalates the pitch to "N people tried to order". */
  demandCount?: number;
}) {
  const [dismissed, setDismissed] = React.useState(false);

  const claimHref = `/claim-site/${templateId}?token=${encodeURIComponent(token)}`;
  const name = businessName?.trim();
  // Once real demand exists, lead with it — it's the strongest possible claim pitch.
  const hasDemand = demandCount > 0;

  // Publishes --qs-claimbar-h so the order bar and the audio launcher can sit clear of it.
  const barRef = useFixedBottomVar<HTMLDivElement>('--qs-claimbar-h');

  // Dismissed → collapse to a small persistent pill (never fully gone) so a returning
  // owner can still find the claim path without reloading.
  if (dismissed) {
    return (
      <div ref={barRef} className="fixed inset-x-0 bottom-0 z-[2147483647] flex justify-end px-3 pb-3 print:hidden">
        <a
          href={claimHref}
          className="rounded-full border border-amber-400/40 bg-neutral-900/95 px-4 py-2 text-sm font-semibold text-amber-300 shadow-2xl backdrop-blur transition hover:bg-neutral-900"
        >
          {hasDemand ? `🔥 ${demandCount} want to order — claim →` : 'Claim this site →'}
        </a>
      </div>
    );
  }

  return (
    <div ref={barRef} className="fixed inset-x-0 bottom-0 z-[2147483647] print:hidden">
      <div className="mx-auto flex max-w-4xl items-center gap-3 px-3 pb-3">
        {/* ⚠️ STACKS ON MOBILE. As one flex row the copy squeezed the button into a sliver against
            the right edge — the primary action on the page, hardest to hit, on the device most of
            these owners will open it on (a text message on a phone is the whole delivery
            mechanism). Column below `sm`, so the button is full-width under the sentence that
            just explained it; row from `sm` up, where there is room. */}
        <div className="flex w-full flex-col items-stretch gap-3 rounded-2xl border border-amber-400/30 bg-neutral-900/95 px-4 py-3 text-sm text-neutral-100 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-neutral-900/80 sm:flex-row sm:items-center">
          <span aria-hidden className="hidden text-lg sm:inline">{hasDemand ? '🔥' : '👋'}</span>
          <p className="min-w-0 flex-1 leading-snug">
            {hasDemand ? (
              <>
                <span className="font-semibold text-amber-300">
                  {demandCount} {demandCount === 1 ? 'person' : 'people'} tried to order
                  {name ? ` from ${name}` : ' here'}.
                </span>{' '}
                <span className="text-neutral-300">
                  Claim this free site to turn on online orders and start collecting —
                </span>{' '}
                <span className="text-neutral-400">
                  takes about 2 minutes.{' '}
                  <a href="/pricing" className="underline underline-offset-2 hover:text-neutral-200">
                    Free to keep; we earn only on orders.
                  </a>
                </span>
              </>
            ) : (
              <>
                <span className="font-semibold text-amber-300">
                  {name ? `Is this ${name}?` : 'Is this your restaurant?'}
                </span>{' '}
                <span className="text-neutral-300">
                  We built it from your public listing so customers could find you. Claim it to
                  edit, take online orders, and go live —
                </span>{' '}
                {/* ⚠️ ANSWERS "AND THEN WHAT DOES IT COST?", which is the first thing an owner
                    asks and the page did not address. A persona given the goal "work out what
                    this page is, whether it's legitimate, and what it would cost to make it
                    yours" gave up here, reporting it could not determine how to proceed or
                    what ownership costs (finding 2026-07-29, high). Verified against the live
                    page: "free" appeared, but nothing about ONGOING cost — no pricing, no
                    per-month, no mention of the take-rate — so "free" read as a hook with an
                    unstated catch.
                    Also says WHO built it and WHY in the same breath: a stranger's site
                    appearing under your business's name needs a reason, not just a name. */}
                <span className="text-neutral-400">
                  takes about 2 minutes.{' '}
                  <a href="/pricing" className="underline underline-offset-2 hover:text-neutral-200">
                    Free to keep; we earn only on orders.
                  </a>
                </span>
              </>
            )}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={claimHref}
              className="flex-1 rounded-full bg-amber-400 px-4 py-2.5 text-center text-sm font-semibold text-neutral-950 transition hover:bg-amber-300 sm:flex-none sm:py-2"
            >
              Claim this site →
            </a>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="Minimize"
              className="shrink-0 rounded-full p-2 text-neutral-500 transition hover:text-neutral-300"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
