// lib/ppl/syncForwardAddress.ts — the I/O around footerAddress.ts: read the campaign and the
// business behind its forward_to, decide, commit through the sanctioned RPC, republish what is live.
import { supabaseAdmin } from '@/lib/supabase/admin';
import { commitTemplatePatch } from '@/lib/templates/commitTemplatePatch';
import { republishIfPublished } from '@/lib/templates/republishIfPublished';
import { applyFooterAddress, footerAddressFor, type FooterAddressDecision } from '@/lib/ppl/footerAddress';
import { last10 } from '@/lib/ppl/ownNumberCall';

export type SyncFooterResult = {
  ok: boolean;
  kind: FooterAddressDecision['kind'] | 'kept' | 'error' | 'no_site' | 'no_forward';
  address?: string | null;
  republished: boolean;
  warning?: string;
};

/** The listed business behind a phone (last ten digits), narrowed server-side — never a full-table scan. */
async function businessByPhone(phone: string): Promise<{ business_name: string | null; address: string | null; city: string | null; lat: number | null; lng: number | null } | null> {
  const key = last10(phone);
  if (key.length !== 10) return null;
  const tail7 = key.slice(-7);
  const dashed = `${tail7.slice(0, 3)}-${tail7.slice(3)}`;
  const { data } = await supabaseAdmin
    .from('outreach_prospects')
    .select('business_name, address, city, phone, address_lat, address_lon')
    .not('phone', 'is', null)
    .or(`phone.ilike.%${dashed},phone.ilike.%${tail7}`)
    .limit(200);
  const row = ((data ?? []) as Array<{ business_name: string | null; address: string | null; city: string | null; phone: string | null; address_lat: number | null; address_lon: number | null }>).find((r) => last10(r.phone) === key && String(r.address ?? '').trim());
  if (!row) return null;
  return { business_name: row.business_name, address: row.address, city: row.city, lat: row.address_lat ?? null, lng: row.address_lon ?? null };
}

export async function syncForwardAddressToSite(campaignId: string, opts: { force?: boolean; actorId?: string | null } = {}): Promise<SyncFooterResult> {
  const { data: c } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .select('id, city, region, forward_to, template_id')
    .eq('id', campaignId)
    .maybeSingle();
  const camp = c as { id: string; city: string | null; region: string | null; forward_to: string | null; template_id: string | null } | null;
  if (!camp?.template_id) return { ok: false, kind: 'no_site', republished: false };
  const { data: t } = await supabaseAdmin.from('templates').select('id, rev, data').eq('id', camp.template_id).maybeSingle();
  const tpl = t as { id: string; rev: number | null; data: unknown } | null;
  if (!tpl) return { ok: false, kind: 'no_site', republished: false, warning: 'template not found' };

  const business = camp.forward_to ? await businessByPhone(camp.forward_to) : null;
  const decision = footerAddressFor({ campaignCity: camp.city, campaignRegion: camp.region, business });
  const patch = applyFooterAddress(tpl.data, decision, { forwardTo: camp.forward_to, force: opts.force });
  if (!patch.changed) return { ok: true, kind: patch.kind, republished: false };

  const err = await commitTemplatePatch(tpl.id, tpl.rev ?? 0, { data: patch.data, ...patch.columns }, opts.actorId ?? null);
  if (err) return { ok: false, kind: 'error', republished: false, warning: `commit failed: ${err}` };
  const { republished, warning } = await republishIfPublished(tpl.id);
  const address = decision.kind === 'street' ? decision.line1 : decision.kind === 'service_area' ? decision.label : null;
  return { ok: true, kind: patch.kind, address, republished, warning };
}
