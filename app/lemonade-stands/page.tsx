// app/lemonade-stands/page.tsx
//
// Public landing for the lemonade-stand vertical. Same shape as /restaurants, but the audience
// is different in a way that decides most of the copy:
//
// ⚠️ THIS PAGE TALKS TO THE GROWN-UP, NOT THE KID. Every consumer payment app requires an account
// holder who is 18+, so the account can never be the child's — the parent's handle takes the
// money and the kid runs the stand. Writing this page at kids would be both a lie about who can
// complete the flow and an invitation for a nine-year-old to try to open a payments account.
// Every CTA here is addressed to whoever owns the driveway.
//
// Payments are a HAND-OFF to the parent's own Venmo / Cash App / PayPal, not a Stripe Connect
// account (owner decision 2026-08-14, docs/LEMONYUM_PLAN.md §2a). The earlier draft of this page
// described connecting a bank through Stripe: real card acceptance, but an SSN-and-bank
// onboarding and a multi-day first payout, for someone selling $2 cups on a Saturday. Handles
// cost nothing, take a minute, and mean no fee is deducted from a $2 cup at all.
//
// The other deliberate omission: nothing on this page or in the scaffold asks for a child's full
// name, photo or address. A stand page is already a public note that a particular kid is at a
// particular house on a particular afternoon.
import Link from 'next/link';
import SiteHeader from '@/components/site/site-header';
import { marketingOg } from '@/lib/marketingOg';

export const metadata = marketingOg({
  title: 'Lemonade stand payments — take cards with a QR code | QuickSites',
  description:
    'Your kid’s lemonade stand, but nobody walks away because they have no cash. A free page with the menu, a printable QR sign, and card payments that land in your bank account.',
  path: '/lemonade-stands',
  ogEyebrow: 'For lemonade stands',
  ogTitle: '“Sorry, I don’t have any cash.”',
  ogSubtitle: 'Now they do. Scan, tap, done — and the money lands in your account.',
});

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 text-left">
      <h4 className="text-base font-semibold text-white">{title}</h4>
      <p className="mt-2 text-sm text-zinc-400">{children}</p>
    </div>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 text-left">
      <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-yellow-500/40 bg-yellow-500/10 text-sm font-bold tabular-nums text-yellow-300">
        {n}
      </div>
      <div>
        <h4 className="text-base font-semibold text-white">{title}</h4>
        <p className="mt-1 text-sm text-zinc-400">{children}</p>
      </div>
    </div>
  );
}

export default function LemonadeStandsPage() {
  return (
    <>
      <SiteHeader sticky />
      <div className="relative min-h-screen bg-zinc-950 text-white">
        {/* Hero — lemonade yellow rather than the sky accent the partner pages use. */}
        <section className="relative mx-auto max-w-5xl px-6 pt-16 pb-12 text-center">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -top-20 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-yellow-400/15 blur-3xl" />
          </div>

          <p className="text-xs font-medium uppercase tracking-[0.16em] text-yellow-300/80">
            For lemonade stands
          </p>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight md:text-5xl">
            “Sorry, I don’t have any cash.”
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-zinc-400">
            It’s the most common thing said at a lemonade stand, and it’s the only reason a
            customer who wanted to buy something walks away. Give the stand a QR code and they
            can pay with the phone already in their hand.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/admin/templates/new?industry=lemonade_stand"
              className="inline-block rounded-lg bg-yellow-400 px-6 py-3 text-base font-semibold text-zinc-950 shadow-lg transition hover:bg-yellow-300"
            >
              Set up a stand
            </Link>
            <Link
              href="#how"
              className="inline-block rounded-lg border border-yellow-400/50 px-6 py-3 text-base font-medium text-yellow-200 transition hover:bg-yellow-400/10"
            >
              How it works
            </Link>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Free to set up, free to host, and we take no cut. About five minutes.
          </p>
        </section>

        {/* How it works */}
        <section id="how" className="w-full border-t border-zinc-800/70">
          <div className="mx-auto max-w-5xl px-6 py-14">
            <h2 className="text-2xl font-semibold md:text-3xl">How it works</h2>
            <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2">
              <Step n="1" title="Make the stand’s page">
                Pick “Lemonade Stand” and you get a page with a menu already on it — lemonade,
                the big cup, cookies. Change the prices to whatever they’re charging today.
              </Step>
              <Step n="2" title="Add where the money should go">
                Your own Venmo, Cash App or PayPal — whichever you already use. Payments go
                straight to you and never pass through us, so there’s no account to open, no ID
                check, and nothing to wait for. The stand is theirs; the money is yours.
              </Step>
              <Step n="3" title="Print the sign">
                One button prints a table sign with a big QR code, plus six little cards to hand
                over with the drink — so someone can still pay after they’ve walked off.
              </Step>
              <Step n="4" title="They scan and pay">
                The customer’s camera opens the menu, they tap the total, and their own payment
                app opens with the amount already filled in. Nothing for the kid to operate.
              </Step>
            </div>
          </div>
        </section>

        {/* What you get */}
        <section className="w-full border-t border-zinc-800/70 bg-zinc-950/60">
          <div className="mx-auto max-w-5xl px-6 py-14">
            <h2 className="text-2xl font-semibold md:text-3xl">What the stand gets</h2>
            <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
              <Card title="A page, not a paperwork exercise">
                Menu, prices, and a line about what they’re saving up for — which is the part
                customers actually read, and the reason some of them round up.
              </Card>
              <Card title="A sign that survives a driveway">
                The QR is printed at high error-correction, so it still scans when it’s creased,
                splashed or half in shadow. The web address is printed underneath for anyone
                whose camera won’t cooperate.
              </Card>
              <Card title="Money straight to you">
                Payments land in your own Venmo, Cash App or PayPal — the same place your money
                already goes. We never hold it, so there’s nothing to pay out and nothing to wait
                for.
              </Card>
            </div>
          </div>
        </section>

        {/* The honest section. */}
        <section className="w-full border-t border-zinc-800/70">
          <div className="mx-auto max-w-3xl px-6 py-14">
            <h2 className="text-2xl font-semibold md:text-3xl">Two things worth knowing first</h2>

            <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
              <h3 className="text-base font-semibold text-white">
                The buyer needs the same app you do
              </h3>
              <p className="mt-2 text-sm text-zinc-400">
                Because payments go straight to your own account, a customer pays with whichever
                of Venmo, Cash App or PayPal you’ve listed — so add every one you use. Someone
                with none of them still pays cash, exactly as they do today. Nothing is deducted:
                a $2 cup is $2, and we take no fee.
              </p>
            </div>

            <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
              <h3 className="text-base font-semibold text-white">
                The account has to be an adult’s
              </h3>
              <p className="mt-2 text-sm text-zinc-400">
                The payment account is yours, not your child’s — every one of these apps requires
                an account holder who is 18 or over. So the setup is yours and the stand is
                theirs. We don’t ask for the child’s last name, address or photo, and we’d
                suggest you don’t put them on the page either — it ends up on a sign in a front
                yard.
              </p>
            </div>
          </div>
        </section>

        <section className="w-full border-t border-zinc-800/70 bg-zinc-950/60">
          <div className="mx-auto max-w-3xl px-6 py-14 text-center">
            <h2 className="text-2xl font-semibold md:text-3xl">Set one up before Saturday</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-400">
              Five minutes now, and the next person who says they have no cash buys a lemonade
              anyway.
            </p>
            <Link
              href="/admin/templates/new?industry=lemonade_stand"
              className="mt-7 inline-block rounded-lg bg-yellow-400 px-6 py-3 text-base font-semibold text-zinc-950 shadow-lg transition hover:bg-yellow-300"
            >
              Set up a stand
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
