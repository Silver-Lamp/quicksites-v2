// lib/treehouseBuilders/buildHubSite.ts
//
// The national hub for customtreehousebuilders.com (docs/TREEHOUSE_COHORT.md), and the per-state
// pages derived from the same registry.
//
//   hero        what the page is, stated as a directory — never as a builder
//   directory   every builder, each with its source and its own words about where it works
//   faq         cost, permits, trees, hiring — hedged, sourced where a figure appears
//   contact     "Do you build treehouses? Get listed." (supply-side capture)
//
// ⚠️ THE STATE PAGE IS THE HARD ONE, AND ITS HONESTY LIVES IN THE SUBTITLE. Most states have
// nobody based in them; the page still has value because these firms travel, but only if it says
// so plainly. `stateSubtitle()` distinguishes "two builders are based here" from "nobody is based
// here — these firms say they travel", and never lets the second read like the first. That is the
// unkept-"near me"-promise failure the dome cohort warned about, in its sharpest form.
//
// ⚠️ No safety, licensing or insurance language anywhere — not even quoting a builder's own.
// These are structures children climb into. Pinned by a test over the built page.

import { buildIndustryStarter } from '@/lib/builder/industryScaffold';
import { createDefaultBlock } from '@/lib/createDefaultBlock';
import {
  TREEHOUSE_BUILDERS,
  buildersForState,
  isFirstHand,
  type TreehouseBuilder,
} from '@/lib/treehouseBuilders/builders';

export const ORDERING_NOTE =
  'Listed alphabetically — no paid placement, and being listed here is not an agreement with anyone.';

/** Cost figures come from ONE builder's published page, and the answer says whose. */
export const TREEHOUSE_FAQ = [
  {
    question: 'What does a custom treehouse cost?',
    answer:
      'It depends on size, height, access and how finished it is, and most builders quote per project. One published example: Treehouse Experts list suspended platforms from $5,400 and vacation-rental treehouses from $60,000 on their own site (read September 2026). Treat that as one company’s starting points, not a market rate — ask each builder.',
  },
  {
    question: 'Will a builder travel to me?',
    answer:
      'Often, yes — this trade is unusually national. Several of the companies here say they work across the country or internationally, and one of the busiest is based in Pennsylvania. Nelson Treehouse notes on their site that crew travel, accommodation and freight are real costs on distant projects, so expect distance to show up in a quote. Each listing shows what that company says about where it works.',
  },
  {
    question: 'Do I need a permit?',
    answer:
      'Usually it depends on size, height and whether anyone sleeps in it, and the rules differ by county — a small play structure and a habitable treehouse are treated very differently. Ask your county building department before you commit, and ask the builder what drawings they provide.',
  },
  {
    question: 'What kind of tree do I need?',
    answer:
      'Builders assess the specific trees before designing anything — species, trunk diameter, health and root space all matter, and some designs use posts alongside the tree to spread load. Nobody on this page can tell you whether your tree works without looking at it.',
  },
  {
    question: 'How is this list put together?',
    answer:
      'Each entry links the source it came from and the date it was read. Where a company states where it builds, we quote them. Where a company has not said, we leave it blank rather than guess. We are not a builder, we take no payment for placement, and being listed is not an endorsement or an agreement.',
  },
];

function entryFor(b: TreehouseBuilder) {
  const where = [b.baseCity, b.baseState].filter(Boolean).join(', ');
  return {
    name: b.name,
    city: b.baseCity ?? '',
    region: b.baseState ?? '',
    website: b.url,
    // Their own words about coverage, attributed — never our paraphrase presented as fact.
    summary: b.serviceAreaQuote
      ? `${b.summary} They say they work: “${b.serviceAreaQuote}”`
      : b.summary,
    kinds: [
      where ? `Based in ${where}` : 'Base not stated',
      ...(isFirstHand(b) ? [] : ['Listing not yet confirmed with them']),
    ],
    source_label: b.sources[0].note.startsWith('⚠️')
      ? 'Source (see note)'
      : `Source, read ${b.sources[0].read}`,
    source_url: b.sources[0].url,
  };
}

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });

function shell(businessName: string) {
  const tpl: any = buildIndustryStarter({ businessName, industryKey: 'treehouse_builder' });
  const page = tpl.data.pages[0];
  page.title = businessName;
  page.slug = 'home';
  // The scaffold seeds a services list for a business. A directory has no services.
  delete tpl.data.services;
  return { tpl, page };
}

function contactBlock(prompt: string) {
  const contact: any = createDefaultBlock('contact_form');
  contact.content = { ...contact.content, title: 'Do you build treehouses?', subtitle: prompt };
  delete contact.content.phone;
  delete contact.content.address;
  delete contact.content.email;
  return contact;
}

export function buildHubSite(input: { domain: string }) {
  const businessName = 'Custom Treehouse Builders';
  const { tpl, page } = shell(businessName);

  const hero: any = createDefaultBlock('hero');
  hero.content = {
    ...hero.content,
    headline: 'Custom treehouse builders in the United States',
    subheadline:
      'A sourced list of the companies that design and build treehouses. Most of them travel, so the nearest one is often not the closest one — each listing shows what that company says about where it works.',
    cta_text: 'See the builders',
    cta_link: '#builders',
    image_url: '',
  };

  const directory: any = createDefaultBlock('builders_directory');
  directory.content = {
    title: 'Treehouse builders',
    subtitle: `${ORDERING_NOTE} Every listing names where the information came from and when it was read. We do not claim prices, licensing or insurance for anyone — ask the builder.`,
    trade_label: 'treehouse builders',
    region_label: '',
    entries: TREEHOUSE_BUILDERS.map(entryFor).sort(byName),
    listing_cta_label: 'Build treehouses? Get listed →',
    listing_cta_link: '#contact',
  };

  const faq: any = createDefaultBlock('faq');
  faq.content = { ...faq.content, title: 'Before you call anyone', items: TREEHOUSE_FAQ };

  page.blocks = [hero, directory, faq, contactBlock('Tell us where you build and link a page of your work. Listings are free; we check against your own site before adding you.')];
  if (Array.isArray(page.content_blocks)) page.content_blocks = page.blocks;
  tpl.data.meta = {
    ...(tpl.data.meta ?? {}),
    directory: true,
    site_type: 'directory',
    geo_industry: 'treehouse_builder',
    domain: input.domain,
  };
  return { ...tpl, slug: input.domain.replace(/\..*$/, '').replace(/[^a-z0-9]/g, ''), businessName };
}

/**
 * The sentence that makes a state page honest. Three genuinely different situations, and the
 * page must never let the third read like the first.
 *
 * ⚠️ TAKES BOTH THE NAME AND THE CODE ON PURPOSE. The first cut took only the display name and
 * passed it to buildersForState, which matches two-letter codes — so "Tennessee" never matched
 * "TN" and EVERY state page said "we have not found a builder", including the ones with two.
 * A test caught it; the signature is what stops it coming back.
 */
export function stateSubtitle(state: string, stateCode: string): string {
  const { basedHere, servesHere } = buildersForState(stateCode);
  if (basedHere.length && servesHere.length) {
    return `${basedHere.length} builder${basedHere.length === 1 ? ' is' : 's are'} based in ${state}, and ${servesHere.length} more name${servesHere.length === 1 ? 's' : ''} ${state} as somewhere they build.`;
  }
  if (basedHere.length) {
    return `${basedHere.length} builder${basedHere.length === 1 ? ' is' : 's are'} based in ${state}. Others travel — see the national list.`;
  }
  if (servesHere.length) {
    return `No treehouse builder we found is based in ${state}. ${servesHere.length === 1 ? 'This company names' : 'These companies name'} ${state} as somewhere they build.`;
  }
  return `We have not found a treehouse builder based in ${state}, and none of the companies we list names it. The builders on our national list travel.`;
}

export function buildStateSite(input: { state: string; stateCode: string; domain: string }) {
  const { state, stateCode, domain } = input;
  const businessName = `Treehouse Builders in ${state}`;
  const { tpl, page } = shell(businessName);
  const { basedHere, servesHere } = buildersForState(stateCode);

  const hero: any = createDefaultBlock('hero');
  hero.content = {
    ...hero.content,
    headline: `Treehouse builders in ${state}`,
    subheadline: stateSubtitle(state, stateCode),
    cta_text: 'See the builders',
    cta_link: '#builders',
    image_url: '',
  };

  const directory: any = createDefaultBlock('builders_directory');
  directory.content = {
    title: `Builders for a ${state} project`,
    subtitle: `${ORDERING_NOTE} Every listing names where the information came from and when it was read. We do not claim prices, licensing or insurance for anyone — ask the builder.`,
    trade_label: 'treehouse builders',
    region_label: state,
    entries: [...basedHere, ...servesHere].map(entryFor).sort(byName),
    listing_cta_label: `Build treehouses in ${state}? Get listed →`,
    listing_cta_link: '#contact',
  };

  const faq: any = createDefaultBlock('faq');
  faq.content = { ...faq.content, title: 'Before you call anyone', items: TREEHOUSE_FAQ };

  page.blocks = [hero, directory, faq, contactBlock(`Tell us where in ${state} you build and link a page of your work. Listings are free; we check against your own site before adding you.`)];
  if (Array.isArray(page.content_blocks)) page.content_blocks = page.blocks;
  tpl.data.meta = {
    ...(tpl.data.meta ?? {}),
    directory: true,
    site_type: 'directory',
    geo_industry: 'treehouse_builder',
    state,
    state_code: stateCode,
    domain,
  };
  return { ...tpl, slug: domain.replace(/\..*$/, '').replace(/[^a-z0-9]/g, ''), businessName };
}
