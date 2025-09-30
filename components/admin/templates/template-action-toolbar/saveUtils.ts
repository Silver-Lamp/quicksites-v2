import type { Template } from '@/types/template';

/* --------------------------- basic helpers --------------------------- */
export function getTemplatePagesLoose(t: Template): any[] {
  const d: any = t ?? {};
  if (Array.isArray(d?.data?.pages)) return d.data.pages;
  if (Array.isArray(d?.pages)) return d.pages;
  return [];
}

export function withPages(t: Template, pages: any[]): Template {
  const anyT: any = t ?? {};
  if (Array.isArray(anyT?.data?.pages)) return { ...anyT, data: { ...anyT.data, pages } } as Template;
  return { ...anyT, pages } as Template;
}

export function pretty(next: Template) {
  try { return JSON.stringify(next?.data ?? next, null, 2); }
  catch { return JSON.stringify(next, null, 2); }
}

export function baseSlug(slug?: string | null) {
  if (!slug) return '';
  return slug.replace(/(-[a-z0-9]{2,12})+$/i, '');
}

export function toCacheRow(t: any) {
  return {
    id: t?.id,
    slug: t?.slug ?? null,
    template_name: t?.template_name ?? null,
    updated_at: t?.updated_at ?? new Date().toISOString(),
    color_mode: t?.color_mode ?? null,
    data: t?.data ?? {},
    header_block: t?.headerBlock ?? t?.data?.headerBlock ?? null,
    footer_block: t?.footerBlock ?? t?.data?.footerBlock ?? null,
  };
}

/* --------------------------- block normalizer --------------------------- */
export function normalizePageBlocksShape(pages: any[]): any[] {
  const isStr = (v: any) => typeof v === 'string' && v.trim().length > 0;

  const getCanonHero = (b: any) => ({
    heading: b?.props?.heading ?? b?.content?.headline ?? '',
    subheading: b?.props?.subheading ?? b?.content?.subheadline ?? '',
    cta: b?.props?.ctaLabel ?? b?.content?.cta_text ?? '',
  });
  const isDefaultHeading = (s: string) =>
    !isStr(s) || /^welcome to your new site$/i.test(s.trim());
  const heroScore = (b: any) => {
    if (!b || b.type !== 'hero') return 0;
    const c = getCanonHero(b);
    let s = 0;
    if (!isDefaultHeading(c.heading)) s += 3;
    if (isStr(c.subheading)) s += 1;
    if (isStr(c.cta)) s += 1;
    if (b?.props && b?.content) s += 1;
    return s;
  };
  const unifyHero = (b: any) => {
    if (!b || b.type !== 'hero') return b;
    const out: any = { ...b, props: { ...(b.props ?? {}) }, content: { ...(b.content ?? {}) } };

    const heading     = out.props.heading     ?? out.content.headline;
    const subheading  = out.props.subheading  ?? out.content.subheadline;
    const ctaLabel    = out.props.ctaLabel    ?? out.content.cta_text;

    let ctaHref = out.props.ctaHref;
    if (!ctaHref) {
      const act = out.content.cta_action ?? 'go_to_page';
      if (act === 'go_to_page') ctaHref = out.content.cta_link || '/contact';
      else if (act === 'jump_to_contact') ctaHref = `#${String(out.content.contact_anchor_id || 'contact').replace(/^#/, '')}`;
      else if (act === 'call_phone') ctaHref = `tel:${(out.content.cta_phone || '').replace(/\D/g, '')}`;
      else ctaHref = '/contact';
    }

    const heroImage   = out.props.heroImage   ?? out.content.image_url;
    const blur        = (typeof out.props.blur_amount === 'number' ? out.props.blur_amount : out.content.blur_amount) ?? 0;
    const pos         = out.props.image_position ?? out.content.image_position ?? 'center';
    const layout      = out.props.layout_mode ?? out.content.layout_mode ?? 'inline';

    out.props = {
      ...out.props,
      heading, subheading, ctaLabel, ctaHref,
      heroImage,
      blur_amount: blur,
      image_position: pos,
      layout_mode: layout,
    };
    out.content = {
      ...out.content,
      headline: heading,
      subheadline: subheading,
      cta_text: ctaLabel,
      image_url: heroImage,
      blur_amount: blur,
      image_position: pos,
      layout_mode: layout,
    };
    return out;
  };

  const TEXT_LIKE = new Set(['text','rich_text','richtext','richText','paragraph','markdown','textarea','wysiwyg']);
  const isTextLike = (b: any) => TEXT_LIKE.has(String(b?.type || '').toLowerCase());

  const textScore = (b: any) => {
    if (!isTextLike(b)) return -1;
    const p = b?.props ?? {};
    const c = b?.content ?? {};
    const vals = [p.html, p.text, p.value, c.html, c.text, c.value];
    return vals.reduce((s, v) => s + (typeof v === 'string' ? v.trim().length : 0), 0);
  };

  const mirrorText = (b: any) => {
    if (!isTextLike(b)) return b;
    const out: any = { ...b, props: { ...(b.props ?? {}) }, content: { ...(b.content ?? {}) } };
    const p = out.props, c = out.content;
    const chosen =
      (typeof p.html === 'string' && p.html.trim()) ||
      (typeof p.text === 'string' && p.text.trim()) ||
      (typeof p.value === 'string' && p.value.trim()) ||
      (typeof c.html === 'string' && c.html.trim()) ||
      (typeof c.text === 'string' && c.text.trim()) ||
      (typeof c.value === 'string' && c.value.trim()) || '';
    p.html = p.html?.trim() ? p.html : chosen;
    p.text = p.text?.trim() ? p.text : chosen.replace(/<[^>]+>/g, '');
    p.value = p.value?.trim() ? p.value : chosen;

    c.html = c.html?.trim() ? c.html : chosen;
    c.text = c.text?.trim() ? c.text : chosen.replace(/<[^>]+>/g, '');
    c.value = c.value?.trim() ? c.value : chosen;

    if (!c.format) c.format = 'html';
    return out;
  };

  const chooseById = (a: any, b: any) => {
    if (!a) return b;
    if (!b) return a;
    if (isTextLike(a) || isTextLike(b)) {
      const aa = mirrorText(a);
      const bb = mirrorText(b);
      const sa = textScore(aa);
      const sb = textScore(bb);
      return sb > sa ? bb : aa;
    }
    if (a.type === 'hero' || b.type === 'hero') {
      const sa = heroScore(a), sb = heroScore(b);
      if (sa !== sb) return sa > sb ? a : b;
    }
    return b;
  };

  return (pages || []).map((p: any) => {
    const all: any[] = [
      ...(Array.isArray(p?.blocks) ? p.blocks : []),
      ...(Array.isArray(p?.content_blocks) ? p.content_blocks : []),
      ...(Array.isArray(p?.content?.blocks) ? p.content.blocks : []),
    ];
    if (all.length === 0) return p;

    const byId = new Map<string, any>();
    for (const b of all) {
      if (!b) continue;
      const id = String(b?._id ?? b?.id ?? '');
      if (!id) continue;
      const cur = byId.get(id);
      byId.set(id, chooseById(cur, b));
    }

    let keep: any[] = Array.from(byId.values());

    const heroCandidates = keep.filter((b) => b?.type === 'hero');
    if (heroCandidates.length > 1) {
      const best = heroCandidates.reduce((best, b) => (heroScore(b) > heroScore(best) ? b : best), heroCandidates[0]);
      keep = keep.filter((b) => b?.type !== 'hero');
      keep.splice(0, 0, unifyHero(best));
    } else {
      keep = keep.map((b) => (b?.type === 'hero' ? unifyHero(b) : b));
    }

    keep = keep.map((b) => (isTextLike(b) ? mirrorText(b) : b));

    const next: any = { ...p };
    next.blocks = keep;
    if (Array.isArray(p?.content_blocks)) next.content_blocks = keep;
    if (p?.content && typeof p.content === 'object') next.content = { ...p.content, blocks: keep };
    return next;
  });
}
