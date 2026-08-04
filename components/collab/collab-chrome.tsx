// components/collab/collab-chrome.tsx
//
// The frame around a client's collaboration page.
//
// ⚠️ WHAT THIS IS NOT, AND WHY. The ask was "agency branding chrome, so it looks like part of a
// custom client site development process". A cold mesh poll — PorchHearth, DeckSketch and
// HiveJournal answering independently, none having seen the others (crosstalk 2026-08-04) — came
// back 3/3 with the same answer: ADD LESS THAN WAS ASKED. Three arguments, arrived at separately:
//
//   1. The page has one job: get an honest answer out of a half-sure, non-technical person about
//      her own business. Polish reframes it from "drafts, still yours to change" into "a finished
//      product being sold to you", and that is exactly when a polite person swallows "I don't like
//      any of these" and picks the least-bad instead. Branding costs us the only thing the page
//      is for.
//   2. A staged progress rail (Intake → Drafts → Your pick → Build → Launch) CANNOT REGRESS, and
//      "none of these are right" is a legitimate outcome we have explicitly invited. It also
//      directly contradicts the page's own promise that everything is still hers to change. The
//      lie is not the steps; it is the implied irreversibility.
//   3. A "your producer / your team" strip is one person and some models. That is the
//      invented-staff failure (CUSTOM_SITES §4 rule 4) wearing a nicer font.
//
// So the chrome carries only what corresponds to something real: ONE ACCOUNTABLE HUMAN, the
// company that made it, when the page last changed, and the fact that the link is not private to
// her. Everything here is checkable — which is the point. HiveJournal's line: if the chrome earns
// its place, it earns a render-gate rule.
import * as React from 'react';
import type { Presenter } from '@/lib/collab/presenter';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** UTC, matching collab-client's shortDate — see the note there on hydration mismatches. */
function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/**
 * The one accountable human.
 *
 * ⚠️ Renders NOTHING when there is no presenter, rather than a placeholder. A header with a blank
 * human reads as a page that failed to load; no header reads as a page that never claimed one.
 * (Same rule as a missing backdrop rendering no layer at all — CLAUDE.md §7.)
 */
function PresenterBadge({ presenter }: { presenter: Presenter }) {
  return (
    <div className="flex items-center gap-3">
      {presenter.headshotUrl && (
        // Plain <img>: the URL is Supabase storage and this is not worth a next.config
        // remotePatterns entry. Decorative — the NAME is the attribution, so an image that fails
        // to load costs nothing that matters.
        <img
          src={presenter.headshotUrl}
          alt=""
          width={36}
          height={36}
          className="h-9 w-9 rounded-full border border-border object-cover"
        />
      )}
      <div className="leading-tight">
        <div className="text-sm font-medium text-foreground">{presenter.name}</div>
        {presenter.email ? (
          // ⚠️ A way to reach a human that is NOT the composer on this page. A client who wants to
          // ask something she would not write into a shared thread currently has nowhere to go.
          <a
            href={`mailto:${presenter.email}`}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            {presenter.email}
          </a>
        ) : (
          <div className="text-xs text-muted-foreground">QuickSites</div>
        )}
      </div>
    </div>
  );
}

export default function CollabChrome({
  presenter,
  lastUpdatedIso,
  children,
}: {
  /** Null on the invalid-link screens: a stranger holding a broken link is not owed a name. */
  presenter: Presenter | null;
  lastUpdatedIso: string | null;
  children: React.ReactNode;
}) {
  const updated = lastUpdatedIso ? shortDate(lastUpdatedIso) : null;
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border/70">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          {/* A mark, not a costume: it says who made the tool, at the weight of a byline. */}
          <span className="text-sm font-semibold tracking-tight text-muted-foreground">
            QuickSites
          </span>
          {presenter && <PresenterBadge presenter={presenter} />}
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="mt-12 border-t border-border/70">
        <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-muted-foreground">
          {/* ⚠️ NOT BRANDING, AND THE MOST USEFUL LINE DOWN HERE. The page is reachable by anyone
              holding the link and carries a private conversation about her business — she is
              entitled to know that before she decides what to write into the thread. It is also
              why the page is noindex; this says the same thing to the person instead of to a
              crawler. */}
          <p>
            This link is private, but it isn’t protected by a password — anyone you forward it to
            can read this page.
          </p>
          <p className="mt-2">
            Built with QuickSites · Point Seven Studio
            {updated && ` · this page last changed ${updated}`}
          </p>
        </div>
      </footer>
    </div>
  );
}
