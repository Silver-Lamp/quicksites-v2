// app/testing/page.tsx
//
// How we test. Public, and deliberately written as a list of incidents rather than a list of
// capabilities — every rule here has a specific bug behind it, and a page claiming rigour reads
// as marketing while a page naming its own failures reads as experience.
//
// ⚠️ Every number and example on this page is real and checkable in this repo. If a figure here
// stops being true, it is a bug in the page.
import Link from 'next/link';
import SiteHeader from '@/components/site/site-header';
import SiteFooter from '@/components/site/site-footer';
import PageBackdrop from '@/components/site/page-backdrop';
import { marketingOg } from '@/lib/marketingOg';
// ⚠️ Canonical URL, not a hand-written link. persona-testing-promo.tsx owns this string and says
// why: three surfaces render it, and duplicating it is how the honesty wording rots.
import { PERSONA_TESTING_URL } from '@/components/promo/persona-testing-promo';

export const metadata = marketingOg({
  title: 'How we test — the green-check problem',
  description:
    'Our repeated failure was never broken code. It was passing checks over a wrong artifact. The disciplines we adopted, and the specific bug behind each one.',
  path: '/testing',
  ogEyebrow: 'Engineering',
  ogTitle: 'How we test',
  ogSubtitle: 'Types green, tests green, artifact wrong. What we do about it.',
});

function Rule({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-white/10 pt-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-sky-300/70">{n}</p>
      <h3 className="mt-2 text-2xl font-bold tracking-tight text-zinc-50">{title}</h3>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-zinc-300">{children}</div>
    </section>
  );
}

// The four layers by cadence. Mesh-parallel with hivejournal.com/how-we-test, deliberately not
// identical — ours differs at the third row, and that difference is the honest part.
//
// ⚠️ `cadence` states WHEN EACH ACTUALLY RUNS TODAY, not when it ought to. The render gate is a
// script (`scripts/verify-rendered.ts`) whose own header says "wire it into CI or a pre-publish
// step and the checks stop depending on discipline" — it is not wired. Drawing it as an automatic
// post-deploy stage would be a diagram making a claim about a system nobody runs, on a page about
// exactly that failure.
const LAYERS: Array<{
  cadence: string;
  layer: string;
  what: string;
  blind: string;
  manual?: boolean;
  brand?: string;
  href?: string;
}> = [
  {
    cadence: 'on save',
    layer: 'Unit tests',
    what: 'jest over pure functions in lib/ — parsers, pricing, matching',
    blind: 'anything about whether the function is called, or what the page does with it',
  },
  {
    cadence: 'every PR',
    layer: 'CI gates',
    what: 'typecheck · lint · verify:assets · config declarations · a real next build',
    blind: 'anything true only of the deployed render — every failure on this page passed here',
  },
  {
    cadence: 'on demand',
    layer: 'Render gate',
    what: 'headless Chromium on the published URL: visible copy, order, computed contrast',
    blind: 'whatever nobody thought to point it at — it runs on the URLs you name',
    manual: true,
  },
  {
    cadence: 'on a sibling’s cron',
    // ⚠️ Named for what it IS, and whose it is. This is HiveJournal's shipped product, pointed at
    // our surfaces — not a QuickSites feature and not an internal script. Both halves of that
    // matter: claiming it as ours would be the small deception `persona-testing-promo.tsx` exists
    // to prevent, and calling it "scripts" would undersell that we test with something a customer
    // can buy. No ™ — I have no evidence of a registered mark, and inventing one on a page about
    // unverified claims would be a poor way to spend the afternoon.
    layer: 'AI Personas',
    brand: 'HiveJournal',
    href: PERSONA_TESTING_URL,
    what: 'AI personas visit public pages with a first-time-visitor goal and file triage claims',
    blind: 'everything private, and anything a plausible-sounding wrong claim can bury',
  },
];

function Pipeline() {
  return (
    <figure className="mt-12 rounded-2xl border border-white/10 bg-black/30 p-5 sm:p-6">
      <figcaption className="text-sm font-semibold uppercase tracking-widest text-sky-300/70">
        Four layers, by cadence
      </figcaption>
      <p className="mt-2 text-[14px] text-zinc-400">
        write <span className="text-zinc-600">→</span> merge{' '}
        <span className="text-zinc-600">→</span> deploy <span className="text-zinc-600">→</span> live.
        Each layer catches what the one above it structurally cannot.
      </p>

      <div className="mt-5 space-y-2.5">
        {LAYERS.map((l) => (
          <div
            key={l.layer}
            className="grid grid-cols-1 gap-x-4 gap-y-1 rounded-lg border border-white/10 bg-white/[0.02] p-3.5 sm:grid-cols-[9.5rem_1fr]"
          >
            <div>
              <span
                className={
                  l.manual
                    ? 'inline-block rounded border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 font-mono text-[12px] text-amber-200'
                    : 'inline-block rounded border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 font-mono text-[12px] text-sky-200'
                }
              >
                {l.cadence}
              </span>
            </div>
            <div>
              <p className="font-semibold text-zinc-100">
                {l.href ? (
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-200 underline decoration-sky-400/40 underline-offset-4 hover:text-sky-100"
                  >
                    {l.layer}
                  </a>
                ) : (
                  l.layer
                )}
                {l.brand ? (
                  <span className="ml-2 rounded border border-white/15 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    by {l.brand}
                  </span>
                ) : null}
              </p>
              <p className="mt-0.5 text-[14px] leading-relaxed text-zinc-400">{l.what}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">
                <span className="text-zinc-600">blind to:</span> {l.blind}
              </p>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 rounded-lg border-l-2 border-amber-400/60 bg-amber-400/5 py-2 pl-4 pr-3 text-[14px] text-amber-100/90">
        The amber row is the honest part. The layer that caught the most expensive bugs here is the
        one still triggered by a person deciding to run it — so its real coverage is{' '}
        <em>whatever we remembered to check</em>. Every other row runs whether anyone is paying
        attention; that one does not, which makes it the least reliable and the most valuable at the
        same time.
      </p>
    </figure>
  );
}

function Incident({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border-l-2 border-amber-400/60 bg-amber-400/5 py-2 pl-4 pr-3 text-[14px] text-amber-100/90">
      {children}
    </p>
  );
}

export default function TestingPage() {
  return (
    <>
      <SiteHeader />
      <main className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
        <PageBackdrop style="grid" />

        <div className="relative mx-auto max-w-3xl px-6 py-16 sm:py-24">
          <p className="text-sm font-medium uppercase tracking-widest text-sky-300/80">
            Engineering
          </p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
            Types green. Tests green. Artifact wrong.
          </h1>
          <p className="mt-5 text-lg text-zinc-300">
            Across four products we have shipped almost no broken code. What we have shipped, over
            and over, is <strong className="text-zinc-100">a passing check over a wrong result</strong>
            {' '}— a canonical URL pointing at our own routing table, a search box absent from the
            server-rendered HTML, a button in a component nothing imported, a downloadable file
            containing our error page.
          </p>
          <p className="mt-4 text-lg text-zinc-300">
            Every one passed CI. Every one was found by a human opening the thing. These are the
            disciplines we adopted in response, and the specific incident behind each.
          </p>

          <Pipeline />

          <div className="mt-14 space-y-12">
            <Rule n="Rule 1" title="Verify the received artifact, not the inputs">
              <p>
                Assertions about state, props and database rows are assertions about what we
                intended. The visitor gets a rendered page. Our render gate loads the{' '}
                <em>published URL</em> in headless Chromium and asserts on what a person would
                actually see: visible copy, reading-order position, and computed contrast.
              </p>
              <Incident>
                A shared wrapper hard-coded <code>text-white</code>, and a survey of its{' '}
                <strong>eleven call sites found not one passed the prop</strong> that would have
                overridden it. Every block built on it painted white text regardless of the
                site&rsquo;s theme. It was caught on a published résumé page showing{' '}
                <strong>forty bullet points with no text beside them</strong> — white on a white
                card. The skills were all in the DOM; <code>innerText</code> returned them. Invisible
                to <code>tsc</code>, obvious in a screenshot.
              </Incident>
              <p>
                The same rule caught a fee disclosure rendering <em>below</em> the control that took
                a visitor&rsquo;s money on two of three variants — text order and DOM index both
                said it was above.
              </p>
            </Rule>

            <Rule n="Rule 2" title="A guard that cannot go red is decoration">
              <p>
                A check is a claim about the world, and an unfalsifiable claim is worth nothing. Our
                asset verifier ships a <code>--selftest</code> that spawns it against known-bad
                fixtures and asserts the <em>exit code</em> — so a guard that is defined but never
                wired fails the build rather than being blessed by the check it was meant to
                strengthen.
              </p>
              <Incident>
                We wrote a guard for &ldquo;a settings panel nothing imports&rdquo;. It asked
                whether <em>anything</em> imported the file — and a dead file counted as something,
                so the orphaned panel passed. Being referenced by a corpse is not being reachable.
              </Incident>
            </Rule>

            <Rule n="Rule 3" title="A scan that matches nothing reports success">
              <p>
                Every sweep asserts a non-empty target set before asserting anything about it. A
                grep that silently matches zero files is indistinguishable from a clean codebase,
                and it stays green forever after someone moves a directory.
              </p>
            </Rule>

            <Rule n="Rule 4" title="A check that fires on correct code is worse than no check">
              <p>
                False positives train people to skip the output, which is the same
                silence-looks-like-success failure one level up. We treat a crying-wolf guard as a
                defect in the guard, not an inconvenience.
              </p>
              <Incident>
                A rule banning opaque light fills flagged <code>bg-white/90</code> — an alpha tint,
                which is the pattern the neighbouring rule <em>recommends</em>. It failed two
                correct files on its first repo-wide run. Twice more since, a test matched a word
                inside the comment explaining why the code was right.
              </Incident>
            </Rule>

            <Rule n="Rule 5" title="Freeze debt as a number that can only shrink">
              <p>
                Where a rule arrives after the violations, we record the count and forbid growth,
                rather than either failing the build or quietly excluding a directory. Our env-var
                declaration test carries a frozen baseline of{' '}
                <strong>109 known-undeclared keys</strong>, with a companion test asserting the
                baseline never grows — a baselined key that gets declared must be{' '}
                <em>removed</em> from the list, or it rots into a permanent allowlist.
              </p>
              <p className="text-zinc-400">
                ⚠️ The baseline must be <em>measured</em>, not chosen. A ratchet set above the real
                count sits green while the number climbs to meet it.
              </p>
            </Rule>

            <Rule n="Rule 6" title="Fail loudly at boot when config is incomplete">
              <p>
                A feature flag turned on with two of its three variables set is not off and not on
                — it is silently broken. <code>CONFIG_GATES</code> declares{' '}
                <strong>20 features</strong> with their required env, evaluated at startup, and a
                public <code>/status</code> endpoint answers &ldquo;is this actually live?&rdquo;
                from the running process rather than from a config file.
              </p>
              <Incident>
                One integration sat inert for five days on one of three variables. A captcha was
                silently off for weeks on an env-name typo. Neither produced an error.
              </Incident>
            </Rule>

            <Rule n="Rule 7" title="Say which half you checked">
              <p>
                Our most expensive recurring error is not a wrong observation — those fail loudly,
                because whoever owns that code corrects you. It is{' '}
                <strong>a true observation plus an unverified inference, reported as one thing</strong>,
                arriving with identical confidence because the checked half really was checked.
              </p>
              <p>So findings are written in two labelled halves:</p>
              <pre className="overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-4 text-[13px] leading-relaxed text-zinc-300">
{`Verified: the parser discards the structure (read the source).
Assumed:  that the shopping list consumes it — I did not check.`}
              </pre>
              <p>
                <code>Verified:</code> must state <em>scope</em>, because that is where
                over-claiming hides — &ldquo;I grepped rather than remembered&rdquo; can be true and
                still be one directory reported as a repo-wide conclusion.
              </p>
              <Incident>
                Asked whether our pages server-render, we checked the marketing pages, got a clean
                result, and nearly reported all-clear. It was true about the pages nobody was asking
                about — the customer sites were serving an empty shell to every crawler. A verified
                check pointed at the wrong instance reads exactly like an answer.
              </Incident>
              <p>
                The scope failure is the same shape whether the population is pages or files, and it
                is very hard to feel from the inside, because the measurement genuinely ran.
              </p>
              <Incident>
                <strong>This page shipped with that bug in it.</strong> The sentence below said
                &ldquo;more than 500 test files&rdquo;. The command behind it excluded the top-level{' '}
                <code>node_modules</code> and missed a second one nested deeper — so{' '}
                <strong>309 of those 507 files were our dependencies&rsquo; tests</strong>. We were
                counting zod&rsquo;s test suite and calling it ours. The real figure is 198. It was
                caught by the test on this page&rsquo;s own numbers, going red in CI about twenty
                minutes after the page went live.
              </Incident>
            </Rule>

            <Rule n="Rule 8" title="Exploratory agents produce claims, not findings">
              <p>
                Our sibling product runs backstoried, cost-capped browsing personas against public
                surfaces with a first-time-visitor goal. They catch the class scripted tests cannot:
                a scripted test asserts what you already thought to check.
              </p>
              <p>
                Three rules make them safe to act on. Findings land at{' '}
                <code>status:&apos;triage&apos;</code>, never <code>open</code> — enforced twice, in
                the route and in a database constraint — because a persona finding is a{' '}
                <strong>claim until a human agrees</strong>. Attribution lives in the record rather
                than a UI badge. And evidence is typed:{' '}
                <code>searched_not_found</code> renders differently from <code>encountered</code>,
                because &ldquo;I couldn&rsquo;t find it&rdquo; is indistinguishable from
                &ldquo;I didn&rsquo;t look&rdquo;.
              </p>
              <Incident>
                A persona reported a contact form above the restaurant list. The DOM said otherwise
                — an empty wrapper from a <em>different</em> bug had made the page read that way.
                We diffed the claim against the real DOM before moving anything. That check is why
                the pipeline is safe to run at all.
              </Incident>
            </Rule>
          </div>

          <div className="mt-16 rounded-2xl border border-white/10 bg-black/30 p-6 backdrop-blur sm:p-8">
            <h2 className="text-2xl font-bold tracking-tight">A worked example, unflattering</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-zinc-300">
              We built a &ldquo;download your whole site as one file&rdquo; feature — the artifact a
              customer keeps if we disappear. It took <strong>seven rounds</strong> to work:
            </p>
            <ol className="mt-4 space-y-2 text-[15px] text-zinc-300">
              {[
                'The button was in a settings file nothing imported — route worked, tests passed, feature unreachable.',
                'The route fetched the wrong host and got a clean 200 of our own 404 page.',
                'It was gated on “published”, asking an owner to publish a real business’s page to test the feature that proves they can leave.',
                'Owner-only refused everybody, because those drafts have no owner yet.',
                'Every image fetch succeeded and every substitution missed — zero inlined images, empty failure list, no error.',
                'The file opened to a full-screen “Loading…” overlay that nothing could dismiss, because we strip the scripts that would have hidden it.',
                'Working: images embedded, no network references, honest banner.',
              ].map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="shrink-0 font-mono text-sky-300/70">{i + 1}.</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
            <p className="mt-5 text-[15px] leading-relaxed text-zinc-300">
              Types were clean and tests passed at <em>every</em> step. Three of those rounds were
              the fix for the previous round being unverifiable from the inside — confirming that
              the mechanism <em>responded</em> rather than that the output was <em>right</em>.
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-zinc-100">
              Every round was caught the same way: somebody opened the file.
            </p>
          </div>

          <div className="mt-14 border-t border-white/10 pt-8">
            <h2 className="text-xl font-bold tracking-tight">Where this leaves us</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-zinc-300">
              More than 190 test files of our own, and not one of them existed in a form that would
              have caught the seven failures above. That is not an argument against tests — it is
              an argument about{' '}
              <strong>what they are evidence of</strong>. A test asserts that the code does what its
              author believed. The gap we keep falling into is between that belief and the artifact
              a person receives, and closing it needs a different instrument: load the real URL,
              read the real bytes, open the real file.
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-zinc-400">
              Written up because we keep paying for the same lesson, and writing it down is cheaper
              than the eighth round.
            </p>

            <p className="mt-6 text-[15px] text-zinc-400">
              Rule 6 is checkable from here:{' '}
              <Link href="/status" className="text-sky-300 underline underline-offset-4">
                /status
              </Link>{' '}
              reports every feature as ready, off, or incomplete — from the running process, not
              from a config file.
            </p>
          </div>

          <div className="mt-10 rounded-2xl border border-white/10 bg-black/20 p-6">
            <h2 className="text-lg font-bold tracking-tight">The other half</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-zinc-300">
              QuickSites is one of four products built by the same team.{' '}
              <a
                href="https://www.hivejournal.com/how-we-test"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-300 underline underline-offset-4"
              >
                HiveJournal&rsquo;s write-up
              </a>{' '}
              covers the same discipline from its own incidents — structured data that only existed
              after JavaScript ran, a generated file whose extension disagreed with its bytes, and
              the practice of reading your own system before letting a sibling product describe it.
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-zinc-400">
              The two were written independently and arrived at the same first rule, which is
              either evidence or a shared blind spot. We think it is the former, and the honest
              form of that sentence is this one.
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
