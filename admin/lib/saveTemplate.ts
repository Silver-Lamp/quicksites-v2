'use server';

import { getSupabaseForAction } from '@/lib/supabase/serverClient';
import type { Template } from '@/types/template';

/** ---------- Sanitizers (server-side) ---------- */
function trimOrNull(v: any) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}
function numberOrNull(v: any) {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v));
  return Number.isFinite(n) ? n : null;
}
function digitsOrNull(v: any) {
  const s = String(v ?? '').replace(/\D/g, '');
  return s.length ? s : null;
}
function cleanServices(v: any) {
  if (!Array.isArray(v)) return undefined;
  const arr = v
    .map((s) => String(s ?? '').trim())
    .filter(Boolean);
  return arr.length ? Array.from(new Set(arr)) : [];
}

/** Keep only defined keys; let nulls pass through, drop undefined */
function stripUndefined(obj: Record<string, any>) {
  for (const k of Object.keys(obj)) {
    if (obj[k] === undefined) delete obj[k];
  }
  return obj;
}

export async function saveTemplate(input: any, id?: string): Promise<Template> {
  const supabase = await getSupabaseForAction();

  // If caller passed { db, header_block, footer_block }, unwrap it; otherwise use input as source.
  const src = input?.db ? input.db : input;
  const rowId = id ?? src?.id;

  const payload: Record<string, any> = {
    id: rowId,
    // core strings
    template_name: trimOrNull(src?.template_name),
    slug: trimOrNull(src?.slug),
    layout: trimOrNull(src?.layout),
    color_scheme: trimOrNull(src?.color_scheme),
    theme: trimOrNull(src?.theme),
    brand: trimOrNull(src?.brand),
    industry: trimOrNull(src?.industry),
    color_mode: trimOrNull(src?.color_mode),

    // DB canonical fields
    business_name: trimOrNull(src?.business_name),
    contact_email: trimOrNull(src?.contact_email),
    phone: digitsOrNull(src?.phone),

    address_line1: trimOrNull(src?.address_line1),
    address_line2: trimOrNull(src?.address_line2),
    city: trimOrNull(src?.city),
    state: trimOrNull(src?.state),
    postal_code: trimOrNull(src?.postal_code),

    latitude: numberOrNull(src?.latitude),
    longitude: numberOrNull(src?.longitude),

    // JSON fields
    data: src?.data ?? {},

    // snapshots (prefer explicit snapshots if caller sent {db,...})
    header_block: (input?.header_block ?? src?.header_block ?? src?.headerBlock) ?? null,
    footer_block: (input?.footer_block ?? src?.footer_block ?? src?.footerBlock) ?? null,

    // optional services array (if caller included it)
    services: cleanServices(src?.services),
  };

  stripUndefined(payload);

  const { data, error } = await supabase
    .from('templates')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();

  if (error) throw new Error(JSON.stringify(error));
  return data as unknown as Template;
}
