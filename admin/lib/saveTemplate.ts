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

// small helper
const omit = <T extends object, K extends keyof T>(obj: T, ...keys: K[]): Omit<T, K> => {
  const clone: any = { ...obj };
  for (const k of keys) delete clone[k];
  return clone;
};

export async function saveTemplate(input: any, id?: string): Promise<Template> {
  const supabase = await getSupabaseForAction();

  // auth
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) throw new Error('Not authenticated');

  // unwrap input
  const src = input?.db ? input.db : input;
  const rowId = id ?? src?.id ?? undefined;

  // common payload
  const basePayload: Record<string, any> = {
    id: rowId,
    template_name: trimOrNull(src?.template_name),
    slug: trimOrNull(src?.slug),
    layout: trimOrNull(src?.layout),
    color_scheme: trimOrNull(src?.color_scheme),
    theme: trimOrNull(src?.theme),
    brand: trimOrNull(src?.brand),
    industry: trimOrNull(src?.industry),
    color_mode: trimOrNull(src?.color_mode),

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

    data: src?.data ?? {},

    header_block: (input?.header_block ?? src?.header_block ?? src?.headerBlock) ?? null,
    footer_block: (input?.footer_block ?? src?.footer_block ?? src?.footerBlock) ?? null,

    services: cleanServices(src?.services),
    // DO NOT trust client owner_id; we decide below
  };

  stripUndefined(basePayload);

  // decide: create vs update
  let exists = false;
  if (rowId) {
    const { data: existing, error: existsErr } = await supabase
      .from('templates')
      .select('id, owner_id')
      .eq('id', rowId)
      .maybeSingle();

    if (existsErr) throw new Error(JSON.stringify(existsErr));
    exists = !!existing;
  }

  if (!exists) {
    // CREATE: include owner_id from session (write-once)
    const payload = { ...basePayload, owner_id: user.id };
    const { data, error } = await supabase
      .from('templates')
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(JSON.stringify(error));
    return data as Template;
  } else {
    // UPDATE: never send owner_id; DB trigger prevents changes too
    const payload = omit(basePayload, 'owner_id');
    const { data, error } = await supabase
      .from('templates')
      .update(payload)
      .eq('id', rowId!)
      .select()
      .single();
    if (error) throw new Error(JSON.stringify(error));
    return data as Template;
  }
}

