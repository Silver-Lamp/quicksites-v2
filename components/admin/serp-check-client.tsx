'use client';

// components/admin/serp-check-client.tsx
//
// The human SERP check, one search at a time (docs/SERP_CHECK_WORKSHEET.md).
//
// ⚠️ THE ENEMY IS BOREDOM, NOT ERROR. Ten searches is twenty minutes of repetitive work and the
// realistic failure is someone stopping at row six or going sloppy from row four. So the screen
// shows ONE row, the query is one click from the clipboard and one click from a pre-built Google
// URL, and there are exactly two required answers. Number keys 0–3 set the pack size, so a whole
// run can be done without reaching for the mouse.
//
// ⚠️ THE CONTROL IS FIRST AND IS LABELLED AS ONE. It is the row whose job is to catch a broken
// reading — including a broken human one — and a tired person answering it last defeats that.
// When it disagrees, the run is shown as unusable rather than being quietly tallied anyway.
//
// ⚠️ The verdict shown after each answer comes from the SERVER, which computed it with the same
// rule the API path uses. This component never scores anything itself; if it did, the hand/machine
// comparison would be comparing this file to that one.

import * as React from 'react';
import { useRouter } from 'next/navigation';
// The SAME pure rule the server scores with. Used only to PREVIEW what a save will produce —
// the stored verdict still comes from the server, so the two cannot disagree.
import { readHumanSerp, readHumanSerpNoOrganic, type FirstOrganicKind } from '@/lib/serp/classify';

type Row = {
  index: number;
  nicheKey: string | null;
  query: string;
  location: string;
  isControl: boolean;
  searchUrl: string;
  needsLocationOverride: boolean;
  coords?: string;
  timezoneId?: string;
  human: { verdict: string; pack_size: number; reason: string; notes: string | null } | null;
  machine: { verdict: string; pack_size: number; first_organic_domain: string | null } | null;
};

const KINDS: Array<{ value: string; label: string; hint: string }> = [
  { value: 'unknown', label: 'A business’s own site', hint: 'a builder, a contractor, a company' },
  { value: 'directory', label: 'A directory', hint: 'Yelp, Angi, Thumbtack, Houzz' },
  { value: 'forum', label: 'A forum or Reddit', hint: 'the strongest signal on the sheet' },
  { value: 'retail', label: 'A retailer', hint: 'Amazon, Home Depot' },
  { value: 'video', label: 'YouTube or video', hint: '' },
];

const VERDICT_STYLE: Record<string, string> = {
  best: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  good: 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-200',
  mixed: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  skip: 'border-red-500/40 bg-red-500/10 text-red-200',
};

export default function SerpCheckClient({ initialRows }: { initialRows: Row[] }) {
  const router = useRouter();
  const [rows, setRows] = React.useState<Row[]>(initialRows);
  const [cursor, setCursor] = React.useState(() => {
    const firstUnanswered = initialRows.findIndex((r) => !r.human);
    return firstUnanswered === -1 ? initialRows.length : firstUnanswered;
  });
  const [pack, setPack] = React.useState<number | null>(null);
  const [kind, setKind] = React.useState('unknown');
  const [noOrganic, setNoOrganic] = React.useState(false);
  const [ai, setAi] = React.useState(false);
  const [notes, setNotes] = React.useState('');
  const [domain, setDomain] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const row = rows[cursor];
  const answered = rows.filter((r) => r.human);
  const control = rows.find((r) => r.isControl);
  const controlOk = control?.human ? control.human.verdict === 'skip' : null;
  const scored = answered.filter((r) => !r.isControl);
  const green = scored.filter((r) => r.human && ['best', 'good'].includes(r.human.verdict)).length;
  const disagreements = answered.filter((r) => r.machine && r.machine.verdict !== r.human!.verdict);

  // Number keys set the pack size — the answer that decides the verdict.
  React.useEffect(() => {
    if (!row) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      if (/^[0-9]$/.test(e.key)) setPack(Number(e.key));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [row]);

  // Pure, and only a preview — the row that gets stored is scored server-side.
  const preview = React.useMemo(() => {
    if (pack === null) return null;
    return noOrganic
      ? readHumanSerpNoOrganic(row?.query ?? '', row?.location ?? '', pack)
      : readHumanSerp({
          query: row?.query ?? '',
          location: row?.location ?? '',
          packSize: pack,
          firstOrganicKind: kind as FirstOrganicKind,
          firstOrganicDomain: domain || null,
          aiOverview: ai,
        });
  }, [pack, kind, noOrganic, domain, ai, row?.query, row?.location]);

  const reset = () => { setPack(null); setKind('unknown'); setNoOrganic(false); setAi(false); setNotes(''); setDomain(''); };

  async function save() {
    if (!row || pack === null) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/serp-check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nicheKey: row.nicheKey, query: row.query, location: row.location,
          packSize: pack, firstOrganicKind: kind, firstOrganicDomain: domain,
          noOrganic, aiOverview: ai, notes,
        }),
      });
      const j = await res.json();
      if (!res.ok) { alert(j?.error ?? 'save failed'); return; }
      setRows((prev) =>
        prev.map((r, i) =>
          i === cursor
            ? { ...r, human: { verdict: j.reading.verdict, pack_size: j.reading.packSize, reason: j.reading.reason, notes: notes || null } }
            : r,
        ),
      );
      setCursor((c) => c + 1);
      reset();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!row) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold text-neutral-100">Run complete</h1>
        {controlOk === false ? (
          <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
            <strong>The control disagreed, so this run cannot be read.</strong> `towing service near me`
            is a query we know loses — position 10.9, 69 impressions, zero clicks. It scored{' '}
            <code>{control?.human?.verdict}</code> here. Check how the pack was counted on that row
            before trusting anything else.
          </div>
        ) : (
          <p className="mt-2 text-sm text-neutral-400">
            {green} of {scored.length} green.{' '}
            {scored.length && green / scored.length >= 0.7
              ? 'Real cohort — worth pricing domains.'
              : scored.length && green / scored.length >= 0.4
                ? 'Split result — probe the stronger half alone before spending.'
                : 'The density proxy did not hold. Fix the scoring before buying anything.'}
          </p>
        )}

        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-neutral-400">
          You vs the machine
        </h2>
        {disagreements.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-400">
            {answered.some((r) => r.machine)
              ? 'Every row you scored matched the automated reading. That is what makes the automated runs trustworthy.'
              : 'No automated readings exist for these queries yet, so there is nothing to compare against.'}
          </p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-xl border border-amber-500/30">
            <table className="w-full text-sm">
              <thead className="bg-amber-500/10 text-amber-200">
                <tr><th className="px-3 py-2 text-left">Query</th><th className="px-3 py-2">You</th><th className="px-3 py-2">Machine</th></tr>
              </thead>
              <tbody>
                {disagreements.map((r) => (
                  <tr key={r.query + r.location} className="border-t border-amber-500/20">
                    <td className="px-3 py-2 text-neutral-200">{r.query}</td>
                    <td className="px-3 py-2 text-center font-mono">{r.human!.verdict}</td>
                    <td className="px-3 py-2 text-center font-mono">{r.machine!.verdict}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-3 py-2 text-xs text-neutral-400">
              A disagreement means the classifier is wrong, not you. Send these to the session and
              the rules get recalibrated against them.
            </p>
          </div>
        )}
        <button onClick={() => { setCursor(0); reset(); }} className="mt-6 rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:border-neutral-500">
          Review from the start
        </button>
      </div>
    );
  }

  const city = row.location.split(',')[0];
  /**
   * ⚠️ SHOW THE WHOLE LOCATION, NOT THE CITY. Two reasons, and the second is the load-bearing one:
   * "Asheville" alone is ambiguous in Google's own location box, and "Portland" in this list is
   * MAINE. But more importantly the automated run used this exact string — so a person who sets
   * something different is measuring a different market, and the hand/machine comparison silently
   * stops being apples to apples while still producing two verdicts to compare.
   */
  const locationLabel = row.location.split(',').map((p) => p.trim()).join(', ');

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-neutral-500">
          Search {row.index} of {rows.length}
        </span>
        <span className="text-xs text-neutral-500">{answered.length} answered</span>
      </div>

      {/* ⚠️ Row navigation, added after the console shipped with only "skip" — i.e. forward and
          nothing else. A person who mis-keyed a row (the control was saved with pack 0 when the
          screenshots plainly showed 3) had NO way back to it short of answering every remaining
          row. A one-way form is fine for a survey and wrong for a measurement you are meant to
          correct. Answering a row again writes a new observation and the newest per query wins,
          so re-doing one is always safe. */}
      <nav aria-label="Jump to a search" className="mt-3 flex flex-wrap gap-1.5">
        {rows.map((r, i) => {
          const done = !!r.human;
          const bad = r.isControl && r.human && r.human.verdict !== 'skip';
          return (
            <button
              key={`${r.query}|${r.location}`}
              onClick={() => { setCursor(i); reset(); }}
              title={`${r.query} — ${r.location.split(',')[0]}${done ? ` — you said ${r.human!.verdict}` : ''}`}
              aria-current={i === cursor ? 'step' : undefined}
              className={`h-7 min-w-7 rounded px-1.5 text-xs transition ${
                i === cursor ? 'ring-2 ring-sky-400 ' : ''
              }${
                bad
                  ? 'border border-red-500/60 bg-red-500/20 text-red-200'
                  : done
                    ? 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                    : 'border border-neutral-700 text-neutral-400 hover:border-neutral-500'
              }`}
            >
              {r.isControl ? '★' : r.index}
            </button>
          );
        })}
      </nav>
      <p className="mt-1.5 text-[11px] text-neutral-500">
        ★ is the control. Click any number to go back and redo it — the newest answer wins.
      </p>
      <div className="mt-2 h-1 w-full overflow-hidden rounded bg-neutral-800">
        <div className="h-full bg-sky-500 transition-all" style={{ width: `${(answered.length / rows.length) * 100}%` }} />
      </div>

      {control?.human && control.human.verdict !== 'skip' && !row.isControl && (
        <div className="mt-4 rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          <strong>The control is answered wrong, so this run cannot be read yet.</strong> It scored{' '}
          <code>{control.human.verdict}</code> and must be <code>skip</code>.{' '}
          <button onClick={() => { setCursor(rows.findIndex((r) => r.isControl)); reset(); }} className="underline">
            Go back and redo it →
          </button>
        </div>
      )}

      {row.isControl && (
        <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <strong>This is the control.</strong> We know this query loses. If it scores anything but
          “skip”, something is wrong with the reading — yours or the tool’s — and the rest of the
          run can’t be trusted. That’s why it’s first.
        </div>
      )}

      <div className="mt-5 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
        <div className="text-xs uppercase tracking-wide text-neutral-500">
          Search this{row.needsLocationOverride ? <> — location must be <strong className="text-amber-300">{locationLabel}</strong></> : null}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <code className="rounded-lg bg-neutral-950 px-3 py-2 text-base text-sky-300">{row.query}</code>
          <button
            onClick={() => { navigator.clipboard?.writeText(row.query); setCopied(true); setTimeout(() => setCopied(false), 1200); }}
            className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-neutral-500"
          >
            {copied ? 'copied' : 'copy'}
          </button>
          <a href={row.searchUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-sky-700 bg-sky-500/10 px-3 py-1.5 text-xs text-sky-300 hover:border-sky-500">
            open in Google ↗
          </a>
        </div>
        {row.needsLocationOverride ? (
          <details className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-100">
            <summary className="cursor-pointer select-none font-medium">
              ⚠️ This row says “near me” — set your location to {locationLabel} first
            </summary>
            <div className="mt-2 flex flex-col gap-2 text-amber-100/90">
              <p>
                “Near me” uses where Google thinks you are, not the words you typed. From the wrong
                city this measures the wrong market and looks identical to measuring the right one.
              </p>
              <p className="font-medium text-amber-50">Easiest, no DevTools:</p>
              <p>
                Run the search, then at the bottom of the results page click{' '}
                <strong>Update location</strong> (beside “Results for …”) and enter{' '}
                <strong className="text-amber-50">{locationLabel}</strong>.{' '}
                <button
                  onClick={() => { navigator.clipboard?.writeText(locationLabel); }}
                  className="rounded border border-amber-500/50 px-1.5 py-0.5 text-[11px] hover:bg-amber-500/10"
                >
                  copy
                </button>
              </p>
              <p className="text-amber-100/70">
                That is the exact location the automated run used. Setting a different one measures
                a different market and the comparison stops meaning anything.
              </p>
              <p className="font-medium text-amber-50">Or in Chrome DevTools:</p>
              <ol className="list-decimal pl-4">
                <li>Open DevTools — <kbd className="rounded bg-black/30 px-1">⌥⌘I</kbd></li>
                <li>Press <kbd className="rounded bg-black/30 px-1">⌘⇧P</kbd>, type <em>sensors</em>, pick “Show Sensors”</li>
                <li>Location → “Other…”, then fill the three fields below</li>
                <li>Reload the search</li>
              </ol>
              {row.coords ? (
                <div className="rounded border border-amber-500/30 bg-black/20 p-2">
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[11px]">
                    <dt className="text-amber-200/70">Location</dt>
                    <dd>{locationLabel}</dd>
                    <dt className="text-amber-200/70">Lat / Long</dt>
                    <dd>{row.coords}</dd>
                    <dt className="text-amber-200/70">Timezone ID</dt>
                    <dd>{row.timezoneId ?? '—'}</dd>
                    <dt className="text-amber-200/70">Locale</dt>
                    <dd>en-US</dd>
                  </dl>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(
                        `${locationLabel}\n${row.coords}\n${row.timezoneId ?? ''}\nen-US`,
                      );
                    }}
                    className="mt-2 rounded border border-amber-500/50 px-2 py-1 text-[11px] hover:bg-amber-500/10"
                  >
                    copy all
                  </button>
                </div>
              ) : null}
              <p className="text-amber-100/70">
                Sensors is a bottom-drawer panel, not a tab — the ⋮ menu you want is the one
                <em> inside</em> DevTools, not the browser’s.
              </p>
            </div>
          </details>
        ) : (
          <p className="mt-2 text-xs text-neutral-500">
            The city is in the query, so there is nothing to set — just use an incognito window.
          </p>
        )}
      </div>

      <div className="mt-5 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
        <div className="text-sm font-medium text-neutral-200">How many businesses in the map pack?</div>
        <p className="text-xs text-neutral-500">3 is full. Fewer means Google has nothing to fill it with. Press 0–3.</p>
        <div className="mt-3 flex gap-2">
          {[0, 1, 2, 3].map((n) => (
            <button
              key={n}
              onClick={() => setPack(n)}
              className={`h-12 w-12 rounded-lg border text-lg font-semibold transition ${
                pack === n ? 'border-sky-500 bg-sky-500/20 text-sky-200' : 'border-neutral-700 text-neutral-300 hover:border-neutral-500'
              }`}
            >
              {n}
            </button>
          ))}
          <button
            onClick={() => setPack(0)}
            className={`h-12 rounded-lg border px-3 text-sm ${pack === 0 ? 'border-sky-500 bg-sky-500/20 text-sky-200' : 'border-neutral-700 text-neutral-400 hover:border-neutral-500'}`}
          >
            no pack at all
          </button>
        </div>

        <div className="mt-5 text-sm font-medium text-neutral-200">What is the first ordinary blue link?</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {KINDS.map((k) => (
            <button
              key={k.value}
              onClick={() => { setKind(k.value); setNoOrganic(false); }}
              className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                kind === k.value && !noOrganic ? 'border-sky-500 bg-sky-500/10 text-sky-200' : 'border-neutral-700 text-neutral-300 hover:border-neutral-500'
              }`}
            >
              {k.label}
              {k.hint ? <span className="block text-xs text-neutral-500">{k.hint}</span> : null}
            </button>
          ))}
          <button
            onClick={() => setNoOrganic(true)}
            className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
              noOrganic ? 'border-red-500 bg-red-500/10 text-red-200' : 'border-neutral-700 text-neutral-300 hover:border-neutral-500'
            }`}
          >
            No blue link above the fold at all
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-neutral-400">
            Its domain (optional)
            <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com"
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-200" />
          </label>
          <label className="flex items-end gap-2 text-sm text-neutral-300">
            <input type="checkbox" checked={ai} onChange={(e) => setAi(e.target.checked)} />
            <span>An AI overview sits on top</span>
          </label>
        </div>

        <label className="mt-4 block text-xs text-neutral-400">
          Anything the form didn’t ask about
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            placeholder="The thing a checkbox can’t capture — write it here rather than bending an answer to fit."
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-200" />
        </label>

        {/* ⚠️ What this ANSWER produces, shown before saving. The row used to render only the
            PREVIOUSLY SAVED verdict underneath, so re-doing a row showed yesterday's answer
            sitting under today's selections, contradicting them — which is what made "save or
            skip?" an open question. Same pure rule as the server's, so a preview can never
            promise something the save does not deliver. */}
        {pack !== null && (
          <div className={`mt-5 rounded-lg border p-3 text-sm ${VERDICT_STYLE[preview!.verdict] ?? ''}`}>
            <strong className="uppercase">{preview!.verdict}</strong> — {preview!.reason}
            <div className="mt-1 text-xs opacity-80">
              This is what “Save and next” will record{row.human ? ', replacing your earlier answer' : ''}.
            </div>
          </div>
        )}

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={save}
            disabled={pack === null || saving}
            className="rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {saving ? 'Saving…' : row.human ? 'Save and next (replaces earlier answer)' : 'Save and next'}
          </button>
          {pack === null && <span className="text-xs text-neutral-500">Pack size is the one answer that decides the verdict.</span>}
          {cursor > 0 && (
            <button onClick={() => { setCursor((c) => c - 1); reset(); }} className="text-xs text-neutral-400 underline">
              ← back
            </button>
          )}
          {cursor < rows.length - 1 && (
            <button onClick={() => { setCursor((c) => c + 1); reset(); }} className="text-xs text-neutral-500 underline">
              skip without answering
            </button>
          )}
        </div>
      </div>

      {row.human && pack === null && (
        <div className={`mt-4 rounded-xl border p-4 text-sm ${VERDICT_STYLE[row.human.verdict] ?? ''}`}>
          <div className="text-xs uppercase tracking-wide opacity-70">Saved earlier</div>
          <div className="mt-1">
            <strong className="uppercase">{row.human.verdict}</strong> — {row.human.reason}
          </div>
          <div className="mt-1 text-xs opacity-80">
            Answer above to replace it, or move on and it stays as it is.
          </div>
        </div>
      )}
    </div>
  );
}
