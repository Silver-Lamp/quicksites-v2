export function computeSlug(site: any): string | null {
  if (!site) return null;

  const fromVanity = site.vanity_url?.trim().toLowerCase();
  if (fromVanity) return sanitizeSlug(fromVanity);

  const fromSlug = site.slug?.trim().toLowerCase();
  if (fromSlug) return sanitizeSlug(fromSlug);

  const fromDomain = site.domain
    ?.trim()
    .toLowerCase()
    .replace('.com', '')
    .replace(/\./g, '-');
  if (fromDomain) return sanitizeSlug(fromDomain);

  const fromBiz = site.business_name
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  if (fromBiz) return sanitizeSlug(fromBiz);

  return null;
}

function sanitizeSlug(slug: string): string {
  return slug
    .replace(/[^a-z0-9-]+/g, '-') // replace non-alphanumeric with dashes
    .replace(/^-+|-+$/g, '') // trim leading/trailing dashes
    .replace(/--+/g, '-'); // collapse multiple dashes
}
