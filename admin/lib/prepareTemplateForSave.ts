// admin/lib/prepareTemplateForSave.ts

const DB_FIELD_NAMES = new Set([
    'id',
    'slug',
    'template_name',
    'layout',
    'color_scheme',
    'theme',
    'brand',
    'industry',
    'phone',
    'commit',
    'saved_at',
    'save_count',
    'last_editor',
    'is_site',
    'published',
    'verified',
    'hero_url',
    'banner_url',
    'logo_url',
    'team_url',
    'default_subdomain',
    'site_id',
    'domain',
    'custom_domain',
    'color_mode',
    'created_at',
    'updated_at',
    'editor_id',
    'claimed_by',
    'claimed_at',
    'claim_source',
    'archived',
  ]);
  
  const ALLOWED_JSON_FIELDS = new Set([
    'pages',
    'meta',
    'headerBlock',
    'footerBlock',
  ]);
  
  export function prepareTemplateForSave(fullTemplate: Record<string, any>) {
    const dbFields: Record<string, any> = {};
    const jsonFields: Record<string, any> = {};
  
    for (const [key, value] of Object.entries(fullTemplate)) {
      if (DB_FIELD_NAMES.has(key)) {
        dbFields[key] = value;
      } else if (key === 'services') {
        dbFields.services = value; // stored in separate jsonb column
      } else if (key === 'meta') {
        dbFields.meta = value; // optional override to keep meta outside data
      } else if (key === 'headerBlock') {
        dbFields.header_block = value;
      } else if (key === 'footerBlock') {
        dbFields.footer_block = value;
      } else if (ALLOWED_JSON_FIELDS.has(key)) {
        jsonFields[key] = value; // allow pages/meta/etc
      }
      // else: ignore unrecognized fields entirely
    }
  
    dbFields.data = jsonFields;
    return dbFields;
  }
  