// lib/seo/blogPosts.ts
//
// Pure builders for auto-generated blog posts (as pages). Each post is a local-intent
// article whose whole SEO value is that it (a) targets a long-tail "<topic> in <city>"
// query and (b) links back to the site's own pages — home, the city/service landing page,
// and contact. That internal linking is the safe, guideline-friendly play (never a
// cross-domain link scheme). The prose is filled by an LLM server-side (unique per site,
// so it isn't duplicate content); this module owns the topic set, the page shape, and the
// guaranteed internal links.

import { createDefaultBlock } from '@/lib/createDefaultBlock';
import { slugForCityService, type LocalPage } from '@/lib/seo/localPages';

export type BlogTopic = {
  key: string;
  title: string;
  slug: string;
  /** A one-line brief handed to the LLM to ground the article. */
  brief: string;
};

function slugify(s: string): string {
  return (s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function uuid(): string {
  return (globalThis as any).crypto?.randomUUID?.() ?? `p_${Math.random().toString(36).slice(2)}`;
}

/** Local-intent blog topics for a trade + city (ordered; take the first N you want). */
export function blogTopicsFor(serviceLabel: string, city: string): BlogTopic[] {
  const s = serviceLabel;
  const defs: { key: string; title: string; brief: string }[] = [
    { key: 'signs', title: `5 Signs You Need ${s} in ${city}`, brief: `Common warning signs a ${city} home or business needs ${s.toLowerCase()}, and when to call a pro.` },
    { key: 'choose', title: `How to Choose a ${s} Company in ${city}`, brief: `What to look for when hiring ${s.toLowerCase()} in ${city}: licensing, reviews, response time, upfront pricing.` },
    { key: 'cost', title: `What Does ${s} Cost in ${city}?`, brief: `Typical price ranges and the factors that drive ${s.toLowerCase()} cost in the ${city} area (no invented exact numbers).` },
    { key: 'emergency', title: `${s} Emergencies in ${city}: What to Do First`, brief: `Immediate steps a ${city} resident should take during a ${s.toLowerCase()} emergency before help arrives.` },
    { key: 'seasonal', title: `Seasonal ${s} Tips for ${city}`, brief: `Season-by-season ${s.toLowerCase()} maintenance advice tailored to ${city}'s climate.` },
  ];
  return defs.map((d) => ({ key: d.key, title: d.title, slug: slugify(d.title), brief: d.brief }));
}

/** A default, non-LLM body (used only as a fallback so a post is never empty). */
export function fallbackBodyHtml(topic: BlogTopic, serviceLabel: string, city: string): string {
  return (
    `<p>${topic.brief}</p>` +
    `<p>${serviceLabel} in ${city} isn't one-size-fits-all — the right approach depends on your property, ` +
    `your timeline, and your budget. Below we walk through what local ${city} customers ask us most.</p>`
  );
}

export type InternalLink = { href: string; text: string };

/**
 * Build a blog post page. `bodyHtml` is the article body (LLM or fallback); we always
 * prepend the H1 and append a "Related" line of guaranteed internal links to own pages.
 */
export function buildBlogPostPage(opts: { title: string; slug: string; bodyHtml: string; internalLinks: InternalLink[] }): LocalPage {
  const links = opts.internalLinks.filter((l) => l.href && l.text);
  const related = links.length
    ? `<p><strong>Related:</strong> ${links.map((l) => `<a href="${l.href}">${l.text}</a>`).join(' · ')}</p>`
    : '';

  const text: any = createDefaultBlock('text');
  text.content = text.content ?? {};
  text.content.value = `<h1>${opts.title}</h1>${opts.bodyHtml}${related}`;

  const blocks = [text];
  return {
    id: uuid(),
    slug: opts.slug,
    title: opts.title,
    show_header: true,
    show_footer: true,
    content_blocks: blocks,
    blocks,
  };
}

/** The internal links a post should carry: home, the city/service page (if any), contact. */
export function blogInternalLinks(serviceLabel: string, city: string, opts: { hasCityPage: boolean }): InternalLink[] {
  const links: InternalLink[] = [{ href: '/', text: 'Our services' }];
  if (opts.hasCityPage) links.push({ href: `/${slugForCityService(serviceLabel, city)}`, text: `${serviceLabel} in ${city}` });
  links.push({ href: '#contact', text: 'Get a free quote' });
  return links;
}
