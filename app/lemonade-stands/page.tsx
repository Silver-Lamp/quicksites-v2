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

export const metadata = {
  ...marketingOg({
  title: 'Lemonade stand payments — take cards with a QR code | QuickSites',
  description:
    'Your kid’s lemonade stand, but nobody walks away because they have no cash. A free page with the menu, a printable QR sign, and card payments that land in your bank account.',
  path: '/lemonade-stands',
  ogEyebrow: 'For lemonade stands',
  ogTitle: '“Sorry, I don’t have any cash.”',
  ogSubtitle: 'Now they do. Scan, tap, done — and the money lands in your account.',
  }),
  // Route-level icons: lemonyum.com rewrites to this page, so the tab shows a lemon rather
  // than the QuickSites mark. SVG first for crispness at any size, 32px PNG for browsers that
  // won't take one, and a padded 180px for iOS (which crops to a rounded square and would
  // otherwise clip the tips off a full-bleed mark).
  icons: {
    icon: [
      { url: '/brand/lemonyum-logo.svg', type: 'image/svg+xml' },
      { url: '/brand/lemonyum-icon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: '/brand/lemonyum-icon-180.png', sizes: '180x180' }],
  },
};

/**
 * ⚠️ ABSOLUTE, NOT A ROOT-RELATIVE PATH.
 *
 * This page is served on lemonyum.com as well as quicksites.ai, and the builder lives on the
 * app. As a relative `/admin/...` it was rewritten by the brand host's own routing into a stand
 * lookup and 404'd — the first CTA on the page, broken the moment the domain went live.
 *
 * Middleware now also redirects app segments off the brand hosts, which fixes any such link.
 * This is belt-and-braces on the one that matters most: a CTA that depends on a reserved-path
 * list staying complete is a CTA that breaks the next time someone adds a route.
 */
/**
 * The one real stand we point at. Absolute, because this page is served from lemonyum.com as
 * well as quicksites.ai — a relative link would send a LemonYum visitor to a stand that does
 * not exist on that host.
 */
const EXAMPLE_STAND_URL = 'https://renton-lemonade.quicksites.ai/';

const BUILDER_URL =
  `${(process.env.NEXT_PUBLIC_APP_URL || 'https://www.quicksites.ai').replace(/\/+$/, '')}` +
  '/admin/templates/new?industry=lemonade_stand';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white/70 shadow-sm p-5 text-left">
      <h4 className="text-base font-semibold text-zinc-900">{title}</h4>
      <p className="mt-2 text-sm text-zinc-600">{children}</p>
    </div>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 text-left">
      <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-yellow-500/50 bg-yellow-400/25 text-sm font-bold tabular-nums text-yellow-900">
        {n}
      </div>
      <div>
        <h4 className="text-base font-semibold text-zinc-900">{title}</h4>
        <p className="mt-1 text-sm text-zinc-600">{children}</p>
      </div>
    </div>
  );
}

export default function LemonadeStandsPage() {
  return (
    <>
      <SiteHeader sticky />
      {/* ⚠️ THIS PAGE IS DELIBERATELY LIGHT, WHICH IS AN EXCEPTION TO CLAUDE.md §7.
          The app chrome is dark everywhere else, and a page that hard-codes light utilities is
          usually a BUG there — dark-on-dark text nobody notices until a screenshot. Here it is
          the brand: LemonYum is lemonade, and a near-black page for a kids' stand reads wrong no
          matter how good the copy is.

          Because it opts out, it cannot use the semantic tokens (`text-foreground`, `bg-card`):
          those resolve against `data-theme="dark"` from the global ThemeScope and would paint
          this page's text white on cream. Every colour here is therefore a CONCRETE light class,
          on purpose, and `dark:` variants must never be added — the global `.dark` on <html>
          would pin them on. Same reasoning as the route-planner's toggle comment. */}
      <div className="relative min-h-screen bg-[#fdfaf0] text-zinc-900">
        {/* Hero — lemonade yellow rather than the sky accent the partner pages use. */}
        <section className="relative w-full overflow-hidden">
          {/* Painterly hero backdrop (gpt-image-1, no people + no lettering — the same prompt
              path the site backdrops use). A pale painting on a cream page can carry far more
              opacity than it could on the near-black version, so the picture actually reads.
              The scrim still runs bottom-to-top: contrast for the dark heading text is
              guaranteed by the wash, not assumed — checked in a screenshot, which is the only
              thing that finds this class of bug (CLAUDE.md §7). */}
          {/* ⚠️ z-0, NOT -z-10. A negative z-index child paints BEHIND its ancestor's
              background, and the page shell above is an opaque cream fill — so the image
              rendered, downloaded, and was covered, exactly like the site backdrops that were
              hidden under `bg-background` (fixed in #792 the same day). The hero content below
              is lifted to z-10 so it still sits above this. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
            <div
              className="absolute inset-0 bg-cover"
              style={{
                backgroundImage: 'url(/backgrounds/lemonyum/hero.jpg)',
                // ⚠️ NOT `bg-center`, and this is the second screenshot-only bug on one image.
                // backdropPrompt asks for "plenty of open negative space in the MIDDLE where text
                // will sit" — the painting obliged, so its content (pitcher, table, tree, house)
                // sits around the edges. `bg-cover bg-center` on a wide, short hero then crops to
                // precisely the empty middle, and the page renders as flat cream with a 148KB
                // image loaded behind it. Anchoring low shows the part worth seeing.
                backgroundPosition: '50% 82%',
                opacity: 1,
              }}
            />
            {/* ⚠️ SCRIM TUNED DOWN AFTER A SCREENSHOT, not before. The first pass used opacity
                0.75 behind a /40 → /70 → solid wash and the painting VANISHED — the image is
                deliberately high-key and pale, so a cream scrim at those values erases it while
                every number in the code still looks sensible. Near-black heading on pale yellow
                means legibility was never the risk here; visibility of the thing we paid to
                generate was. */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#fdfaf0]/10 via-[#fdfaf0]/35 to-[#fdfaf0]" />
          </div>

          {/* Full-bleed backdrop, constrained content. The max-width used to sit on the
              <section>, which meant the painting was clipped to a 1024px band with hard vertical
              edges against the cream page — it read as a mistake rather than a hero. */}
          <div className="relative z-10 mx-auto max-w-5xl px-6 pt-20 pb-20 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/lemonyum-logo.svg"
            alt=""
            width={72}
            height={72}
            className="mx-auto mb-5 drop-shadow-sm"
          />
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-yellow-800">
            For lemonade stands
          </p>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight md:text-5xl">
            “Sorry, I don’t have any cash.”
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-zinc-700">
            It’s the most common thing said at a lemonade stand, and it’s the only reason a
            customer who wanted to buy something walks away. Give the stand a QR code and they
            can pay with the phone already in their hand.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={BUILDER_URL}
              className="inline-block rounded-lg bg-yellow-400 px-6 py-3 text-base font-semibold text-zinc-950 shadow-lg transition hover:bg-yellow-300"
            >
              Set up a stand
            </Link>
            <Link
              href="#how"
              className="inline-block rounded-lg border border-yellow-600/50 px-6 py-3 text-base font-medium text-yellow-900 transition hover:bg-yellow-400/20"
            >
              How it works
            </Link>
          </div>
          <p className="mt-3 text-xs text-zinc-600">
            Free to set up, free to host, and we take no cut. About five minutes.
          </p>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="w-full border-t border-zinc-200">
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
        <section className="w-full border-t border-zinc-200 bg-white/60">
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
              {/* ⚠️ ORDER MATTERS HERE AND IT IS A RECORDED DECISION, NOT A PREFERENCE.
                  docs/LEMONYUM_PLAN.md §2a (owner, 2026-08-14): handles first, Connect as an
                  upgrade — because a parent selling $2 cups should not face SSN-and-bank
                  onboarding and a multi-day first payout to sell lemonade on a Saturday.

                  The old copy said only "we never hold it", which is true of the handle path
                  and false of the card path that now exists — a stand took a real card tonight
                  and the platform kept 5%. So: both, in the decided order, each honest about
                  its cost. Do not promote cards to the top; that inverts §2a. */}
              <Card title="Money straight to you">
                Paste your Venmo, Cash App or PayPal handle and customers pay you directly. We
                never hold it and we take nothing — no payout to wait for, no fee on a $2 cup.
                <br />
                <span className="mt-2 block text-zinc-500">
                  If you’d rather take cards on the page itself, you can connect Stripe later.
                  That one settles through us and keeps 5%.
                </span>
              </Card>
            </div>
          </div>
        </section>

        {/* A stand that actually exists.
            ⚠️ ONE REAL STAND, LINKED LIVE — not a mockup and not a carousel of invented ones.
            Every other claim on this page is about what a stand *would* get; this is the only
            place a visitor can check us. The preview is the site's own OG image, generated from
            the published page, so it cannot drift into showing something the stand no longer
            says. If this link ever 404s the section should come out, because a broken example
            is worse than none: it is the one element here whose entire job is to be verifiable. */}
        <section className="w-full border-t border-zinc-200">
          <div className="mx-auto max-w-5xl px-6 py-14">
            <h2 className="text-2xl font-semibold md:text-3xl">A stand that’s already running</h2>
            <p className="mt-3 max-w-2xl text-zinc-600">
              This one is real. It takes cards, it has add-ons, and the first $4 went through on a
              Saturday. Have a look at what your driveway could hand a neighbour.
            </p>

            <a
              href={EXAMPLE_STAND_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group mt-8 block overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:shadow-md"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/api/og/renton-lemonade/image"
                alt="Renton Lemonade — a live lemonade stand page with its menu and prices"
                className="w-full"
                width={1200}
                height={630}
                loading="lazy"
              />
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 px-5 py-4">
                <div className="min-w-0">
                  <div className="font-semibold">Renton Lemonade</div>
                  <div className="truncate text-sm text-zinc-500">renton-lemonade.quicksites.ai</div>
                </div>
                <span className="shrink-0 text-sm font-semibold text-amber-700 group-hover:underline">
                  See the live stand →
                </span>
              </div>
            </a>
          </div>
        </section>

        {/* The honest section. */}
        <section className="w-full border-t border-zinc-200">
          <div className="mx-auto max-w-3xl px-6 py-14">
            <h2 className="text-2xl font-semibold md:text-3xl">Two things worth knowing first</h2>

            <div className="mt-6 rounded-xl border border-zinc-200 bg-white/70 shadow-sm p-6">
              <h3 className="text-base font-semibold text-zinc-900">
                The buyer needs the same app you do
              </h3>
              <p className="mt-2 text-sm text-zinc-600">
                Because payments go straight to your own account, a customer pays with whichever
                of Venmo, Cash App or PayPal you’ve listed — so add every one you use. Someone
                with none of them still pays cash, exactly as they do today. Nothing is deducted:
                a $2 cup is $2, and we take no fee.
              </p>
            </div>

            <div className="mt-4 rounded-xl border border-zinc-200 bg-white/70 shadow-sm p-6">
              <h3 className="text-base font-semibold text-zinc-900">
                The account has to be an adult’s
              </h3>
              <p className="mt-2 text-sm text-zinc-600">
                The payment account is yours, not your child’s — every one of these apps requires
                an account holder who is 18 or over. So the setup is yours and the stand is
                theirs. We don’t ask for the child’s last name, address or photo, and we’d
                suggest you don’t put them on the page either — it ends up on a sign in a front
                yard.
              </p>
            </div>
          </div>
        </section>

        <section className="w-full border-t border-zinc-200 bg-white/60">
          <div className="mx-auto max-w-3xl px-6 py-14 text-center">
            <h2 className="text-2xl font-semibold md:text-3xl">Set one up before Saturday</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-600">
              Five minutes now, and the next person who says they have no cash buys a lemonade
              anyway.
            </p>
            <Link
              href={BUILDER_URL}
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
