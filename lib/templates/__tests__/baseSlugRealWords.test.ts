/**
 * base_slug_of() must not eat real words.
 *
 * The DB function is the source of truth; this mirrors its rule so the allowlist cannot be
 * edited in the migration without a test that says what the allowlist is FOR. Three kinds of
 * trailing token look identical to a regex and are not the same thing:
 *
 *   random suffix   `renton-plumbing-a4f2k`  -> strip   (Math.random().toString(36).slice(2,7))
 *   real word       `malden-hvac`            -> KEEP    (it is the industry, not a suffix)
 *   variant marker  `crafted-connections-demo` -> strip (it really is a variant of that template)
 */

const ALLOW = ['hvac', 'glass', 'goods', 'decks', 'epoxy', 'fence', 'salon', 'turf', 'walls'];

/** Mirrors public.base_slug_of as of migration 20260834. */
function baseSlugOf(slug: string): string {
  const m = /-([a-z0-9]{4,5})$/.exec(slug || '');
  if (m && ALLOW.includes(m[1])) return slug || '';
  return (slug || '').replace(/-[a-z0-9]{4,5}$/, '');
}

/** The trigger's rule: a slug that differs from its base is a version. */
const isVersion = (slug: string) => slug !== baseSlugOf(slug);

describe('base_slug_of', () => {
  it('keeps a real industry word, so the row stays canonical', () => {
    expect(baseSlugOf('malden-hvac')).toBe('malden-hvac');
    expect(isVersion('malden-hvac')).toBe(false);
    expect(baseSlugOf('boston-auto-glass')).toBe('boston-auto-glass');
    expect(baseSlugOf('renton-turf')).toBe('renton-turf');
  });

  it('still strips a random suffix, which is what it exists for', () => {
    // Shape produced by Math.random().toString(36).slice(2, 7).
    for (const s of ['renton-plumbing-a4f2k', 'lynn-towing-ghq2', 'selah-towing-9hg3']) {
      expect(baseSlugOf(s)).not.toBe(s);
      expect(isVersion(s)).toBe(true);
    }
  });

  it('still strips -demo, because that IS a variant of another template', () => {
    // Deliberately not allowlisted: every <name>-demo row shares its template_name with an
    // existing canonical, and templates_template_name_canonical_uniq rejects a second one.
    expect(baseSlugOf('crafted-connections-demo')).toBe('crafted-connections');
    expect(isVersion('crafted-connections-demo')).toBe(true);
  });

  it('leaves longer industry words alone, as it always did', () => {
    for (const s of ['renton-towing', 'boston-plumbing', 'chelsea-roofing', 'milton-contractor']) {
      expect(baseSlugOf(s)).toBe(s);
    }
  });

  it('handles an empty or suffix-less slug without throwing', () => {
    expect(baseSlugOf('')).toBe('');
    expect(baseSlugOf('renton')).toBe('renton');
  });

  it('strips at most one token', () => {
    // `-a4f2k-b9x1` must lose only the last: two strips would merge unrelated families.
    expect(baseSlugOf('renton-plumbing-a4f2k-b9x1')).toBe('renton-plumbing-a4f2k');
  });
});
