// lib/debug/hero.ts
export const heroDebugKey = 'qs:debug:hero';

export function heroDbgOn(): boolean {
  try { return localStorage.getItem(heroDebugKey) === '1'; } catch { return false; }
}
export function setHeroDebug(on: boolean) {
  try { localStorage.setItem(heroDebugKey, on ? '1' : '0'); } catch {}
}

export function heroLog(label: string, obj?: any) {
  if (!heroDbgOn()) return;
  console.log(
    '%cQS/HERO%c ' + label,
    'background:#7c3aed;color:#fff;padding:2px 6px;border-radius:4px;',
    'color:#e5e7eb;', obj ?? ''
  );
}

/** Extract a compact view of hero blocks from a data/pages object */
export function pickHeroSnapshots(data: any) {
  const pages: any[] = Array.isArray(data?.pages) ? data.pages : [];
  const out: any[] = [];
  pages.forEach((p, i) => {
    const combos = [
      ...(Array.isArray(p?.blocks) ? p.blocks : []),
      ...(Array.isArray(p?.content_blocks) ? p.content_blocks : []),
      ...(Array.isArray(p?.content?.blocks) ? p.content.blocks : []),
    ];
    combos.filter((b: any) => b?.type === 'hero').forEach((b: any) => {
      const props = b?.props ?? {};
      const content = b?.content ?? {};
      out.push({
        pageIndex: i,
        id: b?._id ?? b?.id,
        industry: b?.industry,
        props: {
          heading: props?.heading, subheading: props?.subheading,
          ctaLabel: props?.ctaLabel, ctaHref: props?.ctaHref,
          heroImage: props?.heroImage
        },
        content: {
          headline: content?.headline, subheadline: content?.subheadline,
          cta_text: content?.cta_text, image_url: content?.image_url
        }
      });
    });
  });
  return out;
}
