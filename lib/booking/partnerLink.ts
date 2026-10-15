// lib/booking/partnerLink.ts — the owner-consented link between a booking site and a partner's
// restaurant (crosstalk/contracts/restaurant-floor-plan.md, "Linking", 2026-10-15).
//
// The flow: the site's OWNER mints a one-time code on QS (`mintLinkCode`, under their session) →
// the partner verifies it with a signed call (`verifyLinkCode`) → the link is `linked` and the
// partner booking routes answer for that template (`isPartnerLinked`). Either side may unlink;
// a link is never deleted. ⚠️ The demo trattoria is exempt by its DEMO FLAGS, never by id, so a
// second demo behaves the same and a real site can never be exempted by accident.
import crypto from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';

export type Partner = 'hivejournal';
export const LINK_CODE_TTL_MS = 15 * 60 * 1000;

export type LinkRow = {
  id: string;
  template_id: string;
  partner: Partner;
  status: 'pending' | 'linked' | 'unlinked';
  code_expires_at: string | null;
  code_used_at: string | null;
  linked_by: string | null;
  linked_at: string | null;
  partner_ref: string | null;
  unlinked_at: string | null;
  unlinked_by: 'owner' | 'partner' | null;
  unlink_reason: string | null;
  created_at: string;
};

const hash = (code: string) => crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');

/** 10 unambiguous characters — read aloud or copied by hand, never guessed (≈ 2^47). */
export function generateLinkCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(10);
  let out = '';
  for (let i = 0; i < 10; i++) out += alphabet[bytes[i] % alphabet.length];
  return `${out.slice(0, 5)}-${out.slice(5)}`;
}

/** Is the template a demo that partners may read without a link? Flags, not an id. */
export function isLinkExemptDemo(data: unknown): boolean {
  const meta = (data as { meta?: { is_demo?: unknown; demo_kind?: unknown } } | null)?.meta;
  return meta?.is_demo === true && meta?.demo_kind === 'italy_table_booking';
}

/** Where the owner takes the code (HJ's connect page). Overridable by env so the pattern can change without a deploy of ours. */
export function hjConnectUrl(templateId: string, code: string): string {
  const base = process.env.HJ_RESTAURANT_CONNECT_URL || 'https://www.hivejournal.com/dashboard/restaurants/connect';
  return `${base}?template=${encodeURIComponent(templateId)}&code=${encodeURIComponent(code)}`;
}

export async function currentLink(templateId: string, partner: Partner = 'hivejournal'): Promise<LinkRow | null> {
  const { data } = await supabaseAdmin.from('template_partner_links').select('*').eq('template_id', templateId).eq('partner', partner).order('created_at', { ascending: false }).limit(1).maybeSingle();
  return (data as LinkRow | null) ?? null;
}

/** May this partner read/write this template's bookings? Linked, or an exempt demo. */
export async function isPartnerLinked(templateId: string, partner: Partner = 'hivejournal'): Promise<boolean> {
  const { data: linked } = await supabaseAdmin.from('template_partner_links').select('id').eq('template_id', templateId).eq('partner', partner).eq('status', 'linked').limit(1);
  if (linked?.length) return true;
  const { data: tpl } = await supabaseAdmin.from('templates').select('data').eq('id', templateId).maybeSingle();
  return !!tpl && isLinkExemptDemo((tpl as { data: unknown }).data);
}

/** The owner mints a code. Any earlier pending code for the pair is superseded (marked used). Returns the plain code ONCE. */
export async function mintLinkCode(input: { templateId: string; ownerId: string; partner?: Partner }): Promise<{ code: string; expiresAt: string }> {
  const partner = input.partner ?? 'hivejournal';
  const code = generateLinkCode();
  const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MS).toISOString();
  await supabaseAdmin.from('template_partner_links').update({ code_used_at: new Date().toISOString() }).eq('template_id', input.templateId).eq('partner', partner).eq('status', 'pending').is('code_used_at', null);
  const { error } = await supabaseAdmin.from('template_partner_links').insert({ template_id: input.templateId, partner, status: 'pending', code_hash: hash(code), code_expires_at: expiresAt, linked_by: input.ownerId });
  if (error) throw new Error(error.message);
  return { code, expiresAt };
}

export type VerifyResult = { ok: true; link: LinkRow } | { ok: false; error: 'no_code' | 'expired' | 'used' | 'already_linked' };

/** The partner verifies a code. Single use; expiry checked; a template already linked answers 409. */
export async function verifyLinkCode(input: { templateId: string; code: string; partner?: Partner; partnerRef?: string | null }): Promise<VerifyResult> {
  const partner = input.partner ?? 'hivejournal';
  const { data } = await supabaseAdmin
    .from('template_partner_links')
    .select('*')
    .eq('template_id', input.templateId)
    .eq('partner', partner)
    .eq('status', 'pending')
    .eq('code_hash', hash(input.code))
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = data as LinkRow | null;
  if (!row) return { ok: false, error: 'no_code' };
  if (row.code_used_at) return { ok: false, error: 'used' };
  if (row.code_expires_at && new Date(row.code_expires_at).getTime() < Date.now()) return { ok: false, error: 'expired' };
  const { data: already } = await supabaseAdmin.from('template_partner_links').select('id').eq('template_id', input.templateId).eq('partner', partner).eq('status', 'linked').limit(1);
  if (already?.length) return { ok: false, error: 'already_linked' };
  const now = new Date().toISOString();
  const { data: updated, error } = await supabaseAdmin
    .from('template_partner_links')
    .update({ status: 'linked', code_used_at: now, linked_at: now, partner_ref: (input.partnerRef ?? '').slice(0, 120) || null })
    .eq('id', row.id)
    .eq('status', 'pending')
    .is('code_used_at', null)
    .select('*')
    .maybeSingle();
  if (error || !updated) return { ok: false, error: 'used' }; // lost a race to a concurrent verify
  return { ok: true, link: updated as LinkRow };
}

/** Either side unlinks; the row stays with who and why. */
export async function unlinkTemplate(input: { templateId: string; by: 'owner' | 'partner'; reason?: string | null; partner?: Partner }): Promise<boolean> {
  const partner = input.partner ?? 'hivejournal';
  const { data, error } = await supabaseAdmin
    .from('template_partner_links')
    .update({ status: 'unlinked', unlinked_at: new Date().toISOString(), unlinked_by: input.by, unlink_reason: (input.reason ?? '').slice(0, 200) || null })
    .eq('template_id', input.templateId)
    .eq('partner', partner)
    .eq('status', 'linked')
    .select('id');
  return !error && !!data?.length;
}
