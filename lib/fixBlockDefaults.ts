// lib/fixBlockDefaults.ts
import type { Block } from '@/types/blocks';
import { validateBlock } from '@/lib/blockRegistry.core';

function genId(): string {
  // Works in browser/edge/node
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g: any = globalThis as any;
  return g?.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

function ensureIds(b: any) {
  const id =
    (typeof b.id === 'string' && b.id) ||
    (typeof b._id === 'string' && b._id) ||
    genId();
  b.id = id;
  b._id = b._id ?? id; // keep legacy mirror
}

function moveToProps(b: any) {
  if (b && typeof b === 'object') {
    if (!('props' in b)) {
      if ('content' in b) {
        b.props = b.content;
        delete b.content;
      } else if ('value' in b) {
        b.props = b.value;
        delete b.value;
      } else {
        b.props = {};
      }
    }
  }
}

function normalizeHeroProps(p: any) {
  p.heading ??= p.headline ?? 'Welcome!';
  p.subheading ??= p.subheadline ?? '';
  p.ctaLabel ??= p.cta_text ?? '';
  p.ctaHref ??= p.cta_link ?? '#';
  p.heroImage ??= p.image_url ?? '';

  delete p.headline;
  delete p.subheadline;
  delete p.cta_text;
  delete p.cta_link;
  delete p.image_url;
  return p;
}

function normalizeServicesProps(p: any) {
  p.title ??= p.heading ?? 'Our Services';
  p.columns ??= Number.isFinite(p.columns) ? p.columns : 3;
  const items = Array.isArray(p.items) ? p.items : [];
  p.items = items.map((it: any) =>
    typeof it === 'string' ? { name: it } : it
  );
  delete p.heading;
  return p;
}

function normalizeCTAProps(p: any) {
  // keep label/link as the canonical cta props
  p.label ??= p.ctaLabel ?? 'Click Here';
  p.link ??= p.ctaHref ?? '#';
  return p;
}

function normalizeFooterProps(p: any) {
  p.links ??= [];
  p.businessName ??= 'Business';
  p.address ??= '123 Main St';
  p.cityState ??= 'City, ST';
  p.phone ??= '(555) 555-5555';
  return p;
}

function normalizeGridProps(p: any, fixer: (b: any) => Block) {
  p.columns ??= Number.isFinite(p.columns) ? p.columns : 2;
  if (Array.isArray(p.items)) {
    p.items = p.items.map((child: any) => fixer(child));
  }
  return p;
}

export function fixBlockDefaults(block: any): Block {
  const b = { ...(block ?? {}) };

  // Basic shape
  b.type = typeof b.type === 'string' && b.type ? b.type : 'text';
  moveToProps(b);
  ensureIds(b);

  // Legacy meta fields (harmless if unused)
  b.meta ??= {};
  b.tags ??= [];
  b.tone ??= b.tone ?? 'neutral';
  b.industry ??= b.industry ?? 'general';

  // Per-type normalization
  const p = (b.props ??= {});
  switch (b.type) {
    case 'hero':
      normalizeHeroProps(p);
      break;
    case 'services':
      normalizeServicesProps(p);
      break;
    case 'testimonial':
      p.quote ??= p.text ?? 'This is a testimonial';
      break;
    case 'cta':
      normalizeCTAProps(p);
      break;
    case 'footer':
      normalizeFooterProps(p);
      break;
    case 'grid':
      normalizeGridProps(p, fixBlockDefaults);
      break;
    default:
      // no-op
      break;
  }

  // Validate against canonical schema if available
  const v = validateBlock(b as Block);
  return v.ok ? (v.value as Block) : (b as Block);
}

export function fixPageBlocks(page: any) {
  const hasBlocks = Array.isArray(page?.blocks);
  const hasContentBlocks = Array.isArray(page?.content_blocks);

  if (hasBlocks) {
    page.blocks = page.blocks.map(fixBlockDefaults);
  } else if (hasContentBlocks) {
    page.content_blocks = page.content_blocks.map(fixBlockDefaults);
  } else {
    // create an empty array to be safe
    page.blocks = [];
  }
  return page;
}

export function fixTemplatePages(data: any) {
  const pages = Array.isArray(data?.pages) ? data.pages : [];
  data.pages = pages.map(fixPageBlocks);
  return data;
}
