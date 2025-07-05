import { z } from 'zod';
import type { Lead as BaseLead } from '@/types/lead.types';
import { getDistanceMiles } from './distance';

export const zLead = z.object({
  id: z.string(),
  business_name: z.string(),
  campaign_id: z.string().nullable(),
  draft_sites: z
    .object({
      domain: z.string().optional(),
      is_claimed: z.boolean().optional(),
    })
    .nullable()
    .optional(),
  users: z
    .object({
      email: z.string().email().optional(),
    })
    .nullable()
    .optional(),
  address_lat: z.number().nullable().optional(),
  address_lon: z.number().nullable().optional(),
});

export type EnrichedLead = BaseLead & {
  draft_sites?: {
    domain?: string;
    is_claimed?: boolean;
  };
  users?: {
    email?: string;
  };
  address_lat?: number | null;
  address_lon?: number | null;
  link_type: '📎 campaign_id' | '📦 lead_ids[]' | null;
  distance_km?: number;
};

export function enrichLead(
  lead: any,
  campaignMap: Map<string, string[]>
): EnrichedLead | null {
  const parsed = zLead.safeParse(lead);
  if (!parsed.success) {
    console.warn('❌ Invalid lead skipped:', parsed.error.format());
    return null;
  }

  const cleaned = parsed.data;
  let link_type: EnrichedLead['link_type'] = null;

  for (const [campId, ids] of campaignMap.entries()) {
    if (ids.includes(cleaned.id)) {
      link_type = cleaned.campaign_id === campId ? '📎 campaign_id' : '📦 lead_ids[]';
      break;
    }
  }

  return {
    ...lead,
    link_type,
  };
}

export function enrichLeadWithDistance(
  lead: any,
  campaignMap: Map<string, string[]>,
  campaignLat: number,
  campaignLon: number
): EnrichedLead | null {
  const base = enrichLead(lead, campaignMap);
  if (!base) return null;

  const lat = base.address_lat;
  const lon = base.address_lon;

  if (lat !== null && lon !== null && typeof lat === 'number' && typeof lon === 'number') {
    const distMiles = getDistanceMiles(campaignLat, campaignLon, lat, lon);
    return { ...base, distance_km: Math.round(distMiles * 1.60934 * 10) / 10 }; // round to 1 decimal
  }

  return base;
}
