// app/secondset/page.tsx
// SecondSet product page — the auto-shop (and next: HVAC/towing/contractors) service-transparency
// pilot. Two audiences on one page: the service business (the buyer) and the end customer (the
// trust/portal experience). Positioning: "See the work. Trust the bill." Powered by HiveJournal's
// glasses/capture rail (crosstalk/contracts/glasses-capture.md). HONEST framing: code-complete both
// sides but DARK until a pilot shop — early/pilot pitch, no fake claims, no invented pricing.
import Link from 'next/link';
import SiteHeader from '@/components/site/site-header';
import { marketingOg } from '@/lib/marketingOg';

export const metadata = marketingOg({
  title: 'SecondSet — see the work, trust the bill',
  description:
    'A service-transparency layer for auto shops (and, next, HVAC / towing / contractors): the tech shows the customer the actual worn part — a photo and a spoken note — so they approve each line item before the work happens. Pilot program.',
  path: '/secondset',
  ogEyebrow: 'For service businesses · pilot',
  ogTitle: 'See the work. Trust the bill.',
  ogSubtitle:
    'The tech shows the customer the real problem — photo + spoken note — so they approve the repair before it happens.',
});

const MAILTO =
  'mailto:hello@quicksites.ai?subject=SecondSet%20pilot%20%E2%80%94%20interested&body=Business%20name%3A%0ATrade%20(auto%2FHVAC%2Ftowing%2Fother)%3A%0ACity%3A%0AApprox.%20jobs%2Fweek%3A%0A';

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="text-left">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 font-bold text-zinc-950">{n}</div>
      <h4 className="mt-3 font-semibold text-white">{title}</h4>
      <p className="mt-1 text-sm text-zinc-400">{body}</p>
    </div>
  );
}

function Card({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 text-left">
      <div className="text-2xl">{icon}</div>
      <h4 className="mt-2 text-base font-semibold text-white">{title}</h4>
      <p className="mt-2 text-sm text-zinc-400">{children}</p>
    </div>
  );
}

const VERTICALS = [
  { icon: '🔧', label: 'Auto repair', status: 'Piloting first' },
  { icon: '❄️', label: 'HVAC', status: 'Next' },
  { icon: '🛻', label: 'Towing & roadside', status: 'Next' },
  { icon: '🔨', label: 'Contractors', status: 'Next' },
];

export default function SecondSetPage() {
  return (
    <>
      <SiteHeader />
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-6 pt-20 pb-14 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
            For service businesses · pilot program
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">
            See the work. <span className="text-emerald-400">Trust the bill.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-zinc-400">
            Your tech shows the customer the actual problem — a photo of the worn part and a quick spoken
            note — right in the customer’s own private link. They see it, hear the plain-English summary,
            and approve each line item before the wrench turns. Fewer “why is this so expensive?” calls.
            More approved work.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href={MAILTO} className="rounded-lg bg-emerald-500 px-7 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-emerald-400">
              Join the pilot
            </a>
            <Link href="/secondset/auto-shops" className="rounded-lg border border-zinc-700 px-7 py-3 text-base font-medium text-zinc-200 transition hover:border-zinc-500">
              The directory idea →
            </Link>
          </div>
          <p className="mt-4 text-xs text-zinc-600">
            An early pilot — we onboard businesses one at a time. No credit card, no long form.
          </p>
        </section>

        {/* How it works */}
        <section className="border-t border-zinc-800/70 bg-zinc-900/20">
          <div className="mx-auto max-w-5xl px-6 py-14">
            <h2 className="text-center text-2xl font-bold">How a job goes with SecondSet</h2>
            <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-3">
              <Step n="1" title="Capture on the floor" body="Before touching the job, the tech captures a photo of the real problem and a 10-second voice note — hands-free, through their glasses." />
              <Step n="2" title="The customer sees it — in their words" body="They open a private link (no app). The photo, the note, and a plain-English summary they can listen to. No jargon, no surprises." />
              <Step n="3" title="They approve before you start" body="One tap per line item: approve or decline. You have a documented yes before the work happens — and a record if anyone asks later." />
            </div>
            <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-zinc-500">
              Capture runs on HiveJournal’s glasses/capture rail; the customer portal, approvals, and the
              owner→tech voice notes are the QuickSites layer on top.
            </p>
          </div>
        </section>

        {/* Two audiences */}
        <section className="mx-auto max-w-5xl px-6 py-14">
          <h2 className="text-center text-2xl font-bold">One tool, two sides</h2>
          <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-left">
              <div className="text-xs font-semibold uppercase tracking-widest text-emerald-400">For your shop</div>
              <h3 className="mt-2 text-lg font-semibold text-white">Close more work, take fewer angry calls</h3>
              <ul className="mt-3 space-y-2 text-sm text-zinc-400">
                <li>• Approvals land with evidence attached — people say yes to work they can see.</li>
                <li>• The pushback conversation happens up front, not on the phone after the invoice.</li>
                <li>• Every approval is timestamped with the photo + note that earned it.</li>
                <li>• Talk to the tech mid-job — a voice note plays in their ear, hands-free.</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-left">
              <div className="text-xs font-semibold uppercase tracking-widest text-sky-400">For your customers</div>
              <h3 className="mt-2 text-lg font-semibold text-white">Finally, proof instead of “trust us”</h3>
              <ul className="mt-3 space-y-2 text-sm text-zinc-400">
                <li>• A private link — no app, no account.</li>
                <li>• See the actual worn part, hear what’s wrong in plain English.</li>
                <li>• Approve or decline each line item, on their own time.</li>
                <li>• A clear record of exactly what they agreed to and why.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Verticals */}
        <section className="border-t border-zinc-800/70 bg-zinc-900/20">
          <div className="mx-auto max-w-5xl px-6 py-14 text-center">
            <h2 className="text-2xl font-bold">Auto repair first — more trades next</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-zinc-400">
              We’re piloting with auto shops, where “show me the part” matters most. The same trust layer
              fits any trade where a customer has to approve work they can’t easily see.
            </p>
            <div className="mx-auto mt-8 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
              {VERTICALS.map((v) => (
                <div key={v.label} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                  <div className="text-2xl">{v.icon}</div>
                  <div className="mt-2 text-sm font-semibold text-white">{v.label}</div>
                  <div className="mt-0.5 text-[11px] text-emerald-400">{v.status}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Why it matters */}
        <section className="mx-auto max-w-5xl px-6 py-14">
          <h2 className="text-center text-2xl font-bold">Why businesses want this</h2>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
            <Card icon="🤝" title="Trust closes the sale">
              People approve work they can see. A photo of the worn part beats a line on an estimate every time.
            </Card>
            <Card icon="📉" title="Fewer pushback calls">
              The “why does this cost so much?” conversation happens up front, with evidence — not after the fact.
            </Card>
            <Card icon="🗂️" title="A record, automatically">
              Every approval is timestamped with the photo and note that earned it. Good for the customer, good for you.
            </Card>
          </div>
        </section>

        {/* Honesty / consent */}
        <section className="border-t border-zinc-800/70 bg-zinc-900/20">
          <div className="mx-auto max-w-3xl px-6 py-14 text-center">
            <h2 className="text-2xl font-bold">Built on consent, not surveillance</h2>
            <p className="mx-auto mt-4 max-w-2xl text-zinc-400">
              The customer agrees before anything is captured for their job, and captures are tied to{' '}
              <span className="font-medium text-zinc-200">that one job</span> — shown only in that customer’s
              private portal, never a public feed. Techs capture the equipment and the part, not people. It’s
              a trust tool; we built it to act like one.
            </p>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-zinc-500">
              SecondSet is a new, early pilot — we’re onboarding a handful of businesses to get it right before
              we scale. No inflated claims: just a straight-ahead way to show the work.
            </p>
            <div className="mt-8">
              <a href={MAILTO} className="rounded-lg bg-emerald-500 px-7 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-emerald-400">
                Talk to us about the pilot
              </a>
            </div>
          </div>
        </section>

        <footer className="border-t border-zinc-800/70 py-6 text-center text-xs text-zinc-600">
          &copy; {new Date().getFullYear()} QuickSites.ai —{' '}
          <Link href="/" className="underline hover:text-zinc-300">Home</Link>
          <span className="mx-1">•</span>
          <Link href="/features" className="underline hover:text-zinc-300">Features</Link>
          <span className="mx-1">•</span>
          <Link href="/compare" className="underline hover:text-zinc-300">Compare</Link>
        </footer>
      </div>
    </>
  );
}
