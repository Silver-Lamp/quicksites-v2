export function slugify(s: string) {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 80);
}

export async function ensureUniqueBatchSlugs(titles: string[], exists: Set<string>) {
  const slugs: string[] = [];
  const used = new Set<string>(exists);
  for (const t of titles) {
    let base = slugify(t) || 'item';
    let candidate = base;
    let i = 2;
    while (used.has(candidate)) candidate = `${base}-${i++}`;
    used.add(candidate);
    slugs.push(candidate);
  }
  return slugs;
}
