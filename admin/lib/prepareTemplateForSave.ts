// admin/lib/prepareTemplateForSave.ts

const DB_FIELD_NAMES = new Set([
    'id','slug','template_name','layout','color_scheme','theme','brand','industry','phone',
    'commit','saved_at','save_count','last_editor','is_site','published','verified',
    'hero_url','banner_url','logo_url','team_url','default_subdomain','site_id','domain',
    'custom_domain','color_mode','created_at','updated_at','editor_id','claimed_by',
    'claimed_at','claim_source','archived',
  ]);
  
  // Incoming editor JSON is allowed to carry these at top-level;
  // if present, they should override what's inside `.data`.
  const JSON_TOPLEVEL_KEYS = new Set(['pages','meta']);
  
  // Treat "" as null for uuid-like columns
  function coerceEmptyToNull(v: unknown) {
    return (typeof v === 'string' && v.trim() === '') ? null : v;
  }
  const UUID_KEYS = new Set(['site_id','editor_id','claimed_by']);
  
  export function prepareTemplateForSave(fullTemplate: Record<string, any>) {
    const db: Record<string, any> = {};
  
    // scalars
    for (const [k, v] of Object.entries(fullTemplate)) {
      if (DB_FIELD_NAMES.has(k)) db[k] = UUID_KEYS.has(k) ? coerceEmptyToNull(v) : v;
    }
  
    // start from .data
    const fromData =
      fullTemplate && typeof fullTemplate.data === 'object' && fullTemplate.data
        ? structuredClone(fullTemplate.data)
        : {};
  
    // only override pages if the top-level has a **non-empty array**
    if (Array.isArray(fullTemplate.pages) && fullTemplate.pages.length > 0) {
      (fromData as any).pages = fullTemplate.pages;
    }
    // meta can safely override
    if (fullTemplate.meta) (fromData as any).meta = fullTemplate.meta;
  
    if (!Array.isArray((fromData as any).pages)) (fromData as any).pages = [];
  
    db.data = fromData;
  
    console.debug('[prepareTemplateForSave] pages out:', db.data.pages.length);
    return db;
  }
  
  