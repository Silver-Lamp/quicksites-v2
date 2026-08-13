// lib/builder/industryCopy.ts
//
// Deterministic-but-varied hero subheadline + CTA copy for a starter site, so two
// generated sites in the same industry don't read identically. Pure (rng injectable).
// {label} → lowercased industry label, {business} → business name (or label).

import type { IndustryKey } from '@/lib/industries';
import { industryStyle, type IndustryStyle } from './industryStyle';

const SUBHEADS: Record<IndustryStyle, string[]> = {
  generic: [
    'Trusted {label} — fast, friendly, and done right.',
    'Local {label} you can count on. Get a free quote today.',
    'Quality {label} for your home or business.',
    'Reliable {label}, honest pricing, no surprises.',
    'Your local {label} experts — book in minutes.',
  ],
  urgency: [
    'Fast, dependable {label} when you need it most.',
    'Help is one call away — {label} you can rely on.',
    'Quick response, fair pricing, {label} done right.',
    'Same-day {label} from a team that shows up.',
  ],
  visual: [
    'Standout {label} — you’ll see the difference.',
    'See what professional {label} can do for your place.',
    'Beautiful results, every time. Local {label} you can trust.',
    'Meticulous {label} with results worth showing off.',
  ],
  trust: [
    'Experienced {label} you can trust with what matters.',
    'Personal, professional {label} — get expert guidance.',
    'Trusted {label} with a track record you can count on.',
    'Straightforward {label} and advice you can rely on.',
  ],
};

const CTAS: Record<IndustryStyle, string[]> = {
  generic: ['Get a Quote', 'Get a Free Quote', 'Get Started', 'Contact Us'],
  urgency: ['Call Now', 'Get Fast Help', 'Request Service', 'Get a Free Quote'],
  visual: ['Get a Free Estimate', 'See Our Work', 'Book a Visit', 'Get a Quote'],
  trust: ['Book a Consultation', 'Schedule a Visit', 'Get in Touch', 'Request an Appointment'],
};

function pickFrom<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)] ?? arr[0];
}

export function pickHeroCopy(opts: {
  industryKey: IndustryKey;
  label: string;
  businessName?: string | null;
  rng?: () => number;
}): { subheadline: string; ctaText: string } {
  const rng = opts.rng ?? Math.random;
  const style = industryStyle(opts.industryKey);
  // Blend the style pool with the generic pool for extra spread.
  const subs = [...SUBHEADS[style], ...SUBHEADS.generic];
  const ctas = [...CTAS[style], ...CTAS.generic];
  const label = (opts.label || '').toLowerCase();
  const business = (opts.businessName || '').trim() || opts.label;
  const subheadline = pickFrom(subs, rng)
    .replace(/\{label\}/g, label)
    .replace(/\{business\}/g, business);
  return { subheadline, ctaText: pickFrom(ctas, rng) };
}

/* ------------------------------- FAQ copy -------------------------------- */

type QA = { question: string; answer: string };

// ⚠️ EVERY ANSWER HERE IS PUBLISHED UNDER A REAL BUSINESS'S NAME, OFTEN WITHOUT THEM ASKING.
// The listing-import pipeline builds sites for named businesses from their public listing; whatever
// this file says, it says as them. So an answer may only state something that is true BY
// CONSTRUCTION (an invitation, a process we control) — never a fact about their operation.
//
// ⚠️ THE ONE THAT MADE THIS RULE: 'Yes — {business} is fully licensed and insured, so you're covered
// every step of the way.' That is a REGULATORY CLAIM about a company we have never spoken to. 51
// templates carried it, 16 of them listing-imports of real named businesses and 15 published. An
// invented menu item is a mistake about food; an invented insurance claim is one a customer can
// rely on and a regulator can act on. Same class as #738/#766, with liability attached.
//
// The test for a new answer: could this be FALSE for the business it is published under? If yes, it
// does not go here — turn it into a question the visitor asks them.
const FAQS_GENERIC: QA[] = [
  { question: 'How do I get a quote?', answer: 'Send a message through the contact form or give us a call, and we’ll get back to you.' },
  { question: 'What areas do you serve?', answer: 'Get in touch and we’ll let you know whether we cover your neighborhood.' },
  { question: 'Are you licensed and insured?', answer: 'Ask us and we’ll confirm our current license and insurance details before any work starts.' },
  { question: 'How does payment work?', answer: 'Ask about pricing and payment when you get in touch and we’ll walk you through it.' },
];

const FAQS_BY_STYLE: Record<IndustryStyle, QA[]> = {
  generic: [],
  // Same rule as FAQS_GENERIC: no response times, no safety guarantees, no pricing promises.
  // "We respond within the hour" is a service-level commitment invented for a stranger.
  urgency: [
    { question: 'Do you offer emergency or same-day service?', answer: 'Call us and we’ll tell you what we can do today.' },
    { question: 'How fast can you get here?', answer: 'Call and we’ll give you an honest ETA for your address.' },
  ],
  visual: [
    { question: 'Can I see examples of your work?', answer: 'Ask us for recent photos from jobs near you.' },
    { question: 'Is your process safe for my property?', answer: 'Ask us how we protect the surrounding area for the work you need.' },
  ],
  trust: [
    { question: 'What should I expect at a first consultation?', answer: 'Get in touch and we’ll talk through your situation and the options.' },
    { question: 'How is pricing structured?', answer: 'Ask about pricing when you get in touch and we’ll explain how it works for your job.' },
  ],
};

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 3 industry-appropriate FAQ items (style-specific first, then generic), varied per site. */
export function pickFaqItems(opts: {
  industryKey: IndustryKey;
  businessName?: string | null;
  label?: string;
  rng?: () => number;
}): Array<{ question: string; answer: string; appearance: 'default' }> {
  const rng = opts.rng ?? Math.random;
  const style = industryStyle(opts.industryKey);
  const business = (opts.businessName || '').trim() || opts.label || 'our team';
  const styled = shuffle(FAQS_BY_STYLE[style], rng);
  const generic = shuffle(FAQS_GENERIC, rng);
  const chosen = [...styled.slice(0, 1), ...generic].slice(0, 3);
  return chosen.map((qa) => ({
    question: qa.question,
    answer: qa.answer.replace(/\{business\}/g, business),
    appearance: 'default' as const,
  }));
}

/* --------------------------- Testimonial copy ---------------------------- */

// ⚠️ The invented-testimonial generator that used to live here was REMOVED (2026-07-30).
// It emitted 5-star reviews interpolating the real business's name ("I'd hire {business} again
// in a heartbeat" — Satisfied Client) onto sites auto-built for real named businesses. Deleted
// rather than left unused, so it cannot be switched back on without someone rewriting it and
// noticing what they are writing — the same call as removing the `include_people` opt-in for
// rule 9. Testimonial blocks ship EMPTY; the owner supplies real ones.
// See crosstalk/contracts/honest-scaffold-standard.md.

