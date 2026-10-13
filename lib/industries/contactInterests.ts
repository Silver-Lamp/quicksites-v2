// lib/industries/contactInterests.ts
//
// WHAT THE CONTACT FORM'S DROPDOWN ASKS, PER INDUSTRY — one decision per industry, enforced.
//
// ⚠️ THE RULE THIS ENFORCES (owner, 2026-10-13). The House Band page asked a band's visitors
// "I'm Interested In: Select a service" and offered Consulting / Installation / Support /
// Upgrades / Maintenance — the `other` fallback of SERVICE_NAMES, which the scaffold writes
// into `data.services` for every industry that has no entry, and which the contact form reads
// first. Seven industries were in that state (windshield_repair, dome_builder,
// treehouse_builder, real_estate_agency, lemonade_stand, musician, personal). A dropdown of
// generic words under a real name is a small lie on every page, so: every industry must
// resolve here to one of three explicit modes, and a test fails on any key that would fall
// through to the generic list. Adding an industry means deciding this.
//
//   services — a trade: the dropdown is the industry's SERVICE_NAMES ("I'm Interested In:").
//   options  — not a trade, but there is a real question to ask (a band: "Book us for a show").
//   hide     — there is no sensible choice (a person, a restaurant, a directory, a lemonade stand).
import type { IndustryKey } from '@/lib/industries';
import { generateServices } from '@/lib/generateServices';

export type ContactInterests =
  | { mode: 'services'; label: string; placeholder: string; options: string[] }
  | { mode: 'options'; label: string; placeholder: string; options: string[] }
  | { mode: 'hide' };

const SERVICES_LABEL = "I'm Interested In:";
const SERVICES_PLACEHOLDER = 'Select a service';

/** Industries that are not trades. Everything absent here must have real SERVICE_NAMES. */
const EXPLICIT: Partial<Record<IndustryKey, ContactInterests>> = {
  musician: {
    mode: 'options',
    label: "What's this about?",
    placeholder: 'Choose one',
    options: ['Book us for a show', 'Press or interview', 'Collaboration or feature', 'License a track', 'Something else'],
  },
  // A person: nobody picks a service from a résumé (lib/sites/personSite.ts).
  personal: { mode: 'hide' },
  // A restaurant: the unit is a dish; the listing importer's "services" are Places categories.
  restaurant: { mode: 'hide' },
  // A directory is not a business (docs/PPL_VERTICAL.md §9).
  dome_builder: { mode: 'hide' },
  // A stand run by a child: no service menu, no enquiry form framing.
  lemonade_stand: { mode: 'hide' },
};

/** The generic fallback list, so a caller can recognise it. Read from the catalog, never typed. */
export function genericServiceNames(): string[] {
  return generateServices({ industryKey: 'other' }).map((s) => s.name);
}

export function contactInterestsFor(industryKey: string | null | undefined): ContactInterests {
  const key = String(industryKey ?? '').trim() as IndustryKey;
  const explicit = EXPLICIT[key];
  if (explicit) return explicit;
  const names = key ? generateServices({ industryKey: key }).map((s) => s.name) : [];
  const generic = genericServiceNames().join('|');
  // An unknown or catalog-less industry gets NO dropdown rather than a generic one. The test
  // makes this branch unreachable for every declared industry.
  if (!names.length || (key !== 'other' && names.join('|') === generic)) return { mode: 'hide' };
  return { mode: 'services', label: SERVICES_LABEL, placeholder: SERVICES_PLACEHOLDER, options: names };
}
