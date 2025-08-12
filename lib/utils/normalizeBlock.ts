// lib/utils/normalizeBlock.ts
import { z } from 'zod';
import {
  BlockSchema,
  migrateLegacyBlock,
} from '@/admin/lib/zod/blockSchema';
import { canonicalizeUrlKeysDeep } from '@/admin/lib/migrations/canonicalizeUrls';
import type { Block } from '@/types/blocks';

// Grab a nested value for error logs: ["content","items",0,"content","value"]
function getAtPath(obj: unknown, path: (string | number)[]) {
  try {
    let cur: any = obj;
    for (const seg of path) {
      const key =
        typeof seg === 'number' ? seg : /^\d+$/.test(String(seg)) ? Number(seg) : seg;
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
    if (vals.length && vals.every((v) => typeof v === 'string')) {
      return (vals as string[]).join('');
    }
  }
  return crypto.randomUUID();
}

// Minimal guard for obvious shape problems
function isLikelyValidBlockShape(
  block: any
): block is { type: string; content: Record<string, any> } {
  return (
    block &&
    typeof block === 'object' &&
    typeof block.type === 'string' &&
    block.type.length > 0 &&
    typeof block.content === 'object' &&
    block.content !== null
  );
}

/** Per-type content harmonization (runs before zod parse) */
function harmonizeContentByType(
  type: string,
  content: Record<string, any> | undefined
): Record<string, any> {
  const c = { ...(content ?? {}) };

  // Accept common camelCase → snake_case drift (already handled by canonicalizeUrlKeysDeep,
  // but keep a few explicit ones for safety).
  if ('imageUrl' in c && !('image_url' in c)) c.image_url = c.imageUrl;
  if ('avatarUrl' in c && !('avatar_url' in c)) c.avatar_url = c.avatarUrl;

  // Header: support legacy/editor variants
  if (type === 'header') {
    if ('logoUrl' in c && !('logo_url' in c)) c.logo_url = c.logoUrl;
    if ('navItems' in c && !('nav_items' in c)) c.nav_items = c.navItems;

    // Some editors used url/links
    if ('url' in c && !('logo_url' in c)) c.logo_url = c.url;
    if ('links' in c && !('nav_items' in c)) c.nav_items = c.links;

    // Clean the aliases so schema stays tidy
    delete (c as any).logoUrl;
    delete (c as any).navItems;
    delete (c as any).url;
    delete (c as any).links;
  }

  // Testimonial item: avatarUrl -> avatar_url (redundant with canonicalize, harmless)
  if (type === 'testimonial' && Array.isArray(c.testimonials)) {
    c.testimonials = c.testimonials.map((t: any) => {
      const tt = { ...t };
      if ('avatarUrl' in tt && !('avatar_url' in tt)) tt.avatar_url = tt.avatarUrl;
      delete tt.avatarUrl;
      return tt;
    });
  }
  
  // Text block: value → html (backcompat)
  if (type === 'text') {
    if (typeof c.value === 'string' && !c.html && !c.json) {
      c.html = c.value;
      c.format = c.format ?? 'html';
    }
  }
  return c;
}

export function normalizeBlock(block: Partial<Block>): z.infer<typeof BlockSchema> {
  // 1) Ensure an _id, but otherwise keep the incoming object intact
  const withId: any = { ...block, _id: ensureId(block?._id) };

  // 2) Migrate any legacy shapes (e.g., chef_profile meal title->name, {value} → content)
  let candidate: any = migrateLegacyBlock(withId);

  if (candidate.type === 'footer') {
    const c: any = { ...(candidate.content ?? {}) };
  
    // Prefer canonical links; hoist legacy keys if needed
    if (!Array.isArray(c.links)) {
      c.links = Array.isArray(c.nav_items)
        ? c.nav_items
        : Array.isArray(c.navItems)
        ? c.navItems
        : [];
    }
    if (typeof c.logoUrl === 'string' && !c.logo_url) c.logo_url = c.logoUrl;
  
    delete c.nav_items;
    delete c.navItems;
    delete c.logoUrl;
  
    candidate = { ...candidate, content: c };
  }
  
  // 3) Early sanity check before we dive deeper
  if (!isLikelyValidBlockShape(candidate)) {
    console.warn('⚠️ Skipping malformed block:', JSON.stringify(candidate, null, 2));
    throw new Error(`Invalid block shape for type: ${String(block?.type)}`);
  }

  // 4) Canonicalize url-ish keys deeply (imageUrl → image_url, logoUrl → logo_url, etc.)
  candidate = canonicalizeUrlKeysDeep(candidate);

  // 5) Per-type harmonization for lingering aliases (header.url/links → logo_url/nav_items, etc.)
  candidate = {
    ...candidate,
    content: harmonizeContentByType(candidate.type, candidate.content),
  };

  // 6) Normalize grid items: they must be blocks. Try to normalize each; if it fails, wrap as text.
  if (candidate.type === 'grid') {
    const items = Array.isArray(candidate.content?.items) ? candidate.content.items : [];
    candidate = {
      ...candidate,
      content: {
        ...candidate.content,
        items: items.map((item: any) => {
          try {
            // recurse so nested grids, etc. are validated too
            return normalizeBlock(item as Partial<Block>);
          } catch {
            // Heuristic fallback: FAQ-style objects or strings → text block
            const value =
              typeof item === 'string'
                ? item
                : item && typeof item === 'object' && 'question' in item && 'answer' in item
                ? `${item.question} — ${item.answer}`
                : JSON.stringify(item ?? {});
            return {
              type: 'text',
              _id: crypto.randomUUID(),
              content: { value },
            };
          }
        }),
      },
    };
  }

  // Optional debug hooks
//   if (candidate.type === 'header') {
//     console.warn('🪵 HEADER BLOCK DEBUG', JSON.stringify(candidate, null, 2));
//   }
//   if (candidate.type === 'service_areas') {
//     console.warn('🪵 SERVICE AREAS BLOCK DEBUG', JSON.stringify(candidate, null, 2));
//   }

  // 7) Final validation
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
