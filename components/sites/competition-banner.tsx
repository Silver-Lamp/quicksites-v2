'use client';

// Shown at the top of an unclaimed outreach site when a geo campaign has a live race for
// its domain. Names the actual competing businesses (like the mailed poster) + a live
// countdown to the claim deadline, to make it clear the site is up for grabs — "first to
// claim wins". Collapses to a slim strip so it frames the arrival without burying the site.
import * as React from 'react';

/** Live ms-remaining to an ISO deadline. null deadline or SSR → null (render a placeholder). */
function useCountdown(deadlineIso: string | null): number | null {
  const target = React.useMemo(() => (deadlineIso ? new Date(deadlineIso).getTime() : null), [deadlineIso]);
  const [remaining, setRemaining] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (target == null) return;
    const tick = () => setRemaining(Math.max(0, target - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  return remaining;
}

function parts(ms: number) {
  const s = Math.floor(ms / 1000);
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}
const pad = (n: number) => String(n).padStart(2, '0');

function Countdown({ deadlineIso }: { deadlineIso: string | null }) {
  const remaining = useCountdown(deadlineIso);
  if (!deadlineIso || remaining === null) return null; // no deadline or not mounted yet
  if (remaining <= 0) {
    return <div className="mt-2 text-sm font-semibold text-amber-300">⏳ Final call — this domain is being claimed now.</div>;
  }
  const t = parts(remaining);
  const cells: [number, string][] = [
    [t.d, 'days'],
    [t.h, 'hrs'],
    [t.m, 'min'],
    [t.s, 'sec'],
  ];
  return (
    <div className="mt-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300/80">Claim window closes in</div>
      <div className="mt-1 flex items-center justify-center gap-1.5" role="timer" aria-live="off">
        {cells.map(([v, label], i) => (
          <React.Fragment key={label}>
            {i > 0 && <span className="text-lg font-bold text-slate-500">:</span>}
            <div className="min-w-[3rem] rounded-lg border border-slate-500/30 bg-white/[0.06] px-2 py-1">
              <div className="font-mono text-xl font-bold tabular-nums text-white">{pad(v)}</div>
              <div className="text-[9px] uppercase tracking-wide text-slate-400">{label}</div>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/** Compact "6d 14:22:07 left" for the collapsed strip. */
function CompactCountdown({ deadlineIso }: { deadlineIso: string | null }) {
  const remaining = useCountdown(deadlineIso);
  if (!deadlineIso || remaining === null || remaining <= 0) return null;
  const t = parts(remaining);
  return (
    <span className="ml-2 font-mono text-amber-300/90 tabular-nums">
      {t.d > 0 ? `${t.d}d ` : ''}{pad(t.h)}:{pad(t.m)}:{pad(t.s)} left
    </span>
  );
}

export default function CompetitionBanner({
  domain,
  city,
  industryLabel,
  competitors,
  claimHref,
  deadlineIso,
}: {
  domain: string;
  city: string;
  industryLabel: string;
  competitors: string[];
  claimHref: string;
  deadlineIso: string | null;
}) {
  const [open, setOpen] = React.useState(true);
  const n = competitors.length;
  const shown = competitors.slice(0, 6);
  const extra = n - shown.length;

  if (!open) {
    return (
      <div className="w-full bg-[#0b1020] px-4 py-1.5 text-center text-xs text-amber-200/90 print:hidden">
        <span className="font-mono text-emerald-300">{domain}</span> is up for grabs
        <CompactCountdown deadlineIso={deadlineIso} /> —{' '}
        <a href={claimHref} className="font-semibold text-amber-300 underline underline-offset-2 hover:text-amber-200">
          claim it first →
        </a>
        <button onClick={() => setOpen(true)} className="ml-2 text-neutral-500 hover:text-neutral-300" aria-label="Expand">▾</button>
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden px-4 py-4 text-center text-white print:hidden"
      style={{ background: 'radial-gradient(120% 140% at 50% 0%, #16233f 0%, #0b1020 65%)' }}>
      <button
        onClick={() => setOpen(false)}
        aria-label="Minimize"
        className="absolute right-3 top-2 rounded-full p-1 text-neutral-500 transition hover:text-neutral-200"
      >
        ✕
      </button>

      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-300">
        {city} · {industryLabel}
      </div>
      <div className="mt-1 text-lg font-extrabold sm:text-xl">
        Who will control <span className="font-mono text-emerald-300">{domain}</span>?
      </div>
      <p className="mx-auto mt-1 max-w-xl text-sm text-neutral-300">
        This premium local domain goes to <b>one</b> business. {n} {city} {industryLabel.toLowerCase()} businesses
        are in the running — first to claim it wins.
      </p>

      <Countdown deadlineIso={deadlineIso} />

      <div className="mx-auto mt-3 flex max-w-2xl flex-wrap items-center justify-center gap-1.5">
        {shown.map((b) => (
          <span key={b} className="rounded-full border border-slate-500/30 bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-slate-100">
            {b}
          </span>
        ))}
        {extra > 0 && <span className="text-xs text-neutral-400">+{extra} more</span>}
      </div>

      <a
        href={claimHref}
        className="mt-3 inline-flex items-center justify-center rounded-full bg-amber-400 px-5 py-2 text-sm font-bold text-neutral-950 transition hover:bg-amber-300"
      >
        Claim it before they do →
      </a>
    </div>
  );
}
