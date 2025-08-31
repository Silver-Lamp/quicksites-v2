import { randomUUID } from 'crypto';
import { supabaseAdmin } from './clients';
import { slugify } from './slugs';
import { T_TEMPLATES } from './env';

export function baseSlugFromSlug(slug: string) {
  return (slug || '').replace(/(-[A-Za-z0-9]{2,12})+$/g, '');
}

export async function ensureUniqueTemplateSubdomain(base: string): Promise<string> {
  const root = (base || 'demo').toLowerCase().replace(/[^a-z0-9-]/g,'-').replace(/^-+|-+$/g,'') || 'demo';
  let candidate = root; let i = 2;
  while (true) {
    const { data, error } = await supabaseAdmin.from(T_TEMPLATES).select('id').eq('default_subdomain', candidate).limit(1);
    if (error) throw new Error(error.message);
    if (!data?.length) return candidate;
    candidate = `${root}-${i++}`;
  }
}

export async function getOrCreateCanonicalTemplate(opts: {
  templateName: string;
  versionSlug: string;
  merchantId: string;
  dataForNew?: any;
  ownerId?: string | null;
}) {
  const baseSlug = baseSlugFromSlug(opts.versionSlug);
  let { data: canonical, error } = await supabaseAdmin
    .from(T_TEMPLATES).select('id, slug')
    .eq('base_slug', baseSlug).eq('is_version', false).maybeSingle();
  if (error) throw new Error(error.message);

  if (!canonical) {
    const row:any = {
      id: randomUUID(),
      merchant_id: opts.merchantId,
      template_name: opts.templateName,
      slug: baseSlug,
      data: opts.dataForNew ?? { meta: {}, pages: [] },
      is_site: true,
      published: false,
      owner_id: opts.ownerId ?? null,
      industry: opts.dataForNew?.industry || null,
    };
    let up = await supabaseAdmin.from(T_TEMPLATES).insert(row).select('id, slug').single();
    if (up.error) {
      const s = `${up.error.message} ${up.error.details ?? ''}`.toLowerCase();
      if (/could not find the 'is_site' column/.test(s)) {
        const { is_site, ...row2 } = row;
        up = await supabaseAdmin.from(T_TEMPLATES).insert(row2).select('id, slug').single();
        if (up.error) throw new Error(up.error.message);
      } else {
        throw new Error(up.error.message);
      }
    }
    canonical = up.data!;
  }
  return { id: canonical.id as string, baseSlug, canonicalSlug: canonical.slug as string };
}

export function isMissingColumnErr(err: any) {
  const s = `${err?.message || ''} ${err?.details || ''}`.toLowerCase();
  return /column .* does not exist/.test(s) || /could not find the '.*' column/.test(s) || /missing column/.test(s);
}

export async function upsertTemplateAdaptive(
  merchantId: string,
  tpl: { name: string; slug?: string | null; data: any; industry?: string | null },
  opts?: { ownerId?: string | null }
) {
  const finalSlug = (tpl.slug || slugify(tpl.name)).toString();
  const NAME_COLS = ['template_name', 'name', 'title', 'site_name'];
  const SLUG_COLS = ['slug', 'template_slug', 'site_slug'];
  const DATA_COLS = ['data', 'template_json', 'json', 'content', 'site_json'];

  for (const nameCol of NAME_COLS) {
    for (const slugCol of SLUG_COLS) {
      for (const dataCol of DATA_COLS) {
        let row: any = {
          id: randomUUID(),
          merchant_id: merchantId,
          [nameCol]: tpl.name,
          [slugCol]: finalSlug,
          [dataCol]: tpl.data,
          is_site: true,
          owner_id: opts?.ownerId ?? null,
          industry: tpl.industry ?? null,
        };

        let up = await supabaseAdmin.from(T_TEMPLATES).upsert(row, { onConflict: slugCol }).select('id').single();
        if (!up.error) return { id: up.data.id as string, used: { nameCol, slugCol, dataCol } };

        const s = `${up.error.message} ${up.error.details ?? ''}`.toLowerCase();
        if (/could not find the 'is_site' column/.test(s)) {
          const { is_site, ...row2 } = row;
          up = await supabaseAdmin.from(T_TEMPLATES).upsert(row2, { onConflict: slugCol }).select('id').single();
          if (!up.error) return { id: up.data.id as string, used: { nameCol, slugCol, dataCol } };
        }
        if (/owner_id.*immutable/.test(s) || /could not find the 'owner_id' column/.test(s)) {
          const { owner_id, ...row3 } = row;
          up = await supabaseAdmin.from(T_TEMPLATES).upsert(row3, { onConflict: slugCol }).select('id').single();
          if (!up.error) return { id: up.data.id as string, used: { nameCol, slugCol, dataCol } };
        }
        if (isMissingColumnErr(up.error) || /not-null constraint/.test(s)) continue;

        throw up.error;
      }
    }
  }
  throw new Error(`Could not upsert into ${T_TEMPLATES}: none of the mappings worked`);
}

export async function patchTemplateIndustryServices(templateId: string, {
  industry,
  services,
}: { industry?: string | null; services?: string[] | null }) {
  if (!industry && (!services || !services.length)) return;

  const first: any = {};
  if (industry != null) first.industry = industry;
  if (services && services.length) first.services = services;

  let up = Object.keys(first).length
    ? await supabaseAdmin.from(T_TEMPLATES).update(first).eq('id', templateId)
    : { error: null };

  if (up.error) {
    const s = `${up.error.message} ${up.error.details ?? ''}`.toLowerCase();
    if (/invalid input.*json/i.test(s) || /type.*json/i.test(s)) {
      const retry: any = { ...(industry != null ? { industry } : {}) };
      if (services && services.length) retry.services = JSON.stringify(services);
      up = await supabaseAdmin.from(T_TEMPLATES).update(retry).eq('id', templateId);
      if (!up.error) return;
    }
    if (/column .*services.* does not exist/i.test(s) && industry != null) {
      await supabaseAdmin.from(T_TEMPLATES).update({ industry }).eq('id', templateId);
      return;
    }
    if (/column .*industry.* does not exist/i.test(s) && services && services.length) {
      let up2 = await supabaseAdmin.from(T_TEMPLATES).update({ services }).eq('id', templateId);
      if (up2.error) {
        const s2 = `${up2.error.message} ${up2.error.details ?? ''}`.toLowerCase();
        if (/invalid input.*json/i.test(s2)) {
          await supabaseAdmin.from(T_TEMPLATES).update({ services: JSON.stringify(services) }).eq('id', templateId);
        }
      }
      return;
    }
    console.warn('[seed] patchTemplateIndustryServices warning:', up.error);
  }
}
