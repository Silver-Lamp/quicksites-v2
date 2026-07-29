'use client';

// components/sites/directory-curator.tsx
//
// Operator curation panel, rendered ON the public city directory so the operator edits where
// they can see the result rather than in a separate admin screen with a mental model of it.
//
// ⚠️ SECURITY POSTURE. This mounts on a PUBLIC page. It is NOT admin-gated by being hidden —
// it fetches from an admin-gated endpoint and renders nothing at all unless that endpoint
// answers. An anonymous visitor gets a 403, the panel stays unmounted, and no candidate
// names, hidden entries or campaign ids ever reach them. Client-side "isAdmin" flags are
// decoration; the 403 is the actual control.
//
// Every action is DIRECTORY-ONLY: cohort membership, the restaurant's own site and outreach
// are untouched. The copy says so, because a control that silently did more would be worse
// than no control.
import * as React from 'react';

type Candidate = {
  templateId: string;
  slug: string;
  businessName: string;
  address: string | null;
  url: string;
  onDirectory: boolean;
  hidden: boolean;
  extra: boolean;
  inCohort: boolean;
  excludedReason?: string;
};

export default function DirectoryCurator({ campaignId }: { campaignId: string }) {
  const [candidates, setCandidates] = React.useState<Candidate[] | null>(null);
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [denied, setDenied] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/restaurant-directory?campaign=${campaignId}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        setDenied(true); // not an admin — stay invisible
        return;
      }
      const j = await res.json();
      setCandidates(j.candidates ?? []);
    } catch {
      setDenied(true);
    }
  }, [campaignId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const act = async (templateId: string, action: 'hide' | 'show' | 'add' | 'remove') => {
    setBusy(templateId);
    try {
      const res = await fetch('/api/admin/restaurant-directory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, templateId, action }),
      });
      if (res.ok) {
        const j = await res.json();
        setCandidates(j.candidates ?? []);
      }
    } finally {
      setBusy(null);
    }
  };

  // Not an admin, or nothing to curate → render nothing. No placeholder, no empty shell.
  if (denied || !candidates) return null;

  const on = candidates.filter((c) => c.onDirectory);
  const off = candidates.filter((c) => !c.onDirectory);

  return (
    <div className="fixed bottom-4 right-4 z-[2147483000] w-[min(26rem,calc(100vw-2rem))] print:hidden">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="ml-auto flex items-center gap-2 rounded-full border border-amber-500/40 bg-zinc-900/95 px-4 py-2 text-sm font-medium text-amber-200 shadow-lg backdrop-blur hover:bg-zinc-900"
        >
          ✏️ Curate list <span className="text-amber-400/70">({on.length})</span>
        </button>
      ) : (
        <div className="max-h-[70vh] overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900/97 p-4 text-white shadow-2xl backdrop-blur">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Curate this directory</h3>
            <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-white" aria-label="Close">
              ✕
            </button>
          </div>
          {/* Says what it does NOT do. The whole design rests on this being true. */}
          <p className="mb-3 text-[11px] leading-snug text-zinc-400">
            Changes this public list only. Nobody is removed from the competition, loses their
            site, or drops out of outreach.
          </p>

          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            On the list ({on.length})
          </p>
          <ul className="space-y-1.5">
            {on.map((c) => (
              <li key={c.templateId} className="flex items-center gap-2 rounded-lg bg-zinc-800/60 px-2.5 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{c.businessName}</span>
                  {c.extra && <span className="text-[10px] text-sky-300">added manually</span>}
                </span>
                <button
                  disabled={busy === c.templateId}
                  onClick={() => act(c.templateId, c.extra ? 'remove' : 'hide')}
                  className="shrink-0 rounded-md border border-zinc-600 px-2 py-1 text-xs hover:bg-zinc-700 disabled:opacity-50"
                >
                  Hide
                </button>
              </li>
            ))}
            {!on.length && <li className="px-1 text-xs text-zinc-500">Nothing on the list yet.</li>}
          </ul>

          <p className="mb-1.5 mt-4 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Not showing ({off.length})
          </p>
          <ul className="space-y-1.5">
            {off.map((c) => (
              <li key={c.templateId} className="flex items-center gap-2 rounded-lg bg-zinc-800/30 px-2.5 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-zinc-300">{c.businessName}</span>
                  <span className="block truncate text-[10px] text-zinc-500">
                    {c.hidden
                      ? 'hidden by you'
                      : /* The automatic rule explains itself rather than vanishing the row. */
                        c.excludedReason ?? (c.inCohort ? 'in cohort, not shown' : 'not in this cohort')}
                  </span>
                </span>
                <button
                  disabled={busy === c.templateId}
                  onClick={() => act(c.templateId, c.hidden ? 'show' : 'add')}
                  className="shrink-0 rounded-md border border-emerald-600/50 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
                >
                  {c.hidden ? 'Unhide' : 'Add'}
                </button>
              </li>
            ))}
            {!off.length && <li className="px-1 text-xs text-zinc-500">Nothing else nearby.</li>}
          </ul>

          <p className="mt-3 text-[11px] text-zinc-500">
            Reload the page to see the public list update.
          </p>
        </div>
      )}
    </div>
  );
}
