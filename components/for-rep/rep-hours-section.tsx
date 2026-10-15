// components/for-rep/rep-hours-section.tsx (server)
//
// The hours log, mounted on EVERY rep page and rendering only when the code's hourly option is on
// (lib/rep/hoursDb.ts). This is what makes the per-rep switch on /admin/rep-hours mean something:
// turning hourly on for Abdou puts the log on /for-abdou without a code change, and turning it off
// takes it away. The rate card above the log is derived from the row too, never typed.
import { loadHourly } from '@/lib/rep/hoursDb';
import { moneyFromCents, PAID_BY_LABEL } from '@/lib/rep/hours';
import HoursLog from '@/components/for-rep/hours-log';

export default async function RepHoursSection({ code, repName, token }: { code: string; repName: string; token: string }) {
  const arr = await loadHourly(code);
  if (!arr.enabled || arr.rateCents == null) return null;
  return (
    <section className="mx-auto max-w-3xl px-6 pb-4 pt-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">Your time</h2>
        <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">
          {moneyFromCents(arr.rateCents)}/hr · paid by {arr.paidBy ? PAID_BY_LABEL[arr.paidBy] : '—'}
        </span>
      </div>
      <HoursLog token={token} repName={repName} />
    </section>
  );
}
