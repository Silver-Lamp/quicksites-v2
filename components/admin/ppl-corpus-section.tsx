// components/admin/ppl-corpus-section.tsx — "what the calls say", on /admin/ppl.
//
// Every figure is read from lib/ppl/corpus.ts on this request. The recommendations are the
// 2026-10-16 analysis turned into rules over the rows: a line is listed under "pitch now"
// because it has a customer-read lead ≥90 s today, not because its name was typed here.
import Link from 'next/link';
import type { CorpusSummary, LineRow } from '@/lib/ppl/corpus';
import { DEMAND_MIN_IMPRESSIONS, NUMBER_MONTHLY_USD } from '@/lib/ppl/corpus';

const pct = (n: number | null) => (n == null ? '—' : `${Math.round(n * 100)}%`);
const num = (n: number | null | undefined) => (n == null ? '—' : String(n));
const READ_LABEL: Record<string, string> = {
  customer: 'customer',
  vendor_or_sales: 'vendor / sales',
  robocall: 'robocall',
  wrong_number: 'wrong number',
  own_business: 'business rang itself',
  operator_test: 'operator test',
  unknown: 'unknown',
};

function Card({ title, children, tone }: { title: string; children: React.ReactNode; tone?: 'good' | 'warn' | 'bad' }) {
  const ring = tone === 'good' ? 'border-emerald-500/30' : tone === 'warn' ? 'border-amber-500/30' : tone === 'bad' ? 'border-rose-500/30' : 'border-border';
  return (
    <div className={`rounded-xl border ${ring} bg-card p-4 text-card-foreground`}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="mt-2 text-sm">{children}</div>
    </div>
  );
}

function LineList({ rows, empty, note }: { rows: LineRow[]; empty: string; note: (l: LineRow) => string }) {
  if (!rows.length) return <p className="text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-1">
      {rows.map((l) => (
        <li key={l.campaignId}>
          <span className="font-medium">{l.domain}</span>
          {l.forwardToName ? <span className="text-muted-foreground"> → {l.forwardToName}</span> : null}
          <span className="text-muted-foreground"> · {note(l)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function PplCorpusSection({ s }: { s: CorpusSummary }) {
  const o = s.outcomes30d;
  const a = s.outcomesAll;
  const customers = s.reads.find((r) => r.read === 'customer')?.count ?? 0;
  const junk = s.reads.filter((r) => r.read === 'vendor_or_sales' || r.read === 'robocall' || r.read === 'wrong_number').reduce((n, r) => n + r.count, 0);
  const at90 = s.billableAt.find((b) => b.seconds === 90);
  const grossAt85 = o.leads90 * 85;
  return (
    <section className="mt-10" data-ppl-corpus>
      <h2 className="text-lg font-semibold">The corpus — what the calls say</h2>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
        Every number here is re-derived from <code>call_logs</code>, <code>geo_industry_campaigns</code> and the Search Console harvest on this load. The recommendations are rules over those rows, not a list anyone maintains.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card title={`Last ${s.windowDays} days`}>
          <table className="w-full text-xs">
            <tbody>
              <tr><td className="py-0.5 text-muted-foreground">Calls</td><td className="text-right font-medium">{o.calls}</td></tr>
              <tr><td className="py-0.5 text-muted-foreground">Answered ≥90 s (billable at the default rule)</td><td className="text-right font-medium">{o.leads90}</td></tr>
              <tr><td className="py-0.5 text-muted-foreground">Answered 15–89 s</td><td className="text-right">{o.answered15to89}</td></tr>
              <tr><td className="py-0.5 text-muted-foreground">Brief (&lt;15 s)</td><td className="text-right">{o.brief}</td></tr>
              <tr><td className="py-0.5 text-muted-foreground">Rang out / busy</td><td className="text-right">{o.unanswered}</td></tr>
              <tr><td className="py-0.5 text-muted-foreground">Voicemails (no speech / not a lead)</td><td className="text-right">{o.voicemails} ({o.voicemailNoSpeech} / {o.voicemailNotLead})</td></tr>
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">Gross if every ≥90 s call billed at $85: ${grossAt85}/mo. All-time: {a.calls} calls, {a.leads90} ≥90 s, {s.distinctCallers} distinct callers.</p>
        </Card>
        <Card title="Who is calling (AI read, analysed calls)">
          {s.readsTotal ? (
            <ul className="space-y-0.5 text-xs">
              {s.reads.map((r) => (
                <li key={r.read} className="flex justify-between">
                  <span>{READ_LABEL[r.read] ?? r.read}</span>
                  <span className="font-medium">{r.count}{r.leads90 ? <span className="text-muted-foreground"> ({r.leads90} ≥90 s)</span> : null}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-muted-foreground">No analysed calls yet.</p>}
          <p className="mt-2 text-xs text-muted-foreground">Customers {pct(s.customerShare)} of analysed calls; vendors + robocalls {s.readsTotal ? pct(junk / s.readsTotal) : '—'}. {customers ? `Customer calls lasted ${s.customerCallDurations.join(', ')} s.` : ''}</p>
        </Card>
        <Card title="Billing threshold — what would bill" tone={at90 && customers && at90.customerCalls < customers ? 'warn' : undefined}>
          <table className="w-full text-xs">
            <thead><tr className="text-muted-foreground"><th className="text-left font-normal">Minimum</th><th className="text-right font-normal">customer calls</th><th className="text-right font-normal">all answered</th></tr></thead>
            <tbody>
              {s.billableAt.map((b) => (
                <tr key={b.seconds}><td className="py-0.5">{b.seconds} s{b.seconds === 90 ? ' (default)' : ''}</td><td className="text-right font-medium">{b.customerCalls}</td><td className="text-right">{b.allAnswered}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">A tow dispatch is often under a minute; the rule decides how many real jobs are free.</p>
        </Card>
        <Card title="Cost of the lines">
          <p><span className="text-2xl font-bold">${s.numberCostMonthlyUsd.toFixed(2)}</span><span className="text-muted-foreground">/mo</span></p>
          <p className="mt-1 text-xs text-muted-foreground">{s.numbers} numbers × ${NUMBER_MONTHLY_USD}; {s.connectedMinutesAll} connected minutes all-time; ~1¢ per call for the analysis.</p>
          <p className="mt-2 text-xs text-muted-foreground">Page-one domains we own: {s.supply.pageOne}, of which {s.supply.pageOneWithNumber} carry a number.</p>
        </Card>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <Card title="Pitch now — a customer-read call of 90 s or more on the line" tone={s.pitchNow.length ? 'good' : undefined}>
          <LineList rows={s.pitchNow} empty="No line has a customer-read call of 90 s or more yet. The pitch is “here is what you received”; wait for the evidence." note={(l) => `${l.customerLeads90} customer call${l.customerLeads90 === 1 ? '' : 's'} ≥90 s${l.rankStatus === 'page1' ? `, page 1 (${num(l.rankPosition)})` : ''}${l.impressions28d != null ? `, ${l.impressions28d} impressions / ${l.clicks28d ?? 0} clicks in 28 d` : ''}`} />
        </Card>
        <Card title={`Demand with no number — ≥${DEMAND_MIN_IMPRESSIONS} impressions in the latest 28 days, no line`} tone={s.supply.demandWithoutNumber.length ? 'warn' : undefined}>
          {s.supply.demandWithoutNumber.length ? (
            <>
              <ul className="columns-2 text-xs">
                {s.supply.demandWithoutNumber.map((r) => (
                  <li key={r.domain}>{r.domain} <span className="text-muted-foreground">({r.impressions28d} impr{r.rankStatus === 'page1' ? `, p1 ${num(r.rankPosition)}` : ''})</span></li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">Rank is not demand: a position-1.3 domain with 4 impressions is first for a query nobody types. Directories and restaurants are excluded. Adding all {s.supply.demandWithoutNumber.length} ≈ ${(s.supply.demandWithoutNumber.length * NUMBER_MONTHLY_USD).toFixed(2)}/mo; a line needs a swept business to forward to. Attach from “Tracked campaigns” below.</p>
            </>
          ) : <p className="text-muted-foreground">Every trade domain with measurable demand carries a number.</p>}
        </Card>
        <Card title="Destinations that do not answer — test-dial from an ordinary phone before re-pointing" tone={s.nonAnswerers.length ? 'bad' : undefined}>
          <LineList rows={s.nonAnswerers} empty="No destination with 3+ dials and no answer." note={(l) => `0 of ${l.dials} answered`} />
          <p className="mt-2 text-xs text-muted-foreground">We bill only answered calls, so an unanswered line earns nothing and loses the caller. “They screen us” and “they answer nobody” look identical through our bridge (§11e).</p>
        </Card>
        <Card title="Noise lines — mostly vendors and robocalls, no customer yet">
          <LineList rows={s.noiseLines} empty="None." note={(l) => `${l.junk} of ${l.calls} calls junk${l.ageDays != null ? `, ${l.ageDays} days old` : ''}${l.impressions28d != null ? `, ${l.impressions28d} impressions / 28 d` : ''}`} />
          <p className="mt-2 text-xs text-muted-foreground">New, unranked domains draw prospectors, not customers. Judge a line after it ranks and has impressions.</p>
        </Card>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Line</th>
              <th className="px-3 py-2 font-medium">Rank</th>
              <th className="px-3 py-2 font-medium">Impr / clicks 28 d</th>
              <th className="px-3 py-2 font-medium">Age</th>
              <th className="px-3 py-2 font-medium">Forward-to</th>
              <th className="px-3 py-2 text-right font-medium">Dials</th>
              <th className="px-3 py-2 text-right font-medium">Answered</th>
              <th className="px-3 py-2 text-right font-medium">≥90 s</th>
              <th className="px-3 py-2 text-right font-medium">Customer</th>
              <th className="px-3 py-2 text-right font-medium">Junk</th>
              <th className="px-3 py-2 text-right font-medium">Own / test</th>
            </tr>
          </thead>
          <tbody>
            {s.lines.map((l) => (
              <tr key={l.campaignId} className="border-t border-border">
                <td className="px-3 py-1.5 font-medium"><Link href={`/admin/call-logs?domain=${encodeURIComponent(l.domain)}`} className="hover:underline">{l.domain}</Link></td>
                <td className="px-3 py-1.5">{l.rankStatus ?? '—'}{l.rankPosition != null ? ` ${l.rankPosition}` : ''}</td>
                <td className="px-3 py-1.5">{l.impressions28d == null ? '—' : `${l.impressions28d} / ${l.clicks28d ?? 0}`}</td>
                <td className="px-3 py-1.5">{l.ageDays == null ? '—' : `${l.ageDays} d`}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{l.forwardToName ?? '—'}</td>
                <td className="px-3 py-1.5 text-right">{l.dials}</td>
                <td className="px-3 py-1.5 text-right">{l.answered}{l.answerRate != null ? <span className="text-muted-foreground"> ({pct(l.answerRate)})</span> : null}</td>
                <td className={`px-3 py-1.5 text-right ${l.leads90 ? 'font-semibold text-emerald-300' : ''}`}>{l.leads90}</td>
                <td className={`px-3 py-1.5 text-right ${l.customers ? 'font-semibold text-emerald-300' : ''}`}>{l.customers}</td>
                <td className={`px-3 py-1.5 text-right ${l.junk ? 'text-amber-300' : ''}`}>{l.junk}</td>
                <td className="px-3 py-1.5 text-right text-muted-foreground">{l.ownOrTest}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Dials exclude the business ringing its own line and operator tests. “Customer” and “junk” are the per-call AI read (lib/ppl/callAnalysis.ts), which gates nothing. The open honesty item before anyone pays: the pitch site names a company that does not exist — name the real business on the page it pays for.
      </p>
    </section>
  );
}
