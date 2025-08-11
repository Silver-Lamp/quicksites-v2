// lib/migrations/canonicalizeUrls.ts
type AnyRec = Record<string, any>;

const URL_KEY_ALIASES: Record<string, string> = {
  imageUrl: 'image_url',
  avatarUrl: 'avatar_url',
  logoUrl:  'logo_url',
  // header-specific
  navItems: 'nav_items',
  links:    'nav_items', // accept legacy header.links
};

/** Recursively map legacy camelCase url-ish keys to snake_case. */
export function canonicalizeUrlKeysDeep<T = unknown>(input: T): T {
  if (Array.isArray(input)) {
    return input.map(canonicalizeUrlKeysDeep) as unknown as T;
  }
  if (input && typeof input === 'object') {
    const out: AnyRec = {};
    for (const [k, v] of Object.entries(input as AnyRec)) {
      const nextV = canonicalizeUrlKeysDeep(v);
      const mapped = URL_KEY_ALIASES[k] ?? k;

      // merge arrays for header links → nav_items
      if (mapped in out && Array.isArray(out[mapped]) && Array.isArray(nextV)) {
        out[mapped] = [...out[mapped], ...nextV];
      } else if (!(mapped in out)) {
        out[mapped] = nextV;
      } else {
        out[mapped] = nextV; // last write wins (simple case)
      }
    }
    return out as T;
  }
  return input;
}
