// lib/templates/getSiteBySlug.ts
import { getServerSupabase } from '@/lib/supabase/server';
import type { Template } from '@/types/template';

/**
 * Merge site identity into a template object and *unify* services so downstream
 * renderers can reliably read:
 *   - template.services
 *   - template.data.services
 *   - template.data.meta.services
 *
 * Also overlays site.meta (business/contact/industry/etc.) onto template.data.meta
 * so published pages can resolve identity from the template alone.
 */
function unifyFromSite(site: any, tpl: any): Template {
  const siteData = site?.data ?? {};
  const siteMeta = siteData?.meta ?? {};

  const tplData = tpl?.data ?? {};
  const tplMeta = tplData?.meta ?? {};

  // Prefer services from the site first, then template-level sources
  const candidates = [
    siteMeta.services,
    siteData.services,
    tplData.services,
    tplMeta.services,
    tpl?.services,
  ];
  const firstArr: any[] =
    (candidates.find((v) => Array.isArray(v) && v.length > 0) as any[]) || [];

  const services = Array.from(
    new Set(firstArr.map((s) => String(s ?? '').trim()).filter(Boolean))
  );

  const mergedMeta = {
    ...tplMeta,
    ...siteMeta, // site-level identity wins
    services,
  };

  return {
    ...(tpl || {}),
    services,
    data: {
      ...tplData,
      services,
      meta: mergedMeta,
    },
  } as Template;
}

export async function getSiteBySlug(slug: string): Promise<Template | null> {
  const sb = await getServerSupabase();

  const loadTemplateById = async (id?: string | null) => {
    if (!id) return null;
    const { data, error } = await sb
      .from('templates')
      .select('*')
      .eq('id', id)
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error('[getSiteBySlug] loadTemplateById:', error.message);
    }
    return data || null;
  };

  // Prefer `sites`
  {
    const { data, error } = await sb
      .from('sites')
      .select('*')
      .eq('slug', slug)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (!error && data?.length) {
      const site = data[0];
      // Fetch the linked template, if any, then merge site → template
      const tpl = (await loadTemplateById(site.template_id)) || {};
      return unifyFromSite(site, tpl);
    }
  }

  // Fallback `templates` by slug (site-like templates first)
  {
    const { data, error } = await sb
      .from('templates')
      .select('*')
      .eq('slug', slug)
      .order('is_site', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(1);

    if (!error && data?.length) return data[0] as Template;
  }

  // Additional fallback: match base_slug (sometimes editor slugs differ)
  {
    const { data, error } = await sb
      .from('templates')
      .select('*')
      .eq('base_slug', slug)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (!error && data?.length) return data[0] as Template;
  }

  return null;
}
