import { z } from 'zod';
import { BlockSchema, migrateLegacyBlock } from '@/admin/lib/zod/blockSchema';
import { canonicalizeUrlKeysDeep } from '@/admin/lib/migrations/canonicalizeUrls';
import type { Block } from '@/types/blocks';

/* ───────────────────────── helpers ───────────────────────── */

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

/** props → content (legacy + nested-unwrap) */
function propsToContent(block: any): any {
  if (!block || typeof block !== 'object' || !('props' in block)) return block;

  const { props, ...rest } = block as any;

  // If block already has content, only fix obvious nested wrapper cases.
  // Prefer props.content when present; otherwise treat props itself as content.
  const propsContent =
    props && typeof props === 'object' && props.content && typeof props.content === 'object'
      ? props.content
      : props;

  if (!('content' in block) || block.content == null) {
    return { ...rest, content: propsContent };
  }

  // If content exists but is empty or clearly the wrong wrapper, merge/replace safely.
  if (
    block.content == null ||
    (typeof block.content === 'object' && Object.keys(block.content).length === 0) ||
    (block.content && typeof block.content === 'object' && 'content' in block.content)
  ) {
    return { ...rest, content: propsContent };
  }

  return block;
}

function isLikelyValidBlockShape(b: any): b is { type: string; content: Record<string, any> } {
  return (
    b &&
    typeof b === 'object' &&
    typeof b.type === 'string' &&
    typeof b.content === 'object' &&
    b.content !== null
  );
}

/** Per-type harmonization before Zod parse */
function harmonizeContentByType(type: string, c0: Record<string, any> | undefined) {
  const c = { ...(c0 ?? {}) };

  // header aliases
  if (type === 'header') {
    if ('logoUrl' in c && !('logo_url' in c)) c.logo_url = (c as any).logoUrl;
    if ('navItems' in c && !('nav_items' in c)) c.nav_items = (c as any).navItems;
    if ('url' in c && !('logo_url' in c)) c.logo_url = (c as any).url;
    if ('links' in c && !('nav_items' in c)) c.nav_items = (c as any).links;
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
      (c as any).format = (c as any).format ?? 'html';
    }
  }

  // HERO: map legacy keys to schema fields
  if (type === 'hero') {
    if ('heading' in c && !('headline' in c)) c.headline = (c as any).heading;
    if ('subheading' in c && !('subheadline' in c)) c.subheadline = (c as any).subheading;
    if ('ctaLabel' in c && !('cta_text' in c)) c.cta_text = (c as any).ctaLabel;
    if ('ctaHref' in c && !('cta_link' in c)) c.cta_link = (c as any).ctaHref;
    if ('heroImage' in c && !('image_url' in c)) c.image_url = (c as any).heroImage;

    if ('imagePosition' in c && !('image_position' in c)) c.image_position = (c as any).imagePosition;
    if ('layoutMode' in c && !('layout_mode' in c)) c.layout_mode = (c as any).layoutMode;

    delete (c as any).heading;
    delete (c as any).subheading;
    delete (c as any).ctaLabel;
    delete (c as any).ctaHref;
    delete (c as any).heroImage;
    delete (c as any).imagePosition;
    delete (c as any).layoutMode;
  }

  return c;
}

/* ───────────────────────── main ───────────────────────── */

export function normalizeBlock(block: Partial<Block>): z.infer<typeof BlockSchema> {
  // 1) ensure id and migrate legacy shapes
  let candidate: any = migrateLegacyBlock({ ...block, _id: ensureId(block?._id) });

  // 2) alias type + props→content early (and unwrap nested props.content)
  candidate = propsToContent(candidate);
  candidate.content ??= {};
  candidate.type = String(candidate.type || '').trim();

  // 3) canonicalize url keys deeply before per-type tweaks
  candidate = canonicalizeUrlKeysDeep(candidate);

  // 4) per-type harmonization (maps legacy hero fields, etc.)
  candidate = { ...candidate, content: harmonizeContentByType(candidate.type, candidate.content) };

  // 5) special: hero safe defaults to pass Zod even if AI/hydration is off
  if (candidate.type === 'hero') {
    const c = (candidate.content ??= {});
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
                ? `${(item as any).question} — ${(item as any).answer}`
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
    try {
      console.table(rows);
    } catch {
      console.log(rows);
    }
    console.groupEnd();
    throw new Error(`Invalid block: ${String(block?.type)}`);
  }

  return result.data;
}
