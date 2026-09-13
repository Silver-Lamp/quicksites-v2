// lib/admin/guestFunnel.ts
//
// The guest-build funnel, as numbers: how many people built a site as a guest, how many invested
// real time, how many came back, how many even started to sign up, how many converted.
//
// ⚠️ On 2026-09-13 this read 16 builders · 47 sites · 7 edited 10+ min · 0 returned · 0 started
// sign-up · 0 converted, since July. That is a PATH problem, not a demand problem (the Publish
// button called an admin-only route and showed "Failed to publish"; the sign-up banner scrolled
// out of view; the confirmation email landed on the homepage). See docs/GUEST_SIGNUP_PLAN.md.
// This surfaces the number so the fix is measured, not remembered.
//
// Pure: `computeGuestFunnel` takes rows; `loadGuestFunnel` (server) fetches them.

export type GuestUserRow = {
  id: string;
  created_at: string;
  last_sign_in_at?: string | null;
  /** Supabase sets `new_email` while an email upgrade awaits confirmation. */
  new_email?: string | null;
  is_anonymous?: boolean | null;
};

export type GuestTemplateRow = {
  id: string;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
  claim_source?: string | null;
  /** `data.meta.rebuilt_from` — the person's real website, when they built from a URL. */
  rebuilt_from?: string | null;
  /** Whether the site carries a phone or non-placeholder email (see guestContacts.ts). */
  has_contact?: boolean;
};

export type GuestFunnel = {
  /** Anonymous auth users (guest sessions). */
  guests: number;
  /** Templates stamped claim_source='guest_build' (any owner). */
  sites: number;
  /** Distinct builders: anonymous owners + converted owners of guest sites. */
  builders: number;
  /** Guests with at least one site edited ≥10 minutes after creation. */
  editedTenMinPlus: number;
  /** Guests whose last sign-in is > 1h after the session was created. */
  returned: number;
  /** Guests with an email upgrade pending confirmation. */
  startedSignup: number;
  /** Guest-built sites whose owner is no longer anonymous. */
  converted: number;
  /** Guest sites built from a URL — a real website we could contact. */
  withSourceUrl: number;
  /** Guest sites carrying a phone or a real (non-placeholder) email. */
  withContact: number;
  /** ISO of the newest guest site. */
  newestSiteAt: string | null;
};

const ms = (s?: string | null) => (s ? new Date(s).getTime() || 0 : 0);
export const ENGAGED_EDIT_MINUTES = 10;

export function computeGuestFunnel(guests: GuestUserRow[], templates: GuestTemplateRow[]): GuestFunnel {
  const guestIds = new Set(guests.filter((g) => g.is_anonymous !== false).map((g) => g.id));
  const guestSites = templates.filter((t) => t.claim_source === 'guest_build');
  const byOwner = new Map<string, GuestTemplateRow[]>();
  for (const t of guestSites) {
    if (!t.owner_id) continue;
    byOwner.set(t.owner_id, [...(byOwner.get(t.owner_id) ?? []), t]);
  }
  let editedTenMinPlus = 0;
  for (const id of guestIds) {
    const sites = byOwner.get(id) ?? [];
    if (sites.some((t) => ms(t.updated_at) - ms(t.created_at) >= ENGAGED_EDIT_MINUTES * 60_000)) editedTenMinPlus++;
  }
  const returned = guests.filter((g) => guestIds.has(g.id) && ms(g.last_sign_in_at) > ms(g.created_at) + 3600_000).length;
  const startedSignup = guests.filter((g) => guestIds.has(g.id) && !!g.new_email).length;
  const converted = guestSites.filter((t) => t.owner_id && !guestIds.has(t.owner_id)).length;
  const newest = guestSites.reduce<string | null>((acc, t) => (!acc || t.created_at > acc ? t.created_at : acc), null);
  return {
    guests: guestIds.size,
    sites: guestSites.length,
    builders: byOwner.size,
    editedTenMinPlus,
    returned,
    startedSignup,
    converted,
    withSourceUrl: guestSites.filter((t) => !!t.rebuilt_from).length,
    withContact: guestSites.filter((t) => !!t.has_contact).length,
    newestSiteAt: newest,
  };
}

export const EMPTY_GUEST_FUNNEL: GuestFunnel = {
  guests: 0, sites: 0, builders: 0, editedTenMinPlus: 0, returned: 0, startedSignup: 0, converted: 0, withSourceUrl: 0, withContact: 0, newestSiteAt: null,
};
