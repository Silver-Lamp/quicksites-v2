import { z } from 'zod';
import { BlockSchema, migrateLegacyBlock } from '@/admin/lib/zod/blockSchema';
import { canonicalizeUrlKeysDeep } from '@/admin/lib/migrations/canonicalizeUrls';
import type { Block } from '@/types/blocks';

// Grab a nested value for error logs
function getAtPath(obj: unknown, path: (string | number)[]) {
  try {
    let cur: any = obj;
    for (const seg of path) {
      const key = typeof seg === 'number' ? seg : /^\d+$/.test(String(seg)) ? Number(seg) : seg;
      cur = cur?.[key];
    }
    return cur;
  } catch {
    return undefined;
  }
}

function ensureId(id: unknown): string {
  if (typeof id === 'string' && id.trim()) return id;
  if (id && typeof id === 'object') {
    const o = id as Record<string, unknown>;
    if (typeof o._id === 'string' && o._id.trim()) return o._id;
    const vals = Object.values(o);
    if (vals.length && vals.every((v) => typeof v === 'string')) return (vals as string[]).join('');
  }
  return crypto.randomUUID();
}

/** props → content (legacy) */
function propsToContent(block: any): any {
  if (block && typeof block === 'object' && 'props' in block && !('content' in block)) {
    const { props, ...rest } = block;
    return { ...rest, content: props };
  }
  return block;
}

function isLikelyValidBlockShape(b: any): b is { type: string; content: Record<string, any> } {
  return b && typeof b === 'object' && typeof b.type === 'string' && typeof b.content === 'object' && b.content !== null;
}

/** Per-type harmonization before Zod parse */
function harmonizeContentByType(type: string, c0: Record<string, any> | undefined) {
  const c = { ...(c0 ?? {}) };

  // header aliases
  if (type === 'header') {
    if ('logoUrl' in c && !('logo_url' in c)) c.logo_url = c.logoUrl;
    if ('navItems' in c && !('nav_items' in c)) c.nav_items = c.navItems;
    if ('url' in c && !('logo_url' in c)) c.logo_url = c.url;
    if ('links' in c && !('nav_items' in c)) c.nav_items = c.links;
    delete (c as any).logoUrl;
    delete (c as any).navItems;
    delete (c as any).url;
    delete (c as any).links;
  }

  // testimonial avatarUrl → avatar_url
  if (type === 'testimonial' && Array.isArray(c.testimonials)) {
    c.testimonials = c.testimonials.map((t: any) => {
      const tt = { ...t };
      if ('avatarUrl' in tt && !('avatar_url' in tt)) tt.avatar_url = tt.avatarUrl;
      delete tt.avatarUrl;
      return tt;
    });
  }

  // text: value → html
  if (type === 'text') {
    if (typeof (c as any).value === 'string' && !c.html && !c.json) {
      c.html = (c as any).value;
      c.format = c.format ?? 'html';
    }
  }

  // HERO: map legacy keys to schema fields
  if (type === 'hero') {
    if ('heading' in c && !('headline' in c)) c.headline = c.heading;
    if ('subheading' in c && !('subheadline' in c)) c.subheadline = c.subheading;
    if ('ctaLabel' in c && !('cta_text' in c)) c.cta_text = c.ctaLabel;
    if ('ctaHref' in c && !('cta_link' in c)) c.cta_link = c.ctaHref;
    if ('heroImage' in c && !('image_url' in c)) c.image_url = c.heroImage;

    // normalize some commonly seen variants
    if ('imagePosition' in c && !('image_position' in c)) c.image_position = c.imagePosition;
    if ('layoutMode' in c && !('layout_mode' in c)) c.layout_mode = c.layoutMode;

    // clean legacy keys
    delete c.heading;
    delete c.subheading;
    delete c.ctaLabel;
    delete c.ctaHref;
    delete c.heroImage;
    delete c.imagePosition;
    delete c.layoutMode;
  }

  return c;
}

export function normalizeBlock(block: Partial<Block>): z.infer<typeof BlockSchema> {
  // 1) ensure id and migrate legacy shapes
  let candidate: any = migrateLegacyBlock({ ...block, _id: ensureId(block?._id) });

  // 2) alias type + props→content early
  candidate = propsToContent(candidate);
  candidate.content ??= {};
  candidate.type = String(candidate.type || '').trim();

  // 3) canonicalize url keys deeply before per-type tweaks
  candidate = canonicalizeUrlKeysDeep(candidate);

  // 4) per-type harmonization (maps legacy hero fields, etc.)
  candidate = { ...candidate, content: harmonizeContentByType(candidate.type, candidate.content) };

  // 5) special: hero safe defaults to pass Zod even if AI/hydration is off
  if (candidate.type === 'hero') {
    const c = candidate.content ??= {};
    if (!c.headline) c.headline = 'Welcome';
    if (!('subheadline' in c)) c.subheadline = '';
    if (!('cta_text' in c)) c.cta_text = 'Get Started';
    if (!('cta_link' in c)) c.cta_link = '/contact';
    if (!c.layout_mode) c.layout_mode = 'inline';
    if (!c.image_position) c.image_position = 'center';
    if (typeof c.blur_amount !== 'number') c.blur_amount = 8;
    if (typeof c.parallax_enabled !== 'boolean') c.parallax_enabled = false;
    if (!c.mobile_layout_mode) c.mobile_layout_mode = 'inline';
    if (!c.mobile_crop_behavior) c.mobile_crop_behavior = 'cover';
  }

  // 6) normalize grid items: must be blocks; fallback to text on failure
  if (candidate.type === 'grid') {
    const items = Array.isArray(candidate.content?.items) ? candidate.content.items : [];
    candidate = {
      ...candidate,
      content: {
        ...candidate.content,
        items: items.map((item: any) => {
          try {
            return normalizeBlock(item as Partial<Block>);
          } catch {
            const value =
              typeof item === 'string'
                ? item
                : item && typeof item === 'object' && 'question' in item && 'answer' in item
                ? `${item.question} — ${item.answer}`
                : JSON.stringify(item ?? {});
            return { type: 'text', _id: crypto.randomUUID(), content: { value } };
          }
        }),
      },
    };
  }

  // 7) final sanity + Zod validation
  if (!isLikelyValidBlockShape(candidate)) {
    throw new Error(`Invalid block shape for type: ${String(block?.type)}`);
  }

  const result = BlockSchema.safeParse(candidate);
  if (!result.success) {
    const rows = result.error.errors.map((e) => ({
      path: e.path.join('.'),
      code: e.code,
      message: e.message,
      value: getAtPath(candidate, e.path),
    }));
    console.groupCollapsed(`❌ normalizeBlock: Invalid block "${String(block?.type)}"`);
    try { console.table(rows); } catch { console.log(rows); }
    console.groupEnd();
    throw new Error(`Invalid block: ${String(block?.type)}`);
  }

  return result.data;
}
