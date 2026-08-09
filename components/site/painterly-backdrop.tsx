// components/site/painterly-backdrop.tsx
//
// The ONE painterly backdrop for QuickSites' own marketing pages: image + legibility scrim,
// with rules 7/8/9 of the painterly recipe living in a single place.
//
// ⚠️ EXTRACTED AT THE SECOND SURFACE, ON PURPOSE. `crosstalk/contracts/painterly-backdrop.md`
// (rule 3, PorchHearth's redline) warns that this bites later than you expect: the second page
// fits the first page's markup so you copy it, and the third doesn't fit so you fork — and now
// the no-people rule, the degrade-to-plain rule and the scrim all exist in three places, two of
// which will drift. PH hit exactly that across `/events`, `/meals` and their 404, and pulled a
// `PainterlyPanel`. This is ours, extracted from `app/not-found.tsx` the moment `/verbatim`
// became the second caller rather than after the third.
//
// Related but deliberately separate: `components/site/page-backdrop.tsx` is the FREE path (pure
// CSS from theme tokens, zero cost, painterly not even assignable). This is the paid path — a
// committed build artifact generated once by a script, per the page-level case of the recipe.
// Keeping them as two components is what stops a one-prop change from spending money.

/**
 * Where the scrim is heaviest.
 *
 * ⚠️ A PROP, NOT A CONSTANT — rule 8, PorchHearth's redline. A hard-coded scrim direction is a
 * bet on where the bright part of the painting lands. PH's 404 copy sits high while the brightest
 * thing in their image (a lantern) is upper-right, so a bottom-weighted scrim would have left the
 * text fighting the glow. The rule says *enforce* contrast, not hope for it, which means putting
 * the scrim where THIS image's bright region actually is.
 */
export type ScrimWeight = 'top' | 'bottom' | 'even' | 'left' | 'right';

const SCRIMS: Record<ScrimWeight, string> = {
  // Copy sits high on the page — hold the top down hardest.
  top: 'bg-gradient-to-b from-zinc-950/92 via-zinc-950/70 to-zinc-950/85',
  // Copy sits low.
  bottom: 'bg-gradient-to-b from-zinc-950/80 via-zinc-950/70 to-zinc-950/95',
  // Long page, text throughout.
  even: 'bg-gradient-to-b from-zinc-950/85 via-zinc-950/75 to-zinc-950/95',
  // ⚠️ HORIZONTAL, added for the portfolio hero — because a vertical scrim was the wrong shape
  // for its painting. The bright region there is a sunlit wall on the CENTRE-RIGHT while the
  // headline sits left, so any top/bottom gradient either dims the one good thing in the image or
  // leaves the text fighting it. This is rule 8's point made concrete: the scrim goes where THIS
  // image's light actually is, which is not always a direction the enum already had.
  left: 'bg-gradient-to-r from-zinc-950/92 via-zinc-950/70 to-zinc-950/35',
  right: 'bg-gradient-to-l from-zinc-950/92 via-zinc-950/70 to-zinc-950/35',
};

export default function PainterlyBackdrop({
  src,
  opacity = 0.4,
  scrim = 'even',
}: {
  /** Path to a committed build artifact under /public (never a runtime fetch or a bucket URL). */
  src: string;
  /** Image strength beneath the scrim. */
  opacity?: number;
  scrim?: ScrimWeight;
}) {
  return (
    <>
      {/*
        Rule 7 — THE PAGE MUST RENDER CORRECTLY WITH NO BACKDROP. This is a CSS background, so a
        missing or unpainted file simply doesn't load: no broken-image icon, no reserved space, no
        layout shift. The page falls back to its own dark background and every word and link still
        works. Nothing here is load-bearing, which is the point — a decorative layer that can
        break the page it decorates is worse than no decoration.

        Rule 8 — DECORATION, NOT CONTENT. aria-hidden and pointer-events-none: a screen reader
        must never announce a generated painting, and it must never be the only thing carrying
        information. (Rule 9, no generated people, is enforced upstream in the paint script via
        lib/images/noPeople — never hand-written, or it rots.)
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${src})`, opacity }}
      />
      <div aria-hidden className={`pointer-events-none absolute inset-0 ${SCRIMS[scrim]}`} />
    </>
  );
}
