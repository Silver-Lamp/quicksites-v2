// lib/seo/coach/types.ts
//
// Shared types for the AI SEO Coaching engine. Pure — no I/O, no imports beyond
// the sibling recSummary step shape we reuse for the LLM output. See
// docs/AI_SEO_COACHING.md.

import type { RecStep, RecSummary } from '@/lib/outreach/recSummary';

export type { RecStep, RecSummary };

/** Owner-lens on-page signals (superset of the geo OnPageSignals, meta/content aware). */
export type SiteOnPageSignals = {
  pageCount: number;
  hasSchema: boolean;
  hasTitle: boolean;
  titleLen: number;
  hasDescription: boolean;
  descLen: number;
  wordCount: number;
  thinContent: boolean;
  hasH1: boolean;
  imagesMissingAlt: number;
};

/** 28-day Search Console rollup for a site's domain (null when not connected). */
export type GscSiteSummary = {
  clicks: number;
  impressions: number;
  position: number; // avg
  ctr: number; // 0..1
};

export type SiteSeoSignals = {
  domain: string | null;
  gscConnected: boolean;
  onPage: SiteOnPageSignals;
  gsc: GscSiteSummary | null;
};

export type SeoRecCategory = 'meta' | 'schema' | 'content' | 'connectivity' | 'organic' | 'performance';

export type SeoRec = {
  id: string;
  category: SeoRecCategory;
  priority: number; // higher = act sooner
  title: string;
  detail: string;
};

export type SeoScore = {
  score: number; // 0..100
  breakdown: Record<string, number>;
};
