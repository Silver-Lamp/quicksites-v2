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
