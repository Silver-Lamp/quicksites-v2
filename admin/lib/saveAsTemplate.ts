// admin/lib/saveAsTemplate.ts
import { supabase } from '@/admin/lib/supabaseClient';
import { cleanTemplateDataStructure } from './cleanTemplateData';
import type { Template } from '@/types/template';

type SaveResult = { id: string; slug: string } | null;

const slugify = (str: string) =>
  (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .trim();

const shortId = () => Math.random().toString(36).slice(2, 6);
/** 13-char token so it is NOT stripped by the base_slug regex (-[a-z0-9]{2,12})+ */
const id13 = () => Math.random().toString(36).slice(2).replace(/[^a-z0-9]/g, '').padEnd(13, '0').slice(0, 13);

const digitsOnly = (v: any) => {
  const s = String(v ?? '').replace(/\D/g, '');
  return s || null;
};
const trimOrNull = (v: any) => {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};
const numOrNull = (v: any) => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v));
  return Number.isFinite(n) ? n : null;
};
function cleanServices(v: any): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const arr = v.map((s) => String(s ?? '').trim()).filter(Boolean);
  return arr.length ? Array.from(new Set(arr)) : [];
}

export async function saveAsTemplate(
  template: Partial<Template> & Record<string, any>,
  type: 'template' | 'site'
): Promise<SaveResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const baseName = template.template_name || template.slug || 'untitled';
  const newName = `Copy of ${baseName}`;

  // Normalize blocks/data
  const cleaned = cleanTemplateDataStructure(template);
  const headerBlock =
    (template as any).header_block ??
    (template as any).headerBlock ??
    (template.data as any)?.headerBlock ??
    (cleaned as any)?.headerBlock ??
    null;
  const footerBlock =
    (template as any).footer_block ??
    (template as any).footerBlock ??
    (template.data as any)?.footerBlock ??
    (cleaned as any)?.footerBlock ??
    null;

  const finalData = {
    ...(template.data ?? {}),
    ...(cleaned?.data ?? cleaned),
    headerBlock,
    footerBlock,
  };

  // Build a candidate-root for the new slug (DB derives base_slug from this root)
  const root = slugify(template.slug || template.template_name || 'copy');
  const rootUnique = `${root}-${type}-copy-${id13()}`; // -> base_slug
  const makeCandidate = (attempt: number) =>
    [rootUnique, shortId(), attempt ? shortId() : ''].filter(Boolean).join('-').slice(0, 80);

  const servicesJson =
    cleanServices((template as any).services_jsonb) ??
    cleanServices((template as any).services) ??
    [];

  // Identity/contact
  const business_name = trimOrNull((template as any).business_name);
  const contact_email = trimOrNull((template as any).contact_email);
  const phone = digitsOnly((template as any).phone);
  const address_line1 = trimOrNull((template as any).address_line1);
  const address_line2 = trimOrNull((template as any).address_line2);
  const city = trimOrNull((template as any).city);
  const state = trimOrNull((template as any).state);
  const postal_code = trimOrNull((template as any).postal_code);
  const latitude = numOrNull((template as any).latitude);
  const longitude = numOrNull((template as any).longitude);

  // IMPORTANT: do NOT set slug in this insert
  const commonPayload = {
    template_name: `${newName} (${type})`,
    // slug: (set after insert via API)

    layout: template.layout ?? 'standard',
    color_scheme: template.color_scheme ?? 'neutral',
    theme: template.theme ?? 'default',
    brand: template.brand ?? 'default',
    industry: template.industry ?? 'general',
    commit: '',
    color_mode:
      (template as any)?.color_mode ??
      (template.data as any)?.color_mode ??
      null,

    business_name,
    contact_email,
    phone,
    address_line1,
    address_line2,
    city,
    state,
    postal_code,
    latitude,
    longitude,

    header_block: headerBlock,
    footer_block: footerBlock,
    data: finalData,

    services_jsonb: servicesJson,
    is_site: type === 'site',
    published: false,
    verified: false,

    domain: null,
    custom_domain: null,
    default_subdomain: null,
    owner_id: user?.id ?? null,
  };

  // 1) Insert the copy WITHOUT slug
  const { data: inserted, error: insErr } = await supabase
    .from('templates')
    .insert([commonPayload])
    .select('id, slug')
    .single();

  if (insErr || !inserted?.id) {
    console.error('Failed to insert copy:', insErr);
    return null;
  }

  // 2) Set slug via service-role API (commit pipeline)
  //    Try a few candidates if conflicts occur.
  const id = inserted.id as string;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = makeCandidate(attempt);
    try {
      const res = await fetch(`/api/templates/${id}/slug`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: candidate }),
      });
      const json = await res.json();

      if (res.ok && json?.slug) {
        return { id, slug: json.slug as string };
      }

      // 409s → try another candidate
      if (res.status === 409) continue;

      // Unknown error → abort
      console.error('Slug set failed:', json);
      return { id, slug: inserted.slug ?? candidate };
    } catch (e) {
      console.error('Slug set request error:', e);
      return { id, slug: inserted.slug ?? candidate };
    }
  }

  console.warn('Slug set: exhausted candidates; returning with initial DB slug.');
  return { id, slug: inserted.slug ?? makeCandidate(99) };
}
