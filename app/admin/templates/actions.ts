// app/admin/templates/actions.ts
'use server';

import { randomUUID } from 'crypto';
import { getSupabaseForAction } from '@/lib/supabase/serverClient';
import type { Template } from '@/types/template';

const TABLE_TEMPLATES = 'templates';
const TABLE_SITES = 'sites';

// Remove undefined so we don't send columns PostgREST doesn't like
function stripUndef<T extends Record<string, any>>(obj: T): T {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

/**
 * Save a TEMPLATE (design) into the `templates` table.
 * Only include columns that should reasonably exist there.
 * If your table name/columns differ, update TABLE_TEMPLATES / payload below.
 */
export async function saveTemplateAction(tpl: Template): Promise<Template> {
  const supabase = await getSupabaseForAction();

  // Whitelist top-level fields commonly stored on templates + jsonb `data`
  const payload = stripUndef({
    id: tpl.id,
    template_name: tpl.template_name,
    slug: tpl.slug,
    layout: tpl.layout,
    color_scheme: tpl.color_scheme,
    theme: tpl.theme,
    brand: tpl.brand,
    industry: tpl.industry,
    phone: tpl.phone ?? null,
    color_mode: tpl.color_mode ?? null,
    headerBlock: tpl.headerBlock ?? null,
    footerBlock: tpl.footerBlock ?? null,
    data: tpl.data ?? {}, // jsonb
  });

  const { data, error } = await supabase
    .from(TABLE_TEMPLATES)
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('[saveTemplateAction] upsert failed', error);
    throw new Error(JSON.stringify(error));
  }

  // Cast to Template for editor consumption
  return data as unknown as Template;
}

/**
 * Save a SITE instance into the `sites` table.
 * Keep the payload minimal (id, slug, site_name, data) to avoid schema mismatches
 * like the earlier "brand column not found" error.
 */
export async function saveSiteAction(site: Template): Promise<Template> {
  const supabase = await getSupabaseForAction();

  const payload = stripUndef({
    id: site.id ?? randomUUID(),
    slug: site.slug,
    site_name: site.site_name ?? null,
    data: site.data ?? {}, // jsonb
  });

  const { data, error } = await supabase
    .from(TABLE_SITES)
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('[saveSiteAction] upsert failed', error);
    throw new Error(JSON.stringify(error));
  }

  return data as unknown as Template;
}
