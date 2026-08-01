// components/ui/section-shell.tsx
//
// The wrapper nearly every rendered block sits inside.
//
// ⚠️ IT USED TO HARD-CODE ITS TEXT COLOUR, AND THE DEFAULT WAS WHITE.
// `colorMode = 'dark'` produced `text-white` for any caller that didn't override it — and a
// survey found **all eleven callers relied on that default; not one passed the prop.** So every
// block built on this shell rendered white text regardless of the site's actual theme, and it
// looked fine only because new sites default to dark (CLAUDE.md §7).
//
// On a LIGHT-surfaced site the whole block vanished. That is how it was found: a published
// résumé page showed forty bullet points with no text beside them — the skills were all there in
// the DOM, `innerText` returned them, they were simply white on a white card. The kind of bug
// `tsc` cannot see and a screenshot shows instantly.
//
// Now it sets NO text colour at all, which is stronger than swapping in a semantic token would
// have been. `TemplateThemeWrapper` already puts `color: hsl(var(--foreground))` on the wrapper
// as an inline style, so every block inherits the right colour for its theme for free; and a
// block that paints its own surface (`bg-card`) states `text-card-foreground` itself, which
// correctly overrides inheritance.
//
// Setting `text-foreground` here would merely have re-run the original coin flip. `text-white`
// and `text-card-foreground` are both single-class utilities of EQUAL specificity, so which one
// wins is decided by their order in Tailwind's compiled stylesheet — not by the order they
// appear in the class attribute. `text-white` happened to be emitted later, so it won. Swapping
// in another text utility just picks a different side of the same coin. Emitting none removes
// the conflict rather than resolving it.
//
// A caller that genuinely needs to pin a colour — text over a photograph, say — passes one in
// `className`, which is an explicit decision at the call site instead of a default nobody knew
// they were inheriting.
//
// The `colorMode` prop is GONE rather than defaulted differently. Leaving an unused prop that
// silently controls colour is how this happened the first time.
import { ReactNode } from 'react';
import clsx from 'clsx';

type Props = {
  children: ReactNode;
  compact?: boolean;
  bg?: string;
  textAlign?: 'left' | 'center' | 'right';
  className?: string;
};

export default function SectionShell({
  children,
  compact = false,
  bg = '',
  textAlign = 'left',
  className = '',
}: Props) {
  return (
    <section
      className={clsx(
        'w-full',
        bg,
        compact ? 'py-8' : 'py-16',
        'px-4 md:px-6 lg:px-8',
        // Deliberately no text-colour utility here — see the note above.
        className
      )}
    >
      <div className={clsx('max-w-5xl mx-auto', `text-${textAlign}`)}>{children}</div>
    </section>
  );
}
