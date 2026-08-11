// app/verbatim/page.tsx
//
// Verbatim — a QuickSites feature. Paste your résumé, get a page.
//
// ⚠️ NAMED AFTER THE MECHANISM, NOT THE VIRTUE. "Verbatim" means *word for word, your own* — it
// describes what the tool does with your text rather than asserting that we're honest. Names
// that claim the virtue (TrueCV, RealYou, Authentic-anything) read as defensive, invite the
// reader to check the claim, and are exactly the names an AI résumé writer would also pick.
//
// ⚠️ AND IT'S A FIDELITY CLAIM ABOUT THE TEXT, NOT AN ABSTENTION CLAIM ABOUT US. That matters
// for the roadmap: the paid layer is the person's own voice via a consented clone reading their
// page. Voice ≠ words, so "verbatim" stays true when that ships. A name built on "we don't
// generate" would not have.
//
// ⚠️ THE GAP-REPORTING IS NOT IN THE NAME, DELIBERATELY. Refusing to invent a job title is the
// sharpest thing this feature does, but as a name it would read as a tool that nags you about
// what you're missing — the wrong register for someone arriving here laid off. It belongs in
// the copy, shown, not on the tin.
//
// A feature, not a brand: no separate domain, no separate surface. The differentiator here is
// negative ("it won't invent your career"), and a negative only means something next to the
// things that do — as a QuickSites feature it inherits that context for free, and inherits the
// trust a new brand would have to build from nothing.
import type { Metadata } from 'next';
import SiteHeader from '@/components/site/site-header';
import SiteFooter from '@/components/site/site-footer';
import PainterlyBackdrop from '@/components/site/painterly-backdrop';
import VerbatimIntake from './intake';

export const metadata: Metadata = {
  title: 'Verbatim — your résumé, as a page | QuickSites',
  description:
    'Paste your résumé and a paragraph about what you’ve done since. Verbatim arranges your own words into a page you can edit and publish. It never invents anything.',
};

export default function VerbatimPage() {
  return (
    <>
      <SiteHeader sticky />
      <main className="relative min-h-screen bg-background text-foreground">
        {/* Painterly, not the free CSS `paper` style this page used to carry: a blank sheet
            under lamplight is the page's own claim rendered as an image — someone's words about
            to be set down, and nothing written for them. Committed build artifact (~$0.04, once),
            so it versions with this copy and costs nothing at runtime.

            scrim="top" because the copy sits high AND the brightest thing in the painting (the
            lamp) is upper-right — a bottom-weighted scrim would have left the headline fighting
            the glow. That is rule 8's positionable-scrim redline, applied rather than quoted. */}
        <PainterlyBackdrop src="/brand/verbatim.webp" opacity={0.34} scrim="top" />

        <div className="relative mx-auto max-w-3xl px-6 pt-16 pb-10">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">Verbatim</div>
          <h1 className="mt-4 text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            Your résumé, as a page.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            Paste what you already have and one paragraph about what you’ve done since. You’ll get
            a page you can edit and publish — somewhere to point people.
          </p>

          {/*
            The promise lives here rather than in the name. It's the most distinctive thing the
            tool does and it's better shown than announced — and stating it plainly is also the
            only honest way to stand next to products that do the opposite.
          */}
          <p className="mt-6 rounded-xl border border-sky-500/25 bg-sky-500/5 p-4 text-[15px] leading-relaxed text-foreground">
            <span className="font-semibold">It won’t make anything up.</span> Verbatim arranges the
            words you wrote — it doesn’t write new ones. Where your résumé is silent, it tells you
            what’s missing instead of inventing something to fill the space.
          </p>

          {/*
            ⚠️ "there is no model call in this at all" USED TO BE HERE, AND IT HAD TO GO — not
            because we got looser, but because it stopped being true in one specific place. The
            PARSER still makes no model call: nothing writes, rewrites or infers a word of anyone's
            history. What changed is that a model now READS the finished page and flags defects
            (see the proofread bullet below), which is the opposite act.

            A nice absolute that quietly goes stale is worse than a precise sentence, and this page
            is the one place in the product where the copy IS the promise. So the bullet now says
            exactly which step is model-free.
          */}
          <ul className="mt-6 space-y-2.5 text-sm text-muted-foreground">
            {[
              'No AI wrote your history — the part that reads your résumé makes no model call.',
              'No invented job titles, dates, or achievements.',
              'No generated photo of you.',
              'You edit everything before anything is published.',
            ].map((t) => (
              <li key={t} className="flex gap-3">
                <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400/70" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>

        {/*
          The proofread layer, stated as what it is. It is a genuine differentiator precisely
          because of the restriction: every other AI résumé tool offers to REWRITE your words, and
          this one is only allowed to point at them.
        */}
        <div className="relative mx-auto max-w-3xl px-6 pb-2">
          <div className="rounded-xl border border-border bg-card/60 p-4">
            <h2 className="text-sm font-semibold text-foreground">
              And we check it before it goes live
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
              Before a page is published we read the finished version and look for the things that
              slip through — words mangled by PDF extraction (a résumé that arrives saying
              “ginancial” instead of “financial”), leftover placeholder text, or your own name
              spelled two ways. <span className="text-foreground">You get a list. Nothing is
              changed for you</span> — the suggestions are ours, the words stay yours.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              It is a second pair of eyes, not a guarantee. Read your page before you send it to
              anyone.
            </p>
          </div>
        </div>

        <div className="relative mx-auto max-w-3xl px-6 pb-20">
          <VerbatimIntake />

          {/*
            ⚠️ THE SAME DISCOVERY BUG, ONE LAYER DOWN. The workspace shipped with no route to it
            either — a person who builds a résumé page here had no way to learn that the postings
            board exists. A feature nobody can reach produces a usage number that measures our
            navigation, not their interest.
            Deliberately understated: it is a private board, not a pitch, and "keep track of where
            you're applying" is the whole offer. No AI, no upsell — see the workspace page.
          */}
          <p className="mt-10 border-t border-white/10 pt-6 text-sm text-zinc-400">
            Job hunting?{' '}
            <a href="/verbatim/workspace" className="font-medium text-sky-300 underline">
              Keep track of where you&rsquo;re applying
            </a>{' '}
            — a private list of the postings you&rsquo;re chasing, alongside your résumé pages.
            Only you can see it.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
