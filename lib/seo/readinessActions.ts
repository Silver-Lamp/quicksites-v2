// lib/seo/readinessActions.ts
//
// THE middle connector for one-click "fix this readiness item" actions. Each auto-fixable
// checklist item (lib/outreach/readiness.ts) maps to exactly one action declared HERE — its
// list endpoint, button label + icon, gating, and how to turn a result payload into a toast.
//
// Two surfaces consume this registry so there's one source of truth (no drifting maps):
//   • lib/outreach/readiness.ts#buildNextStep — attaches the action key to a row's next step
//   • components/admin/templates/next-step-button.tsx — runs it from the list card/table
//
// Adding a new one-click fix = one entry here (+ its {templateId} endpoint). Keep this module
// pure data (no React/lucide imports) — readiness.ts is server-pure and imports it.

/** Action keys the list can execute in place. (readiness.ts re-exports this as NextStepAction.) */
export type ReadinessActionKey = 'generate_city_page' | 'fill_office_address' | 'fill_local_business_schema';

/** Icon name resolved to a lucide component in the client (kept a string so this stays pure). */
export type ReadinessActionIcon = 'sparkles' | 'factory' | 'shield';

export type ReadinessActionDef = {
  key: ReadinessActionKey;
  /** The checklist item id this action satisfies. */
  itemId: string;
  /** POST endpoint accepting { templateId }; validates + performs the fix, returns { changed, reason? }. */
  endpoint: string;
  /** Button label + icon for the list next-step. */
  label: string;
  icon: ReadinessActionIcon;
  /** Hover title for the list button. */
  title: string;
  /** The action needs the row to be a geo pitch site (has a campaign). */
  requiresGeoSite: boolean;
  /** Only offer for industries where this makes sense (default: all). */
  appliesToIndustry?: (industryKey: string) => boolean;
  /** Turn a result payload into a toast (ok=false renders as an error toast). */
  result: (j: any) => { ok: boolean; text: string };
};

// Industrial-park addresses don't fit food sites; LocalBusiness schema fits everyone.
const FOOD = new Set(['restaurant']);

export const READINESS_ACTIONS: ReadinessActionDef[] = [
  {
    key: 'generate_city_page',
    itemId: 'pages',
    endpoint: '/api/admin/prospects/geo-campaign/add-city-page',
    label: 'Generate a page',
    icon: 'sparkles',
    title: 'Generate a "<service> in <city>" landing page that links back to the home page',
    requiresGeoSite: true,
    result: (j) =>
      j?.changed === false
        ? { ok: true, text: j?.reason === 'already_exists' ? 'A city/service page already exists.' : 'No change.' }
        : { ok: true, text: `Added /${j?.slug ?? 'page'}` },
  },
  {
    key: 'fill_office_address',
    itemId: 'nap',
    endpoint: '/api/admin/templates/fill-park-address',
    label: 'Use a park address',
    icon: 'factory',
    title: 'Fill a real industrial-park address (discovers parks automatically) and save — no editor trip',
    requiresGeoSite: true,
    appliesToIndustry: (k) => !FOOD.has(k),
    result: (j) => {
      if (j?.changed) return { ok: true, text: j?.parkName ? `Address filled from ${j.parkName}` : 'Office address filled' };
      if (j?.reason === 'no_parks') return { ok: false, text: `No industrial parks found near ${j?.city ?? 'this city'} — try the editor.` };
      if (j?.reason === 'no_city') return { ok: false, text: 'No city on this site yet — set one in the editor first.' };
      if (j?.reason === 'not_applicable') return { ok: false, text: 'Industrial-park addresses don’t fit this site type.' };
      if (j?.reason === 'disabled') return { ok: false, text: 'The industrial-park registry is turned off.' };
      return { ok: true, text: 'No change.' };
    },
  },
  {
    key: 'fill_local_business_schema',
    itemId: 'schema',
    endpoint: '/api/admin/templates/fill-local-business-schema',
    label: 'Add schema',
    icon: 'shield',
    title: 'Emit LocalBusiness structured data from this site’s name, address & phone',
    requiresGeoSite: true,
    result: (j) => {
      if (j?.changed) return { ok: true, text: j?.type ? `LocalBusiness schema added (${j.type})` : 'LocalBusiness schema added' };
      if (j?.reason === 'insufficient') return { ok: false, text: 'Add a business name + city or address first, then add schema.' };
      if (j?.reason === 'already') return { ok: true, text: 'LocalBusiness schema is already on.' };
      return { ok: true, text: 'No change.' };
    },
  },
];

const BY_KEY: Record<string, ReadinessActionDef> = Object.fromEntries(READINESS_ACTIONS.map((a) => [a.key, a]));
const BY_ITEM: Record<string, ReadinessActionDef> = Object.fromEntries(READINESS_ACTIONS.map((a) => [a.itemId, a]));

/** The action for a checklist item, if one applies to this industry (else null → deep link). */
export function readinessActionForItem(itemId: string, industryKey?: string): ReadinessActionDef | null {
  const def = BY_ITEM[itemId];
  if (!def) return null;
  if (def.appliesToIndustry && industryKey != null && !def.appliesToIndustry(industryKey)) return null;
  return def;
}

/** Look up an action definition by its key. */
export function readinessActionByKey(key: string | null | undefined): ReadinessActionDef | null {
  return key ? BY_KEY[key] ?? null : null;
}
