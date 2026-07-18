// lib/admin/designPartners.ts
//
// The design-partner outreach registry — the people the owner is personally recruiting to use /
// pilot / spread QuickSites (+ the sibling products), each with a warm /for-<name> page. A
// superadmin CRM-lite: fixed identity/context lives in code (DEFAULT_PARTNERS, versioned + honest),
// while mutable pipeline fields (status / next step / notes / last-nudged) persist in site_settings
// (service-role only, no migration). The goal is per-partner next-steps + forward-progress nudges.
//
// Sibling: HiveJournal builds the same superadmin page on its side (coordinated via crosstalk); the
// contacts are shared people, so keep the ids in sync (name slug).

import { getSiteSetting, setSiteSetting } from '@/lib/settings/siteSettings';

export type PartnerStatus = 'prospect' | 'contacted' | 'engaged' | 'active' | 'paused';
export const PARTNER_STATUSES: PartnerStatus[] = [
  'prospect',
  'contacted',
  'engaged',
  'active',
  'paused',
];

export type DesignPartner = {
  id: string; // slug, matches the /for-<id> page
  name: string;
  forPage: string; // e.g. '/for-daniel'
  role: string;
  company?: string;
  blurb: string;
  email?: string;
  phone?: string;
  referralCode?: string;
  links?: { label: string; href: string }[];
  // Mutable pipeline fields (persisted as overrides):
  status: PartnerStatus;
  nextStep?: string;
  nextStepDue?: string; // ISO date
  notes?: string;
  lastNudgedAt?: string; // ISO
};

/** Fields the operator can edit (everything else is fixed identity/context from code). */
export const MUTABLE_FIELDS = [
  'status',
  'nextStep',
  'nextStepDue',
  'notes',
  'lastNudgedAt',
] as const;
type MutablePatch = Partial<Pick<DesignPartner, (typeof MUTABLE_FIELDS)[number]>>;

const SETTINGS_KEY = 'design_partners';

/** The known contacts + their /for-<name> pages. Identity/context is code-owned + honest. */
export const DEFAULT_PARTNERS: DesignPartner[] = [
  {
    id: 'daniel',
    name: 'Daniel',
    forPage: '/for-daniel',
    role: 'Majority owner',
    company: 'DeckSketch',
    blurb:
      'Owns DeckSketch (deck design + estimating). Co-developing the QS↔DeckSketch estimator seam (9 trades live) and the referral setup. The deepest partnership of the three.',
    referralCode: 'daniel',
    status: 'engaged',
    nextStep:
      'Get his read on the two open calls: non-deck trades as a real product surface, and installed-vs-materials pricing default.',
  },
  {
    id: 'ryan',
    name: 'Ryan',
    forPage: '/for-ryan',
    role: 'Realtor',
    blurb:
      'A working realtor with likely MLS IDX access — the target IDX pilot / design partner (his feed unlocks the shipped IDX Phase-1 scaffold) plus a referral partner.',
    referralCode: 'ryan',
    status: 'contacted',
    nextStep:
      'Confirm which MLS he’s in + whether he’ll be the IDX pilot; offer to stand up his agent site + a live About That demo.',
  },
  {
    id: 'daryle',
    name: 'Daryle',
    forPage: '/for-daryle',
    role: 'Payments / ISO',
    company: 'Expitrans',
    blurb:
      'Payments-side partner — knows ISOs / merchant-services processors who could white-label QuickSites with transactions on their own rails (Stripe-swap is architected for it).',
    status: 'prospect',
    nextStep:
      'Line up an intro to an ISO/processor for the white-label pitch; confirm his network + terms.',
  },
];

/** List all design partners: code defaults merged with the persisted mutable overrides + any custom adds. */
export async function listDesignPartners(): Promise<DesignPartner[]> {
  const store = await getSiteSetting<{
    overrides?: Record<string, MutablePatch>;
    custom?: DesignPartner[];
  }>(SETTINGS_KEY, {});
  const overrides = store.overrides ?? {};
  const base = DEFAULT_PARTNERS.map((p) => ({ ...p, ...(overrides[p.id] ?? {}) }));
  const custom = (store.custom ?? []).map((p) => ({ ...p, ...(overrides[p.id] ?? {}) }));
  return [...base, ...custom];
}

/** Patch a partner's mutable pipeline fields (persists to site_settings). */
export async function updateDesignPartner(
  id: string,
  patch: MutablePatch,
  actor?: string | null
): Promise<void> {
  const store = await getSiteSetting<{
    overrides?: Record<string, MutablePatch>;
    custom?: DesignPartner[];
  }>(SETTINGS_KEY, {});
  const overrides = { ...(store.overrides ?? {}) };
  const clean: MutablePatch = {};
  for (const k of MUTABLE_FIELDS) if (k in patch) (clean as any)[k] = (patch as any)[k];
  overrides[id] = { ...(overrides[id] ?? {}), ...clean };
  await setSiteSetting(SETTINGS_KEY, { ...store, overrides }, actor ?? null);
}

/** Add a custom (non-/for-page) contact to the registry. */
export async function addCustomPartner(
  partner: DesignPartner,
  actor?: string | null
): Promise<void> {
  const store = await getSiteSetting<{
    overrides?: Record<string, MutablePatch>;
    custom?: DesignPartner[];
  }>(SETTINGS_KEY, {});
  const custom = (store.custom ?? []).filter((p) => p.id !== partner.id);
  custom.push(partner);
  await setSiteSetting(SETTINGS_KEY, { ...store, custom }, actor ?? null);
}
