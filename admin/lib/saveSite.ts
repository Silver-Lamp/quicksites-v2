// admin/lib/saveSite.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';
import type { Template } from '../../types/template';
import { randomUUID } from 'crypto';

export async function saveSiteWithClient(
  db: SupabaseClient<Database>,
  site: Template
): Promise<Template> {
  const payload = {
    id: site.id ||= randomUUID(), // ensure this is set (client creates one; server can fallback)
    site_name: site.site_name,
    slug: site.slug,
    data: site.data,
    // theme: site.theme,
    // brand: site.brand,
    // layout: site.layout,
    // color_scheme: site.color_scheme,
    // is_site: true,
  };

  const { data, error } = await db
    .from('sites')
    .upsert(payload, { onConflict: 'id' }) // 👈 handles insert or update
    .select()
    .single();

  if (error) throw error;
  return data as Template;
}
