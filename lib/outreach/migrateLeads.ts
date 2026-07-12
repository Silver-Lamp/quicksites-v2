// lib/outreach/migrateLeads.ts
//
// Bring the legacy `leads` table into the canonical `outreach_prospects` model (the Growth
// unification). Legacy leads have no Google place_id, so each maps to a synthetic
// `place_id = lead:<id>` — which makes the migration idempotent (re-running skips rows
// already migrated, via upsertProspects' on-conflict-do-nothing) and traceable back to the
// source lead. `source='legacy_lead'` tags migrated rows. Dry-run reports without writing.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { upsertProspects, type ProspectInput } from '@/lib/outreach/prospects';

/** Normalize a lead's free-text industry into an industry_key slug (grouping key). */
function industryKeyFromLead(industry: string | null): string | null {
  const s = (industry ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return s || null;
}

type LeadRow = {
  id: string;
  business_name: string | null;
  phone: string | null;
  industry: string | null;
  address_city: string | null;
  address_state: string | null;
  address_street: string | null;
  address_zip: string | null;
  address_full: string | null;
  address_lat: number | null;
  address_lon: number | null;
  owner_id: string | null;
  status: string | null;
};

const LEAD_COLS =
  'id, business_name, phone, industry, address_city, address_state, address_street, address_zip, address_full, address_lat, address_lon, owner_id, status';

function composeAddress(l: LeadRow): string | null {
  if (l.address_full) return l.address_full;
  const stateZip = [l.address_state, l.address_zip].filter(Boolean).join(' ');
  const parts = [l.address_street, l.address_city, stateZip].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

/** Map one legacy lead to a prospect insert. Leads carry no website → 'no_website' tier. */
export function leadToProspect(l: LeadRow): ProspectInput {
  return {
    placeId: `lead:${l.id}`,
    businessName: (l.business_name || 'Unknown business').trim(),
    phone: l.phone || null,
    address: composeAddress(l),
    lat: l.address_lat ?? null,
    lon: l.address_lon ?? null,
    city: l.address_city || null,
    region: l.address_state || null,
    industryKey: industryKeyFromLead(l.industry),
    categories: l.industry ? [l.industry] : [],
    website: null,
    freshnessScore: null,
    leadTier: 'no_website',
    sweepId: null,
    discoveredBy: l.owner_id || null,
    source: 'legacy_lead',
  };
}

export type LeadMigrationPlan = {
  totalLeads: number;
  alreadyMigrated: number; // outreach_prospects already carrying a lead:* place_id
  toMigrate: number;
  withCoords: number;
  byIndustry: { industry: string; count: number }[];
  sample: { businessName: string; city: string | null; industryKey: string | null }[];
};

async function countMigrated(): Promise<number> {
  const { count } = await supabaseAdmin
    .from('outreach_prospects')
    .select('id', { count: 'exact', head: true })
    .like('place_id', 'lead:%');
  return count ?? 0;
}

/** Read the legacy leads, map them, and summarize what a migration would do. No writes. */
export async function planLeadMigration(limit = 10000): Promise<LeadMigrationPlan> {
  const { data, error } = await supabaseAdmin.from('leads').select(LEAD_COLS).limit(limit);
  if (error) throw new Error(`planLeadMigration: reading leads failed: ${error.message}`);
  const leads = (data as LeadRow[]) ?? [];
  const mapped = leads.map(leadToProspect);

  const byIndustryMap = new Map<string, number>();
  for (const p of mapped) byIndustryMap.set(p.industryKey ?? 'unknown', (byIndustryMap.get(p.industryKey ?? 'unknown') ?? 0) + 1);
  const byIndustry = [...byIndustryMap.entries()]
    .map(([industry, count]) => ({ industry, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  return {
    totalLeads: leads.length,
    alreadyMigrated: await countMigrated(),
    toMigrate: mapped.length, // upsert ignores dupes, so this is the ceiling
    withCoords: mapped.filter((p) => p.lat != null && p.lon != null).length,
    byIndustry,
    sample: mapped.slice(0, 8).map((p) => ({ businessName: p.businessName, city: p.city ?? null, industryKey: p.industryKey ?? null })),
  };
}

/** Execute the migration: upsert every legacy lead as a prospect (idempotent). Returns inserted count. */
export async function runLeadMigration(limit = 10000): Promise<{ scanned: number; inserted: number }> {
  const { data, error } = await supabaseAdmin.from('leads').select(LEAD_COLS).limit(limit);
  if (error) throw new Error(`runLeadMigration: reading leads failed: ${error.message}`);
  const leads = (data as LeadRow[]) ?? [];
  const inserted = await upsertProspects(leads.map(leadToProspect));
  return { scanned: leads.length, inserted };
}
