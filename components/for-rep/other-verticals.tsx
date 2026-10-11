// components/for-rep/other-verticals.tsx
//
// The divider under the restaurants section on a sales page: restaurants are the main event
// (owner, 2026-10-10 — "walk in, have lunch, drop a card"); everything below it is the rest of
// what QuickSites does and how it pays. One honest line, no promise.
//
// ⚠️ Two variants of the line, because the line names what is BELOW it and the pages differ:
// the rep pages (/for-abdou, /for-angela, /for-ryan) carry a referral code and a straight-talk
// section, so the full line points at both; /for-sales has neither (straight talk hidden by the
// owner, 2026-10-10), so it passes `lineBrief` — the same sentence with those two clauses cut.
// A divider promising a section that is not on the page is the small version of a stale doc.
export const OTHER_VERTICALS_COPY = {
  kicker: 'Our other verticals',
  line: 'Restaurants are the fastest yes and the easiest walk-in. Everything below is the rest of what QuickSites does and how it pays — sites for trades that rent monthly once they are found, a referral code that earns on any business you bring, and the straight talk on what is proven and what is not yet.',
  lineBrief:
    'Restaurants are the fastest yes and the easiest walk-in. Everything below is the rest of what QuickSites does and how it pays — sites for trades that rent monthly once they are found.',
} as const;

export default function OtherVerticals({ line = OTHER_VERTICALS_COPY.line }: { line?: string }) {
  return (
    <section className="mx-auto max-w-3xl px-6 pb-2 pt-12">
      <div className="border-t border-zinc-800 pt-8">
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">{OTHER_VERTICALS_COPY.kicker}</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">{line}</p>
      </div>
    </section>
  );
}
