// app/lemonade-stands/page.tsx
//
// Public landing for the lemonade-stand vertical. Same shape as /restaurants, but the audience
// is different in a way that decides most of the copy:
//
// ⚠️ THIS PAGE TALKS TO THE GROWN-UP, NOT THE KID. Stripe requires an account holder to be 18+
// and verifies their identity, so the merchant account cannot be the child's — the parent signs
// up, the money lands in the parent's bank, and the kid runs the stand. Writing this page at
// kids would be both a lie about who can complete the flow and an invitation for a nine-year-old
// to try to open a payments account. Every CTA here is addressed to whoever owns the driveway.
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
            Free to set up and free to host. Takes about five minutes.
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
              <Step n="2" title="Connect where the money goes">
                You (the grown-up) connect a bank account through Stripe, our payments provider.
                This part is legally yours: Stripe requires the account holder to be 18 or over
                and checks their ID. The stand is theirs; the account is yours.
              </Step>
              <Step n="3" title="Print the sign">
                One button prints a table sign with a big QR code, plus six little cards to hand
                over with the drink — so someone can still pay after they’ve walked off.
              </Step>
              <Step n="4" title="They scan and pay">
                The customer’s camera opens the menu, they tap what they want, and pay with Apple
                Pay, Google Pay or a card. No app to download, and nothing for the kid to operate.
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
              <Card title="Money in your account">
                Card payments settle to the bank account you connected, on Stripe’s normal
                schedule. You can see every order in your dashboard.
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
                Card fees are big when the price is small
              </h3>
              <p className="mt-2 text-sm text-zinc-400">
                Stripe charges about 2.9% plus 30¢ on each payment. On a $2 cup that’s roughly
                36¢ — near a fifth of the sale. It’s worth it because the alternative is a
                customer who buys nothing, but it’s a bad deal per-cup, so it’s better if people
                buy a couple of cups at once or round up. We don’t add a fee of our own to a
                lemonade stand.
              </p>
            </div>

            <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
              <h3 className="text-base font-semibold text-white">
                The account has to be an adult’s
              </h3>
              <p className="mt-2 text-sm text-zinc-400">
                Taking card payments means someone’s identity is on file with a payments company,
                and that someone must be 18 or over. So the setup is yours and the stand is
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
