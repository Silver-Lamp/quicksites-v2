// lib/utils/extractSqlFieldsFromJson.ts
const SQL_FIELDS = [
    'slug',
    'template_name',
    'layout',
    'color_scheme',
    'theme',
    'brand',
    'industry',
    'phone',
    'commit',
    'is_site',
    'verified',
    'published',
    'default_subdomain',
    'hero_url',
    'banner_url',
    'logo_url',
    'team_url',
    'saved_at',
    'save_count',
    'last_editor',
  ] as const;
  
  type SqlFieldKey = (typeof SQL_FIELDS)[number];
  
  export function extractSqlFieldsFromJson(obj: Record<string, any>): {
    sqlFields: Record<SqlFieldKey, any>;
    layoutJson: Record<string, any>;
  } {
    const sqlFields: Record<SqlFieldKey, any> = {} as any;
    const layoutJson: Record<string, any> = {};
  
    for (const key in obj) {
      if ((SQL_FIELDS as readonly string[]).includes(key)) {
        sqlFields[key as SqlFieldKey] = obj[key];
      } else {
        layoutJson[key] = obj[key];
      }
    }
  
    return { sqlFields, layoutJson };
  }
  