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

type Row = {
  index: number;
  nicheKey: string | null;
  query: string;
  location: string;
  isControl: boolean;
  searchUrl: string;
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

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-neutral-500">
          Search {row.index} of {rows.length}
        </span>
        <span className="text-xs text-neutral-500">{answered.length} answered</span>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded bg-neutral-800">
        <div className="h-full bg-sky-500 transition-all" style={{ width: `${(answered.length / rows.length) * 100}%` }} />
      </div>

      {row.isControl && (
        <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <strong>This is the control.</strong> We know this query loses. If it scores anything but
          “skip”, something is wrong with the reading — yours or the tool’s — and the rest of the
          run can’t be trusted. That’s why it’s first.
        </div>
      )}

      <div className="mt-5 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
        <div className="text-xs uppercase tracking-wide text-neutral-500">Search this, with your location set to {city}</div>
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
        <p className="mt-2 text-xs text-neutral-500">
          Use an incognito window. Set the location in DevTools → Sensors, or trust the city in the
          query — just be consistent across the run.
        </p>
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

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={save}
            disabled={pack === null || saving}
            className="rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save and next'}
          </button>
          {pack === null && <span className="text-xs text-neutral-500">Pack size is the one answer that decides the verdict.</span>}
          {cursor < rows.length - 1 && (
            <button onClick={() => { setCursor((c) => c + 1); reset(); }} className="text-xs text-neutral-500 underline">
              skip this one
            </button>
          )}
        </div>
      </div>

      {row.human && (
        <div className={`mt-4 rounded-xl border p-4 text-sm ${VERDICT_STYLE[row.human.verdict] ?? ''}`}>
          <strong className="uppercase">{row.human.verdict}</strong> — {row.human.reason}
        </div>
      )}
    </div>
  );
}
