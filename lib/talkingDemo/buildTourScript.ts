// lib/talkingDemo/buildTourScript.ts
//
// The QS-owned core of Talking Demo Tier 2 (crosstalk/contracts/talking-demo-render.md):
// turn a site's blocks into a stepped tour SCRIPT — [{caption, say, dwell_ms?}] — that HJ narrates.
//
// Deterministic (no LLM): each meaningful block becomes one spoken step, derived from the block's
// own content, so the tour is grounded in exactly what's on the page. Clamped to the contract's
// guards (<= 24 steps, ~300 chars/line). HJ renders exactly what it's handed — it does no authoring.

import { type TourStep, type TalkingDemoScript, MAX_STEPS, MAX_SAY_CHARS } from './types';

function str(v: any): string {
  return typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '';
}
function clampSay(s: string): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= MAX_SAY_CHARS) return t;
  // Trim to the last sentence/word boundary under the cap.
  const cut = t.slice(0, MAX_SAY_CHARS);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return (lastStop > MAX_SAY_CHARS * 0.5 ? cut.slice(0, lastStop + 1) : cut.replace(/\s+\S*$/, '')).trim();
}
function names(items: any, key = 'name', max = 4): string[] {
  const arr = Array.isArray(items) ? items : [];
  return arr
    .map((it) => (typeof it === 'string' ? it : str(it?.[key]) || str(it?.title) || str(it?.headline)))
    .filter(Boolean)
    .slice(0, max);
}
/** "A, B and C" */
function list(xs: string[]): string {
  if (xs.length <= 1) return xs[0] || '';
  if (xs.length === 2) return `${xs[0]} and ${xs[1]}`;
  return `${xs.slice(0, -1).join(', ')}, and ${xs[xs.length - 1]}`;
}

type Ctx = { business: string };

// One handler per block type → the step it narrates (or null to skip). Only blocks that can be
// narrated meaningfully are included; everything else is silently skipped.
const HANDLERS: Record<string, (c: any, ctx: Ctx) => TourStep | null> = {
  hero: (c, ctx) => {
    const sub = str(c.subheadline) || str(c.subheading);
    const say = sub ? `Welcome to ${ctx.business}. ${sub}` : `Welcome to ${ctx.business}.`;
    return { caption: 'Welcome', say };
  },
  services: (c, ctx) => {
    const items = names(c.items ?? c.services);
    if (!items.length) return null;
    return { caption: 'What they do', say: `${ctx.business} offers ${list(items)}.` };
  },
  service_offer: (c, ctx) => {
    const t = str(c.title) || str(c.headline);
    return t ? { caption: 'Services', say: `${ctx.business} offers ${t}.` } : null;
  },
  agent_roster: (c) => {
    const agents = names(c.agents);
    if (!agents.length) return null;
    return { caption: 'Meet the team', say: `Meet the team — ${list(agents)} — and every one of them can walk you through their listings.` };
  },
  listing_card: (c) => {
    const headline = str(c.headline);
    const price = str(c.price);
    const beds = str(c.beds);
    const parts = [headline || 'A featured home', price ? `listed at ${price}` : '', beds ? `${beds} bedrooms` : ''].filter(Boolean);
    return { caption: 'Featured listing', say: `${parts.join(', ')}.` };
  },
  listings_grid: (c) => {
    const homes = names(c.listings, 'headline');
    const count = Array.isArray(c.listings) ? c.listings.length : 0;
    if (!count) return null;
    const lead = count === 1 ? 'a featured listing' : `${count} listings`;
    return { caption: 'Current listings', say: `Browse ${lead}${homes.length ? `, including ${list(homes.slice(0, 2))}` : ''}.` };
  },
  neighborhood_stay: (c) => {
    const t = str(c.title) || str(c.headline);
    const price = str(c.price_per_night) || str(c.price);
    return t ? { caption: 'The stay', say: `${t}${price ? `, ${price} a night` : ''}.` } : null;
  },
  menu: (c) => {
    const sections = Array.isArray(c.sections) ? c.sections : [];
    const dishes = sections.flatMap((s: any) => names(s?.items)).slice(0, 4);
    if (!dishes.length) return null;
    return { caption: 'The menu', say: `On the menu you'll find ${list(dishes)}, and more.` };
  },
  products_grid: (c, ctx) => {
    const prods = names(c.products);
    return { caption: 'Shop', say: prods.length ? `In the shop: ${list(prods)}.` : `Browse everything ${ctx.business} has for sale, right here.` };
  },
  testimonial: (c) => {
    const t = Array.isArray(c.testimonials) ? c.testimonials[0] : null;
    const quote = str(t?.quote);
    const who = str(t?.attribution);
    if (!quote) return null;
    return { caption: 'What people say', say: `Here's what people say: "${quote}"${who ? ` — ${who}.` : ''}` };
  },
  faq: (c) => {
    const item = Array.isArray(c.items) ? c.items[0] : null;
    const q = str(item?.question);
    const a = str(item?.answer);
    if (!q || !a) return null;
    return { caption: 'Good to know', say: `${q} ${a}` };
  },
  location: (c, ctx) => {
    const addr = str(c.address);
    return addr ? { caption: 'Find them', say: `You'll find ${ctx.business} at ${addr}.` } : null;
  },
  contact_form: (c, ctx) => ({
    caption: 'Get in touch',
    say: `Ready to reach out? Get in touch with ${ctx.business} right here — that's the whole site.`,
  }),
};

function blockType(b: any): string {
  return str(b?.type) || str(b?._type);
}
function blockContent(b: any): any {
  return b?.content ?? b?.props ?? b ?? {};
}

/**
 * Build the ordered tour steps from a site's blocks. Pure + deterministic. Skips blocks that can't
 * be narrated; guarantees at least a welcome + a closer so a sparse site still tours.
 */
export function buildTourSteps(businessName: string, blocks: any[]): TourStep[] {
  const business = str(businessName) || 'this business';
  const ctx: Ctx = { business };
  const src = Array.isArray(blocks) ? blocks : [];

  const steps: TourStep[] = [];
  const seen = new Set<string>(); // one step per block type (the first of each) — avoids repetition
  for (const b of src) {
    if (steps.length >= MAX_STEPS - 1) break; // leave room for a closer
    const type = blockType(b);
    const handler = HANDLERS[type];
    if (!handler || seen.has(type)) continue;
    const step = handler(blockContent(b), ctx);
    if (!step || !step.say.trim()) continue;
    seen.add(type);
    steps.push({ caption: step.caption, say: clampSay(step.say), ...(step.dwell_ms ? { dwell_ms: step.dwell_ms } : {}) });
  }

  // Guarantee a welcome up front.
  if (!steps.length || steps[0].caption !== 'Welcome') {
    steps.unshift({ caption: 'Welcome', say: clampSay(`Here's a quick tour of ${business}.`) });
  }
  // Guarantee a closer if the site had no contact block.
  if (!seen.has('contact_form')) {
    steps.push({ caption: 'Thanks for visiting', say: clampSay(`That's ${business}. Have a look around — everything you need is right here.`) });
  }

  return steps.slice(0, MAX_STEPS);
}

/** Wrap the steps into the full render request payload (crosstalk/contracts/talking-demo-render.md). */
export function buildTalkingDemoScript(input: {
  instanceRef: string;
  businessName: string;
  blocks: any[];
  voice?: 'house' | 'owner_clone';
  wantMp4?: boolean;
}): TalkingDemoScript {
  return {
    instance_ref: str(input.instanceRef),
    steps: buildTourSteps(input.businessName, input.blocks),
    ...(input.voice ? { voice: input.voice } : {}),
    ...(input.wantMp4 != null ? { want_mp4: input.wantMp4 } : {}),
  };
}
