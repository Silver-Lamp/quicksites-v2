// lib/admin/userIdentity.ts
//
// Who is this account, in words a person can read? /admin/users rendered `user_metadata.name`
// and nothing else, so most rows showed "—": only sign-ups that typed a name have it, and every
// guest-upgraded account, OAuth account and partner join leaves it empty. Meanwhile the same row
// often carried a profile name, a merchant display name, or a site whose business name IS the
// person's business. Pure, so the fallback order is tested and the source is stated on the row —
// a name lifted from a site is a guess about a person and must be labelled as one.

export type IdentityInputs = {
  authEmail?: string | null;
  metaName?: string | null;
  metaFullName?: string | null;
  profileName?: string | null;
  profileEmail?: string | null;
  merchantName?: string | null;
  chefName?: string | null;
  /** Business name of the user's most recently edited site, if any. */
  siteBusinessName?: string | null;
};

export type IdentitySource = 'account' | 'profile' | 'merchant' | 'chef' | 'site' | null;

export type ResolvedIdentity = {
  name: string | null;
  /** Where the name came from — `site` means "the business name on their newest site", a guess. */
  name_source: IdentitySource;
  email: string | null;
  email_source: 'account' | 'profile' | null;
};

const clean = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.trim().replace(/\s+/g, ' ');
  return s.length >= 2 ? s : null;
};

export function resolveUserIdentity(i: IdentityInputs): ResolvedIdentity {
  const chain: Array<[IdentitySource, string | null]> = [
    ['account', clean(i.metaName) ?? clean(i.metaFullName)],
    ['profile', clean(i.profileName)],
    ['merchant', clean(i.merchantName)],
    ['chef', clean(i.chefName)],
    ['site', clean(i.siteBusinessName)],
  ];
  const hit = chain.find(([, v]) => !!v) ?? null;
  const authEmail = clean(i.authEmail)?.toLowerCase() ?? null;
  const profileEmail = clean(i.profileEmail)?.toLowerCase() ?? null;
  return {
    name: hit ? hit[1] : null,
    name_source: hit ? hit[0] : null,
    email: authEmail ?? profileEmail,
    email_source: authEmail ? 'account' : profileEmail ? 'profile' : null,
  };
}
