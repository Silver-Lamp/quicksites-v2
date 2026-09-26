// lib/onboarding/walkthrough.ts
//
// The first-run editor walkthrough, as data.
//
// ⚠️ EACH STEP NAMES AN ELEMENT THAT MUST EXIST. A tour is uniquely prone to rotting invisibly:
// the page keeps working, the highlighted thing has simply moved or been renamed, and the only
// symptom is a tooltip pointing at nothing — which no type checker and no unit test notices. So
// the anchors are `data-tour` attributes (not CSS classes, which get restyled), the list is a
// module rather than JSX, and a test asserts every anchor is present in the source that renders
// the editor.
//
// ⚠️ A STEP WHOSE ANCHOR IS MISSING IS SKIPPED, NEVER SHOWN EMPTY. Some controls are role- or
// state-dependent — a guest has no Publish button — and a walkthrough that stalls on a step it
// cannot point at is worse than one step shorter.

export type WalkthroughStep = {
  id: string;
  /** `[data-tour="<anchor>"]` — the element the tooltip attaches to. */
  anchor: string;
  title: string;
  body: string;
};

/**
 * Five steps, in the order someone actually works.
 *
 * ⚠️ Kept short deliberately. The people this is for typed a business name ninety seconds ago;
 * the goal is to get them to their first real edit, not to tour the product. Anything that is
 * discoverable by hovering does not need a step.
 */
export const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    id: 'canvas',
    anchor: 'canvas',
    title: 'This is your site',
    body: 'Hover any section to edit or delete it, and drag the handle to reorder. Changes show up here as you make them.',
  },
  {
    id: 'add-block',
    anchor: 'add-block',
    title: 'Add a section',
    body: 'Services, photos, hours, a contact form — pick a block and it drops straight into the page.',
  },
  {
    id: 'pages',
    anchor: 'pages',
    title: 'More than one page',
    body: 'Start with Home. Add Services or Contact whenever you want them; your menu updates itself.',
  },
  {
    id: 'theme',
    anchor: 'theme',
    title: 'Make it yours',
    body: 'Switch light or dark, pick a theme, or hit Shuffle to try a whole new look in one click.',
  },
  {
    id: 'publish',
    anchor: 'publish',
    title: 'Put it live',
    body: 'Save keeps your work. Publish puts the site on the web at your own address.',
  },
];

/** The preferences key this feature owns. */
export const WALKTHROUGH_PREF_KEY = 'editor_walkthrough_seen_at';

export type UiPrefs = Record<string, unknown>;

/**
 * Should the walkthrough run?
 *
 * ⚠️ Unknown prefs mean DO NOT RUN. A failed read is not a new user, and the cost of the two
 * mistakes is not symmetric: never showing it to someone costs a nicety, while showing it again
 * to a returning customer every time the network hiccups is the product nagging them.
 */
export function shouldRunWalkthrough(prefs: UiPrefs | null | undefined): boolean {
  if (!prefs) return false;
  return !prefs[WALKTHROUGH_PREF_KEY];
}

/** Marks it seen. Stored as a timestamp rather than `true` — "when" answers questions later. */
export function markSeen(prefs: UiPrefs, now: Date = new Date()): UiPrefs {
  return { ...prefs, [WALKTHROUGH_PREF_KEY]: now.toISOString() };
}

/** Replay: clears the flag so the next editor load runs it again. */
export function markUnseen(prefs: UiPrefs): UiPrefs {
  const next = { ...prefs };
  delete next[WALKTHROUGH_PREF_KEY];
  return next;
}
