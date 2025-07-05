// lib/leads/enrichLead.ts
import { z } from 'zod';
import type { Lead as BaseLead } from '@/types/lead.types';

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
});

export type EnrichedLead = BaseLead & {
  draft_sites?: {
    domain?: string;
    is_claimed?: boolean;
  };
  users?: {
    email?: string;
  };
  link_type: string | null;
};

export function enrichLead(
  lead: any,
  campaignMap: Map<string, string[]>
): EnrichedLead | null {
  const parsed = zLead.safeParse(lead);
  if (!parsed.success) {
    console.warn('❌ Invalid lead skipped', parsed.error.format());
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
