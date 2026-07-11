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

const FAQS_GENERIC: QA[] = [
  { question: 'How do I get a quote?', answer: 'Reach out through the contact form or give us a call — we’ll get back to you quickly with a free, no-obligation quote.' },
  { question: 'What areas do you serve?', answer: 'We proudly serve the local area and surrounding communities. Contact us to confirm we cover your neighborhood.' },
  { question: 'Are you licensed and insured?', answer: 'Yes — {business} is fully licensed and insured, so you’re covered every step of the way.' },
  { question: 'How does payment work?', answer: 'We provide a clear estimate before any work begins and accept all major payment methods.' },
];

const FAQS_BY_STYLE: Record<IndustryStyle, QA[]> = {
  generic: [],
  urgency: [
    { question: 'Do you offer emergency or same-day service?', answer: 'Yes — we prioritize urgent jobs and get to you the same day whenever possible.' },
    { question: 'How fast can you get here?', answer: 'In most cases we respond within the hour. Call us and we’ll give you an honest ETA.' },
  ],
  visual: [
    { question: 'Can I see examples of your work?', answer: 'Absolutely — ask us for recent before-and-after photos from jobs near you.' },
    { question: 'Is your process safe for my property?', answer: 'We use proven, property-safe methods and take care to protect surrounding areas.' },
  ],
  trust: [
    { question: 'What should I expect at a first consultation?', answer: 'We’ll listen to your situation, explain your options clearly, and outline next steps — no pressure.' },
    { question: 'How is pricing structured?', answer: 'We’re upfront about costs and walk you through everything before you commit.' },
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

type Quote = { quote: string; attribution: string };

const QUOTES_GENERIC: Quote[] = [
  { quote: 'Professional, on time, and the results speak for themselves. Highly recommend.', attribution: 'Local Customer' },
  { quote: 'Great communication from start to finish — I’d hire {business} again in a heartbeat.', attribution: 'Satisfied Client' },
];

const QUOTES_BY_STYLE: Record<IndustryStyle, Quote[]> = {
  generic: [],
  urgency: [{ quote: 'Called in a panic and they had someone out fast. Absolute lifesavers.', attribution: 'Relieved Customer' }],
  visual:  [{ quote: 'The before-and-after was night and day — my place has never looked better.', attribution: 'Happy Homeowner' }],
  trust:   [{ quote: 'They explained everything clearly and made the whole process easy.', attribution: 'Grateful Client' }],
};

/** 2 seed testimonials (one style-flavored where available, one generic), varied per site. */
export function pickTestimonials(opts: {
  industryKey: IndustryKey;
  businessName?: string | null;
  rng?: () => number;
}): Array<{ quote: string; attribution: string; avatar_url: string; rating: number }> {
  const rng = opts.rng ?? Math.random;
  const style = industryStyle(opts.industryKey);
  const business = (opts.businessName || '').trim() || 'them';
  const styled = QUOTES_BY_STYLE[style];
  const generic = shuffle(QUOTES_GENERIC, rng);
  const chosen = [...styled.slice(0, 1), ...generic].slice(0, 2);
  return chosen.map((q) => ({
    quote: q.quote.replace(/\{business\}/g, business),
    attribution: q.attribution,
    avatar_url: '',
    rating: 5,
  }));
}
