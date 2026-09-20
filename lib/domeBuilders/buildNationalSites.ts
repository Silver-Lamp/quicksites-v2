// lib/domeBuilders/buildNationalSites.ts
//
// The two national pages of the dome-builders cluster (docs/PPL_VERTICAL.md §9):
//
//   geodesicdomebuilders.com   the KIT MAKERS + suppliers who ship anywhere — DomeSketch's
//                              directory entries that a person building a dome would contact,
//                              every one with a source; the home for a Glamping Dome Store,
//                              which is in Alberta and belongs on no state page.
//   domebuildersnearme.com     the STATE CHOOSER — "find builders near you" → the 13 state pages,
//                              plus the kit makers page and the calculator.
//
// Same rules as the state pages (buildDirectorySite.ts): a directory, never a business; no
// services, phone or "free quote"; nothing said about an org its own site does not say. Pure.

import { buildIndustryStarter } from '@/lib/builder/industryScaffold';
import { createDefaultBlock } from '@/lib/createDefaultBlock';
import { DOME_FAQ, type DirectoryEntry } from '@/lib/domeBuilders/buildDirectorySite';
import {
  DIRECTORY_ORDERING_NOTE,
  orgEntryFields,
  sortAlphabetically,
  type DomesketchOrg,
} from '@/lib/domeBuilders/domesketchFeed';

/** @deprecated alias — the feed's record shape lives in lib/domeBuilders/domesketchFeed.ts */
export type DomeOrg = DomesketchOrg;

/** Categories a person building a dome would contact. Software, open-source and associations are not sellers. */
export const BUYER_FACING_CATEGORIES = new Set([
  'kit-maker',
  'hub-supplier',
  'contractor',
  'monolithic',
  'aircrete',
  'engineer',
  'printing-3d',
  'materials',
]);

const REGION_LABEL: Record<string, string> = {
  US: 'United States',
  worldwide: 'Ships worldwide',
  online: 'Online',
  EU: 'Europe',
  CA: 'Canada',
  GB: 'United Kingdom',
};

function regionLabel(regions: string[] = []): string {
  const us = regions.filter((r) => r.startsWith('US-')).map((r) => r.slice(3));
  if (us.length)
    return `${us.join(', ')} · ${regions.includes('worldwide') ? 'ships worldwide' : 'United States'}`;
  const named = regions
    .map((r) => REGION_LABEL[r] ?? r.replace(/^CA-/, 'Canada · '))
    .filter(Boolean);
  return named[0] ?? '';
}

function kindLabels(categories: string[] = []): string[] {
  return categories.map((c) => c.replace(/-/g, ' ')).map((c) => c[0].toUpperCase() + c.slice(1));
}

/** DomeSketch orgs → directory entries. Only orgs with at least one source are accepted. */
export function orgsToEntries(orgs: DomeOrg[]): DirectoryEntry[] {
  return orgs
    .filter((o) => (o.categories ?? []).some((c) => BUYER_FACING_CATEGORIES.has(c)))
    .filter((o) => Array.isArray(o.sources) && o.sources.length > 0)
    .map((o) => ({
      ...orgEntryFields(o),
      region: regionLabel(o.regions),
      kinds: kindLabels(o.categories),
    }));
}

function baseSite(businessName: string) {
  const tpl: any = buildIndustryStarter({ businessName, industryKey: 'dome_builder' });
  const page = tpl.data.pages[0];
  page.title = businessName;
  page.slug = 'home';
  delete tpl.data.services;
  return { tpl, page };
}

function stamp(tpl: any, meta: Record<string, unknown>) {
  tpl.data.meta = {
    ...(tpl.data.meta ?? {}),
    directory: true,
    site_type: 'directory',
    geo_industry: 'dome_builder',
    ...meta,
  };
}

export type StateLink = { state: string; domain: string; count: number };

export function buildKitMakersSite(input: {
  domain: string;
  orgs: DomeOrg[];
  calculatorUrl: string;
  states: StateLink[];
}) {
  const businessName = 'Geodesic Dome Builders & Kit Makers';
  const { tpl, page } = baseSite(businessName);
  const entries = sortAlphabetically(orgsToEntries(input.orgs));

  const hero: any = createDefaultBlock('hero');
  hero.content = {
    ...hero.content,
    headline: 'Geodesic dome builders & kit makers',
    subheadline:
      'The companies that make dome kits, hubs, engineered plans and turnkey builds — most ship anywhere in the United States. Design your dome first, free, then talk to one.',
    cta_text: 'Design your dome first',
    cta_link: input.calculatorUrl,
    image_url: '',
  };

  const directory: any = createDefaultBlock('builders_directory');
  directory.content = {
    title: 'Kit makers and suppliers',
    subtitle: `${DIRECTORY_ORDERING_NOTE} Every listing names where the information came from. We do not claim licensing, insurance or prices for anyone — ask the company.`,
    trade_label: 'dome kit makers',
    region_label: '',
    entries,
    cta_label: 'Open the DomeSketch calculator',
    cta_link: input.calculatorUrl,
    listing_cta_label: 'Make dome kits or build domes? Get listed →',
    listing_cta_link: '#contact',
  };

  const states: any = createDefaultBlock('text');
  states.content = {
    format: 'html',
    html:
      `<h2>Looking for a builder near you?</h2><p>Local builders are listed by state:</p><ul>` +
      input.states
        .map(
          (s) =>
            `<li><a href="https://${s.domain}/">Dome builders in ${s.state}</a>${s.count ? ` (${s.count} listed)` : ''}</li>`
        )
        .join('') +
      `</ul>`,
  };

  const faq: any = createDefaultBlock('faq');
  faq.content = { ...faq.content, title: 'Dome basics', items: DOME_FAQ };

  const contact: any = createDefaultBlock('contact_form');
  contact.content = {
    ...contact.content,
    title: 'Make dome kits or build domes?',
    subtitle:
      'Tell us who you are and what you make. Listings are free; we verify against your own site before adding you.',
  };
  delete contact.content.phone;
  delete contact.content.address;
  delete contact.content.email;

  page.blocks = [hero, directory, states, faq, contact];
  if (Array.isArray(page.content_blocks)) page.content_blocks = page.blocks;
  stamp(tpl, {
    directory_trade: 'dome_builder',
    directory_scope: 'national',
    title: 'Geodesic dome builders & kit makers — sourced directory',
    description:
      'Dome kit makers, hub suppliers, engineers and turnkey builders, each with a source. Design your dome first with the free DomeSketch calculator.',
  });
  return {
    slug: 'geodesicdomebuilders',
    domain: input.domain,
    businessName,
    data: tpl.data,
    color_mode: tpl.color_mode,
    header_block: tpl.header_block,
    footer_block: tpl.footer_block,
    entries,
  };
}

export function buildStateChooserSite(input: {
  domain: string;
  states: StateLink[];
  kitMakersDomain: string;
  calculatorUrl: string;
}) {
  const businessName = 'Dome Builders Near Me';
  const { tpl, page } = baseSite(businessName);

  const hero: any = createDefaultBlock('hero');
  hero.content = {
    ...hero.content,
    headline: 'Find dome builders near you',
    subheadline:
      'Local dome builders by state, each listing sourced. Not near one? Most kit makers ship anywhere. Design your dome first, free, then call.',
    cta_text: 'Design your dome first',
    cta_link: input.calculatorUrl,
    image_url: '',
  };

  const sorted = [...input.states].sort((a, b) => a.state.localeCompare(b.state));
  const chooser: any = createDefaultBlock('text');
  chooser.content = {
    format: 'html',
    html:
      `<h2>Choose your state</h2><ul>` +
      sorted
        .map(
          (s) =>
            `<li><a href="https://${s.domain}/">${s.state}</a>${s.count ? ` — ${s.count} listed` : ''}</li>`
        )
        .join('') +
      `</ul><p>Don't see your state? <a href="https://${input.kitMakersDomain}/">Kit makers and suppliers ship nationwide</a>.</p>`,
  };

  const faq: any = createDefaultBlock('faq');
  faq.content = { ...faq.content, title: 'Dome basics', items: DOME_FAQ };

  const contact: any = createDefaultBlock('contact_form');
  contact.content = {
    ...contact.content,
    title: 'Are you a dome builder?',
    subtitle:
      'Tell us where you build. Listings are free; we verify against your own site before adding you.',
  };
  delete contact.content.phone;
  delete contact.content.address;
  delete contact.content.email;

  page.blocks = [hero, chooser, faq, contact];
  if (Array.isArray(page.content_blocks)) page.content_blocks = page.blocks;
  stamp(tpl, {
    directory_trade: 'dome_builder',
    directory_scope: 'chooser',
    title: 'Dome builders near me — by state',
    description:
      'Find local dome builders by state, plus kit makers who ship nationwide. Design your dome first with the free DomeSketch calculator.',
  });
  return {
    slug: 'domebuildersnearme',
    domain: input.domain,
    businessName,
    data: tpl.data,
    color_mode: tpl.color_mode,
    header_block: tpl.header_block,
    footer_block: tpl.footer_block,
  };
}
