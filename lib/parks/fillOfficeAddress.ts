// lib/parks/fillOfficeAddress.ts
//
// Server action: fill a template's missing office address from the industrial-park registry
// (real building + synthetic suite) and commit it. Extracted from the fill-park-address route
// so both the route AND the readiness pipeline call the same logic (no self-HTTP). Idempotent
// + safe for the pipeline: skips food sites and any site that already shows a NAP address.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { resolveIndustryKey } from '@/lib/industries';
import { analyzeOnPage } from '@/lib/outreach/onPage';
import { parksRegistryEnabled } from '@/lib/parks/registry';
import { resolveOfficeAddressFromRegistry } from '@/lib/parks/officeAddress';
import { applyOfficeAddressToData } from '@/lib/parks/applyOfficeAddressToTemplate';
import { deriveTemplateLocation } from '@/lib/geo/deriveTemplateLocation';
import { commitTemplatePatch } from '@/lib/templates/commitTemplatePatch';

const FOOD_INDUSTRIES = new Set(['restaurant']);

export type FillOfficeAddressResult = {
  ok: boolean;
  changed: boolean;
  reason?: string;
  parkName?: string;
  label?: string;
  city?: string;
  region?: string;
  error?: string;
};

export async function fillOfficeAddress(templateId: string, actorId: string | null): Promise<FillOfficeAddressResult> {
  if (!parksRegistryEnabled()) return { ok: true, changed: false, reason: 'disabled' };

  const { data: t } = await supabaseAdmin
    .from('templates')
    .select('id, slug, data, rev, city, state, industry')
    .eq('id', templateId)
    .maybeSingle();
  if (!t) return { ok: false, changed: false, reason: 'no_template' };

  const tpl: any = t;
  const meta = tpl.data?.meta ?? {};
  const industryKey = resolveIndustryKey(tpl.industry || meta?.identity?.industry || meta?.industry || '');
  if (FOOD_INDUSTRIES.has(industryKey)) return { ok: true, changed: false, reason: 'not_applicable' };

  // Never overwrite a real address the site already shows — the fix is only for a missing NAP.
  if (analyzeOnPage(tpl.data ?? {}).hasNap) return { ok: true, changed: false, reason: 'already' };

  const loc = deriveTemplateLocation({ data: tpl.data, city: tpl.city, state: tpl.state });
  if (!loc.city) return { ok: false, changed: false, reason: 'no_city' };

  let addr;
  try {
    addr = await resolveOfficeAddressFromRegistry(
      { domain: tpl.slug || templateId, city: loc.city, region: loc.state || null, industryKey },
      actorId,
    );
  } catch (e: any) {
    return { ok: false, changed: false, reason: 'error', error: e?.message || 'Lookup failed.' };
  }
  if (!addr) return { ok: true, changed: false, reason: 'no_parks', city: loc.city, region: loc.state };

  const { data: newData, columns } = applyOfficeAddressToData(tpl.data ?? {}, addr);
  const commitErr = await commitTemplatePatch(templateId, tpl.rev ?? 0, { ...columns, data: newData }, actorId);
  if (commitErr) return { ok: false, changed: false, reason: 'commit_failed', error: commitErr };

  return { ok: true, changed: true, parkName: addr.parkName, label: addr.label };
}
