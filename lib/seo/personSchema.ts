// lib/seo/personSchema.ts
//
// schema.org/Person for portfolio and résumé sites — the entity block that tells a search engine
// "this page, that LinkedIn, that GitHub and that domain are all one human".
//
// ⚠️ WHY THIS IS THE HIGH-LEVERAGE PIECE AND NOBODY WRITES IT BY HAND. Ranking for your own name
// is not a content problem, it is an identity problem: a search engine sees a dozen pages
// mentioning the same name and has to decide whether they are one person or several. `sameAs` is
// the answer to that question, in a format it reads directly. The people who most need it — a
// contractor, a job seeker, anyone publishing a Verbatim résumé — are precisely the people who
// will never write JSON-LD.
//
// ⚠️ IT ASSERTS ONLY WHAT THE OWNER SUPPLIED. Every field here comes from their own site content
// or a URL they typed. Nothing is inferred, and an absent field is omitted rather than guessed —
// a `jobTitle` we invented would be a claim about a person's employment, which is exactly what the
// Verbatim parser refuses to do (see lib/rebuild/importResume.ts). Same rule, one layer up.
//
// ⚠️ AND `sameAs` IS A CLAIM OF OWNERSHIP. Listing a profile says "this is the same person". A URL
// the owner did not supply must never appear here — putting a stranger's GitHub in someone's
// `sameAs` is an assertion about two people at once. Callers pass only what the owner entered.

export type PersonIdentity = {
  name: string;
  /** Their words, not ours. */
  jobTitle?: string | null;
  description?: string | null;
  /** Employer/own studio, if they said one. */
  worksFor?: string | null;
  email?: string | null;
  /** City/region as they wrote it. */
  location?: string | null;
  /** Profile URLs the OWNER supplied. See the header. */
  sameAs?: string[];
  /** The canonical home for this person — usually their own domain. */
  url?: string | null;
};

/** A URL we are willing to publish as an identity claim. */
export function isPublishableProfileUrl(u: unknown): u is string {
  if (typeof u !== 'string') return false;
  const t = u.trim();
  if (!/^https?:\/\//i.test(t)) return false;
  try {
    const parsed = new URL(t);
    // A bare localhost or an IP is not a public identity.
    return !!parsed.hostname && parsed.hostname.includes('.') && !/^\d+\.\d+\.\d+\.\d+$/.test(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Pull a Person identity out of a template's own data.
 *
 * Reads what the personal/author scaffolds and Verbatim already store, so an existing site gains
 * the schema without the owner re-entering anything they have already typed.
 */
export function personIdentityFromTemplate(data: any, opts: { url?: string } = {}): PersonIdentity | null {
  const meta = data?.meta ?? {};
  const identity = meta.identity ?? {};
  const name =
    (typeof identity.person_name === 'string' && identity.person_name.trim()) ||
    (typeof meta.person_name === 'string' && meta.person_name.trim()) ||
    (typeof data?.business_name === 'string' && data.business_name.trim()) ||
    '';
  if (!name) return null;

  const sameAs = [
    ...(Array.isArray(meta.person?.sameAs) ? meta.person.sameAs : []),
    ...(Array.isArray(meta.links) ? meta.links.map((l: any) => (typeof l === 'string' ? l : l?.href)) : []),
  ]
    .filter(isPublishableProfileUrl)
    // De-dupe without reordering: the owner's ordering is a preference, not noise.
    .filter((u, i, arr) => arr.indexOf(u) === i);

  return {
    name,
    jobTitle: meta.person?.jobTitle ?? identity.headline ?? null,
    description: meta.about ?? identity.bio ?? null,
    worksFor: meta.person?.worksFor ?? null,
    email: identity.email ?? meta.contact?.email ?? null,
    location: identity.location ?? meta.contact?.city ?? null,
    sameAs,
    url: meta.person?.canonicalUrl ?? opts.url ?? null,
  };
}

/**
 * Build the JSON-LD.
 *
 * ⚠️ EMPTY FIELDS ARE OMITTED, NOT EMITTED AS EMPTY. A `"jobTitle": ""` is a malformed claim, and
 * structured data is read by machines that do not extend the benefit of the doubt.
 */
export function buildPersonSchema(id: PersonIdentity): Record<string, unknown> | null {
  if (!id.name?.trim()) return null;

  const out: Record<string, unknown> = { '@context': 'https://schema.org', '@type': 'Person', name: id.name.trim() };
  if (id.jobTitle?.trim()) out.jobTitle = id.jobTitle.trim();
  if (id.description?.trim()) out.description = id.description.trim();
  if (id.worksFor?.trim()) out.worksFor = { '@type': 'Organization', name: id.worksFor.trim() };
  if (id.email?.trim()) out.email = id.email.trim();
  if (id.location?.trim()) out.address = { '@type': 'PostalAddress', addressLocality: id.location.trim() };
  if (id.url && isPublishableProfileUrl(id.url)) out.url = id.url;

  const sameAs = (id.sameAs ?? []).filter(isPublishableProfileUrl);
  if (sameAs.length) out.sameAs = sameAs;

  return out;
}

/**
 * Should this site emit a Person block?
 *
 * ⚠️ ONLY FOR SITES THAT ARE ABOUT A PERSON. A Person block on a restaurant's page tells a search
 * engine the restaurant is a human, which is worse than emitting nothing — structured data that
 * contradicts the page is a reason to distrust all of it.
 */
export function personSchemaEnabled(data: any, industry?: string | null): boolean {
  if (data?.meta?.person?.enabled === false) return false;
  if (data?.meta?.person?.enabled === true) return true;
  return industry === 'personal' || industry === 'author';
}
