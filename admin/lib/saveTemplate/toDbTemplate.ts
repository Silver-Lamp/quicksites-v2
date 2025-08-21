// admin/lib/saveTemplate/toDbTemplate.ts
type Any = Record<string, any>;

/** Map UI/camel keys to DB snake_case keys + drop unknowns */
export function toDbTemplate(ui: Any): Any {
  const out: Any = {};

  // allowlist of columns you actually write
  const map: Record<string, string> = {
    id: 'id',
    site_id: 'site_id',
    template_name: 'template_name',
    industry: 'industry',
    layout: 'layout',
    color_scheme: 'color_scheme',
    color_mode: 'color_mode',
    theme: 'theme',
    brand: 'brand',
    commit: 'commit',
    slug: 'slug',
    name: 'name',
    domain: 'domain',
    custom_domain: 'custom_domain',
    published: 'published',
    data: 'data',
    services: 'services',
    // 🔽 the important ones
    headerBlock: 'header_block',
    footerBlock: 'footer_block',
    // keep legacy keys if you ever pass them through
    header_block: 'header_block',
    footer_block: 'footer_block',
  };

  for (const [k, v] of Object.entries(ui)) {
    const dbk = map[k];
    if (dbk !== undefined) out[dbk] = v;
  }

  // timestamps can be handled by trigger, but if you set them manually:
  out.updated_at = new Date().toISOString();

  return out;
}
