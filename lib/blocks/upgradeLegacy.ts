// props -> content upgrader + hero key mapping + safe defaults (isomorphic)
type AnyBlock = { type?: string; props?: any; content?: any; [k: string]: any };
type AnyPage  = { content_blocks?: AnyBlock[]; [k: string]: any };
type DataLike = { pages?: AnyPage[]; [k: string]: any };

function ensureHeroDefaults(c: Record<string, any>) {
  if (!c.headline) c.headline = 'Welcome';
  if (!('subheadline' in c)) c.subheadline = '';
  if (!('cta_text' in c)) c.cta_text = 'Get Started';
  if (!('cta_link' in c)) c.cta_link = '/contact';
  if (!c.layout_mode) c.layout_mode = 'inline';
  if (!c.image_position) c.image_position = 'center';
  if (typeof c.blur_amount !== 'number') c.blur_amount = 8;
  if (typeof c.parallax_enabled !== 'boolean') c.parallax_enabled = false;
  if (!c.mobile_layout_mode) c.mobile_layout_mode = 'inline';
  if (!c.mobile_crop_behavior) c.mobile_crop_behavior = 'cover';
}

function upgradeOneBlock(b: AnyBlock): AnyBlock {
  if (!b || typeof b !== 'object') return b;

  // props → content
  if ('props' in b && !('content' in b)) {
    const { props, ...rest } = b;
    b = { ...rest, content: props || {} };
  } else {
    b.content = b.content ?? {};
  }

  // drop noisy block-level industry
  if ('industry' in b) delete (b as any).industry;

  // HERO legacy keys → schema
  if ((b.type || '').toLowerCase() === 'hero') {
    const c = b.content as Record<string, any>;
    if ('heading' in c && !('headline' in c)) c.headline = c.heading;
    if ('subheading' in c && !('subheadline' in c)) c.subheadline = c.subheading;
    if ('ctaLabel' in c && !('cta_text' in c)) c.cta_text = c.ctaLabel;
    if ('ctaHref' in c && !('cta_link' in c)) c.cta_link = c.ctaHref;
    if ('heroImage' in c && !('image_url' in c)) c.image_url = c.heroImage;

    if ('imagePosition' in c && !('image_position' in c)) c.image_position = c.imagePosition;
    if ('layoutMode' in c && !('layout_mode' in c)) c.layout_mode = c.layoutMode;

    delete c.heading; delete c.subheading; delete c.ctaLabel; delete c.ctaHref; delete c.heroImage;
    delete c.imagePosition; delete c.layoutMode;

    ensureHeroDefaults(c);
  }

  return b;
}

export function upgradeLegacyBlocksDeep(data: any): DataLike {
  const d: DataLike = typeof data === 'string'
    ? (() => { try { return JSON.parse(data); } catch { return {}; } })()
    : (data || {});
  const pages = Array.isArray(d.pages) ? d.pages : [];
  for (const p of pages) {
    if (!Array.isArray(p.content_blocks)) continue;
    p.content_blocks = p.content_blocks.map(upgradeOneBlock);
  }
  return d;
}
