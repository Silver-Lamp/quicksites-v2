// lib/domeBuilders/buildDirectorySite.ts
//
// The site that sits on a <state>domebuilders.com domain (docs/PPL_VERTICAL.md §9; the
// DomeSketch proposal, crosstalk 2026-09-19). It is a DIRECTORY, not a business:
//
//   hero        "Dome builders in Texas" + the DomeSketch calculator as the lead magnet
//   directory   the builders serving the state — every entry with a source
//   faq         what a dome is, the kinds, permits, how to get a cost — hedged, no claims
//   contact     "Are you a dome builder in Texas? Get listed." (supply-side capture)
//
// Why not the industry scaffold: it writes first-person business copy ("Welcome to Texas Dome
// Builders — get a free quote") under a name nobody owns, which is the invented-business
// failure §8's live-claim hygiene exists to stop. The theme comes from the scaffold; the
// blocks do not. Pure: returns template data, writes nothing.

import { buildIndustryStarter } from '@/lib/builder/industryScaffold';
import { createDefaultBlock } from '@/lib/createDefaultBlock';

export type DirectoryEntry = {
  name: string;
  city?: string;
  region?: string;
  phone?: string;
  website?: string;
  summary?: string;
  kinds?: string[];
  source_label?: string;
  source_url?: string;
};

export type DirectorySiteInput = {
  state: string; // "Texas"
  stateCode: string; // "TX"
  domain: string; // "texasdomebuilders.com"
  entries: DirectoryEntry[];
  /** The DomeSketch calculator link (with UTM). */
  calculatorUrl: string;
};

export const DOME_FAQ = [
  {
    question: 'What is a geodesic dome?',
    answer:
      'A structure made of a network of triangles on a spherical surface. The triangles share loads, so a dome uses less material per square foot of enclosed space than a box of the same size and resists wind and snow well. Sizes are described by diameter and "frequency" (2V, 3V, 4V) — how finely the sphere is divided.',
  },
  {
    question: 'What kinds of domes do builders offer?',
    answer:
      'Geodesic frames (wood or steel struts with a shell or cover), monolithic concrete domes sprayed over an inflated form, AirCrete block domes, and earth-sheltered or earth-panel domes. Some companies sell kits you assemble; others build turnkey. Each listing says which.',
  },
  {
    question: 'Do I need a permit to build a dome home?',
    answer:
      'Almost always — a dome home is permitted like any dwelling, and requirements differ by county. Engineered plans are usually required. Ask the builder what they provide and check with your county before you commit.',
  },
  {
    question: 'How do I get a cost estimate?',
    answer:
      'Design it first. The DomeSketch calculator gives strut lengths, hub and panel counts and a rough materials figure for your size and geometry; a builder then quotes the labor, foundation and finish for your site. Prices vary widely by size, cover and region, so this page does not quote them.',
  },
];

function stateSlug(state: string): string {
  return state.toLowerCase().replace(/[^a-z]/g, '');
}

export function buildDirectorySite(input: DirectorySiteInput) {
  const { state, stateCode, domain, entries, calculatorUrl } = input;
  const businessName = `Dome Builders in ${state}`;
  const tpl: any = buildIndustryStarter({ businessName, industryKey: 'dome_builder' });

  const hero: any = createDefaultBlock('hero');
  hero.content = {
    ...hero.content,
    headline: `Dome builders in ${state}`,
    subheadline: `Geodesic, monolithic and kit dome builders serving ${state}. Design your dome first — free — then talk to a builder who can make it real.`,
    cta_text: 'Design your dome first',
    cta_link: calculatorUrl,
    image_url: '',
  };

  const directory: any = createDefaultBlock('builders_directory');
  directory.content = {
    title: `Builders serving ${state}`,
    subtitle:
      'Every listing names where the information came from. We do not claim licensing, insurance or prices for anyone — ask the builder.',
    trade_label: 'dome builders',
    region_label: state,
    entries,
    cta_label: 'Open the DomeSketch calculator',
    cta_link: calculatorUrl,
    listing_cta_label: `Are you a dome builder in ${state}? Get listed →`,
    listing_cta_link: '#contact',
  };

  const faq: any = createDefaultBlock('faq');
  faq.content = { ...faq.content, title: 'Dome basics', items: DOME_FAQ };

  const contact: any = createDefaultBlock('contact_form');
  contact.content = {
    ...contact.content,
    title: `Are you a dome builder in ${state}?`,
    subtitle:
      'Tell us who you are and what you build. Listings are free; we verify against your own site before adding you.',
  };
  // Never a phone or address here: this page is not a business and has none.
  delete contact.content.phone;
  delete contact.content.address;
  delete contact.content.email;

  const page = tpl.data.pages[0];
  page.blocks = [hero, directory, faq, contact];
  if (Array.isArray(page.content_blocks)) page.content_blocks = page.blocks;
  page.title = businessName;
  page.slug = 'home';

  tpl.data.meta = {
    ...(tpl.data.meta ?? {}),
    directory: true,
    directory_trade: 'dome_builder',
    directory_state: stateCode,
    geo_campaign: true,
    geo_city: state,
    geo_industry: 'dome_builder',
    site_type: 'directory',
    title: `${businessName} — geodesic, monolithic & kit dome builders`,
    description: `Find dome builders serving ${state}. Design your dome first with the free DomeSketch calculator, then contact a builder.`,
  };
  // A directory has no services of its own.
  delete tpl.data.services;

  return {
    slug: stateSlug(state) + 'domebuilders',
    domain,
    businessName,
    data: tpl.data,
    color_mode: tpl.color_mode,
    header_block: tpl.header_block,
    footer_block: tpl.footer_block,
  };
}

/** Text every entry must NOT contain — claims about a business we cannot verify. */
export const FORBIDDEN_ENTRY_PHRASES = [
  'licensed',
  'insured',
  '24/7',
  'guarantee',
  'best',
  'cheapest',
  '#1',
];

export function entryIsClean(e: DirectoryEntry): boolean {
  const text = `${e.name} ${e.summary ?? ''} ${(e.kinds ?? []).join(' ')}`.toLowerCase();
  return !FORBIDDEN_ENTRY_PHRASES.some((p) => text.includes(p));
}
