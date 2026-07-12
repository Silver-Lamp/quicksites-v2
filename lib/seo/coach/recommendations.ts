// lib/seo/coach/recommendations.ts
//
// Pure "grow your SEO" recommendation engine for a site OWNER's own site (the
// customer-facing analog of lib/outreach/recommendations.ts). Deterministic rules over
// on-page + Search Console signals → a prioritized list. The LLM layer may only
// select/rephrase these; it never invents advice. See docs/AI_SEO_COACHING.md.

import type { SiteSeoSignals, SeoRec } from '@/lib/seo/coach/types';

/** Build a prioritized list of site-owner SEO recommendations. Pure + deterministic. */
export function buildSiteSeoRecommendations(s: SiteSeoSignals): SeoRec[] {
  const recs: SeoRec[] = [];
  const op = s.onPage;
  const g = s.gsc;

  // ---- Meta (title/description) — quick, high-leverage wins ----
  if (!op.hasTitle) {
    recs.push({ id: 'title-missing', category: 'meta', priority: 92, title: 'Add a page title', detail: 'Your homepage has no SEO title. Add a 30–60 character title with your business + main service/city — it’s what shows as the blue link in Google.' });
  } else if (op.titleLen < 30) {
    recs.push({ id: 'title-short', category: 'meta', priority: 74, title: 'Lengthen your title', detail: `Your title is only ${op.titleLen} characters. Aim for 30–60 and include your main service + location to earn more clicks.` });
  } else if (op.titleLen > 65) {
    recs.push({ id: 'title-long', category: 'meta', priority: 60, title: 'Trim your title', detail: `At ${op.titleLen} characters your title gets truncated in results. Tighten it to under ~60.` });
  }
  if (!op.hasDescription) {
    recs.push({ id: 'desc-missing', category: 'meta', priority: 84, title: 'Add a meta description', detail: 'No meta description is set, so Google guesses your snippet. Write a 70–160 character summary with a clear hook and your service area.' });
  } else if (op.descLen < 70) {
    recs.push({ id: 'desc-short', category: 'meta', priority: 58, title: 'Expand your meta description', detail: `Your description is short (${op.descLen} chars). Use 70–160 characters to describe what you offer and why to choose you.` });
  }

  // ---- Structured data ----
  if (!op.hasSchema) {
    recs.push({ id: 'add-schema', category: 'schema', priority: 66, title: 'Add business schema', detail: 'Structured data (LocalBusiness JSON-LD) helps Google understand your name, address, hours and service area — and can unlock rich results.' });
  }

  // ---- Content depth ----
  if (op.thinContent) {
    recs.push({ id: 'thin-content', category: 'content', priority: 70, title: 'Add more content', detail: `The page is light (~${op.wordCount} words). Add a services section, an about paragraph, and FAQs — pages with real depth rank far better.` });
  }
  if (op.pageCount <= 1) {
    recs.push({ id: 'add-pages', category: 'content', priority: 62, title: 'Add a services / location page', detail: 'A one-page site limits how much you can rank for. Add a dedicated services or “<city> <service>” page — one of the highest-ROI additions.' });
  }
  if (op.imagesMissingAlt > 0) {
    recs.push({ id: 'alt-text', category: 'content', priority: 40, title: 'Add image alt text', detail: `${op.imagesMissingAlt} image${op.imagesMissingAlt === 1 ? '' : 's'} lack alt text. Describe each image — it helps accessibility and image search.` });
  }

  // ---- Custom domain (foundational: brand/trust, not sharing a root domain) ----
  if (s.isPlatformSubdomain) {
    recs.push({ id: 'custom-domain', category: 'connectivity', priority: 48, title: 'Get a custom domain', detail: 'Your site is on a shared quicksites.ai subdomain. A custom domain (yourbusiness.com) builds trust, is easier to remember, and gives you a cleaner brand in search results. Search and connect one in a click from your site’s Domain settings.' });
  }

  // ---- Search Console connectivity ----
  if (!s.gscConnected) {
    recs.push({ id: 'connect-gsc', category: 'connectivity', priority: 88, title: 'Connect Google Search Console', detail: 'You’re not connected to Search Console, so we can’t see your ranking, impressions or clicks. Connect it to unlock real coaching on what to fix next.' });
  }

  // ---- Organic position / performance (needs GSC data) ----
  if (s.gscConnected && g && g.impressions > 0) {
    const pos = g.position || 0;
    if (pos > 10 && pos <= 20) {
      recs.push({ id: 'page2-push', category: 'organic', priority: 90, title: 'One push from page 1', detail: `You’re averaging position ~${pos.toFixed(0)} — page 2. Add a focused content page + business schema and earn a few local citations to cross onto page 1.` });
    } else if (pos > 20) {
      recs.push({ id: 'improve-rank', category: 'organic', priority: 68, title: 'Climb the rankings', detail: `Average position ~${pos.toFixed(0)}. Strengthen on-page content and consistency (name/address/phone) and build a few relevant backlinks.` });
    }
    if (g.impressions >= 50 && g.ctr < 0.015) {
      recs.push({ id: 'low-ctr', category: 'performance', priority: 80, title: 'People see you but don’t click', detail: `Only ${(g.ctr * 100).toFixed(1)}% click-through on ${g.impressions} impressions — you rank but the title/description isn’t earning the click. Rewrite them with a clear hook.` });
    }
    if (pos > 0 && pos <= 3 && g.clicks === 0 && g.impressions > 0) {
      recs.push({ id: 'top-no-clicks', category: 'performance', priority: 55, title: 'Top spot, few clicks', detail: 'You rank near the top but get almost no clicks — check that your title reads compellingly and your listing looks trustworthy.' });
    }
  } else if (s.gscConnected && g && g.impressions === 0) {
    recs.push({ id: 'not-indexed', category: 'organic', priority: 50, title: 'Not getting impressions yet', detail: 'Search Console shows no impressions yet. Add content, submit your sitemap, and give Google 2–4 weeks to index and start ranking.' });
  }

  return recs.sort((a, b) => b.priority - a.priority);
}
