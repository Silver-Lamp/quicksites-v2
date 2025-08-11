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
    return typeof v === 'string' && v.trim() === '' ? null : v;
  }
  const UUID_KEYS = new Set(['site_id','editor_id','claimed_by']);
  
  export function prepareTemplateForSave(fullTemplate: Record<string, any>) {
    const db: Record<string, any> = {};
  
    // -------- color_mode: compute once with clear precedence ----------
    // 1) top-level color_mode from the editor/template object
    // 2) fallback to data.color_mode if someone stashed it there (legacy)
    // (Do NOT invent a default here; let callers pass the correct value.)
    const incomingMode = (fullTemplate?.color_mode ?? fullTemplate?.data?.color_mode) as
      | 'light'
      | 'dark'
      | undefined;
  
    // -------- copy allowed scalar fields ----------
    for (const [k, v] of Object.entries(fullTemplate)) {
      if (!DB_FIELD_NAMES.has(k)) continue;
      db[k] = UUID_KEYS.has(k) ? coerceEmptyToNull(v) : v;
    }
  
    // Ensure color_mode is explicitly present if we resolved it above
    if (incomingMode === 'light' || incomingMode === 'dark') {
      db.color_mode = incomingMode;
    } else if ('color_mode' in db && (db.color_mode === undefined || db.color_mode === null)) {
      // Avoid upserting undefined which can leave the row at an old value
      delete db.color_mode;
    }
  
    // -------- start from .data and merge top-level overrides ----------
    const fromData =
      fullTemplate && typeof fullTemplate.data === 'object' && fullTemplate.data
        ? structuredClone(fullTemplate.data)
        : {};
  
    // pages: only override if top-level has a non-empty array
    if (Array.isArray(fullTemplate.pages) && fullTemplate.pages.length > 0) {
      (fromData as any).pages = fullTemplate.pages;
    }
    // meta: top-level always wins if provided
    if (fullTemplate.meta) {
      (fromData as any).meta = fullTemplate.meta;
    }
  
    // Safety: normalize pages to an array
    if (!Array.isArray((fromData as any).pages)) {
      (fromData as any).pages = [];
    }
  
    db.data = fromData;
  
    // Optional visibility for debugging
    console.debug('[prepareTemplateForSave] color_mode out:', db.color_mode);
    console.debug('[prepareTemplateForSave] pages out:', db.data.pages.length);
  
    return db;
  }
  