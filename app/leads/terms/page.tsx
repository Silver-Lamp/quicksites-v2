// app/leads/terms/page.tsx — the pay-per-call terms the pitch text links to.
//
// Every figure is read from the constants the account table charges (PPL_DEFAULTS, DEALS); no
// number is typed here, so changing the deal changes the page. Short on purpose: a tradesperson
// reads it on a phone between jobs.
import type { Metadata } from 'next';
import { PPL_DEFAULTS } from '@/lib/ppl/rules';
import { DEALS, usd } from '@/lib/ppl/pitchPlan';

export const dynamic = 'force-static';
export const metadata: Metadata = { title: 'Pay-per-call terms — QuickSites', robots: { index: false, follow: false } };

export default function PplTermsPage() {
  const next = DEALS.next;
  const pkg = DEALS.package;
  const secs = PPL_DEFAULTS.minBillableSeconds;
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">QuickSites</p>
        <h1 className="mt-1 text-2xl font-semibold">Pay-per-call terms</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          A QuickSites page for your trade and town carries a phone number. Calls to it ring your phone. These are the terms for paying for those calls.
        </p>
        <ol className="mt-6 space-y-4 text-sm leading-relaxed" data-ppl-terms>
          <li>
            <strong>What counts as a call.</strong> A call you answer that lasts {secs} seconds or more. Shorter calls, calls you do not answer, wrong numbers, robocalls and sales calls are never charged.
          </li>
          <li>
            <strong>Price.</strong> {usd(next.cplCents)} per call. Or {pkg.leads} calls for {usd(pkg.depositCents)} ({usd(pkg.cplCents)} each) paid up front.
          </li>
          <li>
            <strong>Prepaid, always one ahead.</strong> You pay for the next call before it comes. On the per-call plan your card is charged {usd(next.cplCents)} as each call is counted, so you are always exactly one call ahead and never behind. On the package, when the balance drops below one call it tops up another {usd(pkg.depositCents)}. You never owe us money after the fact.
          </li>
          <li>
            <strong>If a charge fails.</strong> The line tells callers it is not connecting and stops ringing you until the card is fixed. Nobody rings into silence.
          </li>
          <li>
            <strong>Every charge is a text.</strong> With the caller&rsquo;s number. A statement page shows every call and charge.
          </li>
          <li>
            <strong>Contesting a call.</strong> Within {PPL_DEFAULTS.disputeWindowHours} hours of a charge, from the statement page. A contested call that was not a real customer is credited back.
          </li>
          <li>
            <strong>Unused balance.</strong> Refundable on request.
          </li>
          <li>
            <strong>Stopping.</strong> Reply STOP to any text and we stop texting. Ask and we stop the line, refund what is unused, and close the account.
          </li>
          <li>
            <strong>What we do not promise.</strong> Any number of calls, any ranking, or any outcome. We tell you what the line received; whether a call becomes a job is between you and the caller.
          </li>
        </ol>
        <p className="mt-8 text-xs text-muted-foreground">Questions: reply to the text you received, or email the address on your statement page.</p>
      </div>
    </main>
  );
}
