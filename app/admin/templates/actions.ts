// admin/lib/prepareTemplateForSave.ts

const DB_FIELD_NAMES = new Set([
  'id','slug','template_name','layout','color_scheme','theme','brand','industry','phone',
  'commit','saved_at','save_count','last_editor','is_site','published','verified',
  'hero_url','banner_url','logo_url','team_url','default_subdomain','site_id','domain',
  'custom_domain','color_mode','created_at','updated_at','editor_id','claimed_by',
  'claimed_at','claim_source','archived',
]);
// ❗ Do NOT add non-existent columns like camelCase `pages`, `headerBlock`, `footerBlock` at the top level.

function coerceEmptyToNull(v: unknown) {
  return typeof v === 'string' && v.trim() === '' ? null : v;
}
const UUID_KEYS = new Set(['site_id','editor_id','claimed_by']);

const isHeader = (b: any) => b?.type === 'header';
const isFooter = (b: any) => b?.type === 'footer';

function stripHeaderFooterFromPage(page: any) {
  const blocks = Array.isArray(page?.content_blocks) ? page.content_blocks : [];
  return {
    ...page,
    content_blocks: blocks.filter((b: any) => !isHeader(b) && !isFooter(b)),
  };
}

/**
 * Prepare a template object for saving:
 * - Copies only approved top-level scalar fields
 * - Normalizes .data.pages and hoists/derives header/footer
 * - Stores header/footer inside data for the editor
 * - Returns { db, header_block, footer_block } where `db` is the payload you
 *   typically pass to your save action, and header/footer snake_case snapshots
 *   are provided if you want to persist them as columns.
 */
export function prepareTemplateForSave(fullTemplate: Record<string, any>) {
  const db: Record<string, any> = {};

  // color_mode precedence (no default invented)
  const incomingMode = (fullTemplate?.color_mode ?? fullTemplate?.data?.color_mode) as
    | 'light' | 'dark' | undefined;

  // copy approved top-level scalars only
  for (const [k, v] of Object.entries(fullTemplate)) {
    if (!DB_FIELD_NAMES.has(k)) continue;
    db[k] = UUID_KEYS.has(k) ? coerceEmptyToNull(v) : v;
  }
  if (incomingMode === 'light' || incomingMode === 'dark') {
    db.color_mode = incomingMode;
  } else if ('color_mode' in db && (db.color_mode == null)) {
    delete db.color_mode;
  }

  // start from .data clone
  const fromData =
    fullTemplate && typeof fullTemplate.data === 'object' && fullTemplate.data
      ? structuredClone(fullTemplate.data)
      : {};

  // choose source pages (top-level if provided, else data.pages)
  const topPages = Array.isArray(fullTemplate.pages) ? fullTemplate.pages : undefined;
  const dataPages = Array.isArray((fromData as any).pages) ? (fromData as any).pages : undefined;
  const rawPages: any[] = (topPages && topPages.length > 0) ? topPages : (dataPages ?? []);

  // determine header/footer (prefer explicit in data, then top-level, then hoist from first page)
  let headerBlock =
    (fullTemplate.data as any)?.headerBlock ??
    fullTemplate.headerBlock ??
    null;

  let footerBlock =
    (fullTemplate.data as any)?.footerBlock ??
    fullTemplate.footerBlock ??
    null;

  if ((!headerBlock || !footerBlock) && rawPages.length > 0) {
    const firstBlocks = Array.isArray(rawPages[0]?.content_blocks) ? rawPages[0].content_blocks : [];
    if (!headerBlock) headerBlock = firstBlocks.find(isHeader) ?? null;
    if (!footerBlock) footerBlock = firstBlocks.find(isFooter) ?? null;
  }

  // strip header/footer from page bodies
  const cleanedPages = rawPages.map(stripHeaderFooterFromPage);

  // write only into data (no db.pages)
  (fromData as any).pages = cleanedPages;

  // persist chrome INSIDE data; omit keys if not present
  if (headerBlock) (fromData as any).headerBlock = headerBlock; else delete (fromData as any).headerBlock;
  if (footerBlock) (fromData as any).footerBlock = footerBlock; else delete (fromData as any).footerBlock;

  // merge top-level meta override if provided
  if (fullTemplate.meta) (fromData as any).meta = fullTemplate.meta;

  // if top-level color_mode missing, allow nested one to carry through
  if (!(incomingMode === 'light' || incomingMode === 'dark')) {
    const nested = (fromData as any)?.color_mode;
    if (nested === 'light' || nested === 'dark') db.color_mode = nested;
  }

  db.data = fromData;

  // debug
  console.debug('[prepareTemplateForSave] color_mode out:', db.color_mode);
  console.debug('[prepareTemplateForSave] pages out:', Array.isArray(db.data?.pages) ? db.data.pages.length : 0);
  console.debug('[prepareTemplateForSave] header/footer present in data:', !!db.data?.headerBlock, !!db.data?.footerBlock);

  // Provide snake_case snapshots for callers that store columns:
  const header_block = headerBlock ?? null;
  const footer_block = footerBlock ?? null;

  return { db, header_block, footer_block };
}
