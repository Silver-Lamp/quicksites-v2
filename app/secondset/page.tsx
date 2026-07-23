// app/secondset/page.tsx
// Marketing landing for SecondSet — the auto-shop transparency pilot (glasses capture →
// customer trust portal). HONEST FRAMING: this is a pilot, not a GA product. No invented
// pricing, no "buy now" — it's a "get on the pilot list" conversation. The capture rail +
// hardware are gated OFF in prod; the customer-facing portal is the durable surface.
import Link from 'next/link';
import SiteHeader from '@/components/site/site-header';
import { marketingOg } from '@/lib/marketingOg';

export const metadata = marketingOg({
  title: 'SecondSet — show customers the work before they pay',
  description:
    'A transparency layer for auto shops: your tech captures a photo of the actual problem and a short voice note, the customer sees it in their own portal, hears the plain-English summary, and approves the repair before it happens. Pilot program.',
  path: '/secondset',
  ogEyebrow: 'For auto shops · pilot',
  ogTitle: 'Show the work. Earn the trust. Get the approval.',
  ogSubtitle:
    'A photo of the real problem + your tech’s note, in the customer’s own portal — so they approve the repair before it happens.',
});

const MAILTO =
  'mailto:hello@quicksites.ai?subject=SecondSet%20pilot%20%E2%80%94%20interested&body=Shop%20name%3A%0ACity%3A%0AApprox.%20cars%2Fweek%3A%0A';

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="text-left">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 font-bold text-zinc-950">
        {n}
      </div>
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

export default function SecondSetPage() {
  return (
    <>
      <SiteHeader />
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-6 pt-20 pb-14 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
            For auto shops · pilot program
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">
            Show customers the work <span className="text-emerald-400">before</span> they pay for it.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-zinc-400">
            Your tech snaps a photo of the actual problem and records a short note. The customer opens
            their own private link, sees the picture, hears the plain-English summary, and taps{' '}
            <span className="font-semibold text-zinc-200">approve</span> — before the wrench turns. Fewer
            “why is this so expensive?” calls. More yeses.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href={MAILTO}
              className="rounded-lg bg-emerald-500 px-7 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-emerald-400"
            >
              Join the pilot
            </a>
            <Link
              href="/secondset/auto-shops"
              className="rounded-lg border border-zinc-700 px-7 py-3 text-base font-medium text-zinc-200 transition hover:border-zinc-500"
            >
              The apex directory idea →
            </Link>
          </div>
          <p className="mt-4 text-xs text-zinc-600">
            An early pilot — we onboard shops one at a time. No credit card, no long form.
          </p>
        </section>

        {/* How it works */}
        <section className="border-t border-zinc-800/70 bg-zinc-900/20">
          <div className="mx-auto max-w-5xl px-6 py-14">
            <h2 className="text-center text-2xl font-bold">How a repair goes with SecondSet</h2>
            <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-3">
              <Step
                n="1"
                title="Capture on the floor"
                body="Before touching the car, the tech captures a photo of the real problem and a 10-second voice note — hands-free."
              />
              <Step
                n="2"
                title="Customer sees it — in their words"
                body="They open a private link (no app). The photo, the note, and a plain-English summary they can listen to. No jargon, no surprises."
              />
              <Step
                n="3"
                title="They approve before you start"
                body="One tap: approve or decline. You have a documented yes before the work happens — and a record if anyone asks later."
              />
            </div>
          </div>
        </section>

        {/* Why it matters */}
        <section className="mx-auto max-w-5xl px-6 py-14">
          <h2 className="text-center text-2xl font-bold">Why shops want this</h2>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
            <Card icon="🤝" title="Trust closes the sale">
              People approve work they can see. A photo of the worn part beats a line item on an
              estimate every time.
            </Card>
            <Card icon="📉" title="Fewer pushback calls">
              The “why does this cost so much?” conversation happens up front, with evidence — not on
              the phone after the fact.
            </Card>
            <Card icon="🗂️" title="A record, automatically">
              Every approval is timestamped with the photo and note that earned it. Good for the
              customer, good for you.
            </Card>
          </div>
        </section>

        {/* Honesty / consent */}
        <section className="border-t border-zinc-800/70 bg-zinc-900/20">
          <div className="mx-auto max-w-3xl px-6 py-14 text-center">
            <h2 className="text-2xl font-bold">Built on consent, not surveillance</h2>
            <p className="mx-auto mt-4 max-w-2xl text-zinc-400">
              The customer agrees before anything is captured for their job, and captures are tied to{' '}
              <span className="font-medium text-zinc-200">that one repair</span> — shown only in that
              customer’s private portal, never a public feed. Techs capture the car and the part, not
              people. It’s a trust tool; we built it to act like one.
            </p>
            <div className="mt-8">
              <a
                href={MAILTO}
                className="rounded-lg bg-emerald-500 px-7 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-emerald-400"
              >
                Talk to us about the pilot
              </a>
            </div>
          </div>
        </section>

        <footer className="border-t border-zinc-800/70 py-6 text-center text-xs text-zinc-600">
          &copy; {new Date().getFullYear()} QuickSites.ai —{' '}
          <Link href="/" className="underline hover:text-zinc-300">
            Home
          </Link>
          <span className="mx-1">•</span>
          <Link href="/features" className="underline hover:text-zinc-300">
            Features
          </Link>
          <span className="mx-1">•</span>
          <Link href="/compare" className="underline hover:text-zinc-300">
            Compare
          </Link>
        </footer>
      </div>
    </>
  );
}
