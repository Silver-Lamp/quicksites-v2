// lib/rebuild/assembleDraft.ts
//
// Turn a RebuildSpec (+ the scraped hero image) into a ready-to-insert QuickSites
// template payload. Reuses buildIndustryStarter for structure/theme, then injects
// the AI copy + hero the same way lib/builder/generateDemoSite.ts does — so a
// rebuilt draft opens in the editor as a working, on-brand site, not empty blocks.

import { buildIndustryStarter } from '@/lib/builder/industryScaffold';
import type { RebuildSpec } from '@/lib/rebuild/inferSiteSpec';

export type RebuildTemplate = {
  template_name: string;
  slug: string;
  color_mode: 'light' | 'dark';
  data: any;
  header_block: any;
  footer_block: any;
  industry: string;
  business_name: string;
};

function slugify(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48) || 'site';
}

function rand(): string {
  return Math.random().toString(36).slice(2, 7);
}

/** Assemble the template row payload for a rebuilt draft. Pure (no I/O). */
export function buildRebuildTemplate(opts: {
  spec: RebuildSpec;
  heroImage?: string | null;
  sourceUrl?: string | null;
}): RebuildTemplate {
  const { spec, heroImage, sourceUrl } = opts;

  const tpl: any = buildIndustryStarter({
    businessName: spec.businessName,
    industryKey: spec.industryKey,
  });

  // Inject AI copy + hero into the first (hero) block.
  const page = tpl.data?.pages?.[0];
  const hero = page?.blocks?.[0];
  if (hero?.content) {
    if (spec.headline) hero.content.headline = spec.headline;
    if (spec.subheadline) hero.content.subheadline = spec.subheadline;
    if (heroImage && Object.prototype.hasOwnProperty.call(hero.content, 'image_url')) {
      hero.content.image_url = heroImage;
    }
  }

  // If the AI reconstructed a real menu (restaurant conversion), replace the
  // scaffold's placeholder menu with it.
  if (spec.menu?.sections?.length) {
    const blocks: any[] = tpl.data?.pages?.[0]?.blocks ?? [];
    const menuBlock = blocks.find((b) => b?.type === 'menu');
    if (menuBlock?.content) {
      menuBlock.content.title = menuBlock.content.title || 'Our Menu';
      menuBlock.content.sections = spec.menu.sections.map((s) => ({
        name: s.name,
        description: '',
        items: s.items.map((it) => ({
          name: it.name,
          description: it.description ?? '',
          price: it.price ?? '',
          tags: [],
        })),
      }));
    }
  }

  const services = spec.services.length ? spec.services : tpl.services;
  tpl.services = services;
  tpl.data.services = services;
  tpl.data.meta = {
    ...(tpl.data.meta ?? {}),
    business_name: spec.businessName,
    about: spec.about || null,
    services,
    faqs: spec.faqs ?? [],
    // Provenance: mark this as a rebuild + where it came from (useful for the
    // editor banner + analytics; harmless to the renderer).
    rebuilt_from: sourceUrl || null,
    rebuild_source: 'ai_rebuild',
  };

  return {
    template_name: spec.businessName,
    slug: `${slugify(spec.businessName)}-${rand()}`,
    color_mode: (tpl.color_mode ?? 'light') as 'light' | 'dark',
    data: tpl.data,
    header_block: tpl.data?.headerBlock ?? null,
    footer_block: tpl.data?.footerBlock ?? null,
    industry: spec.industryKey,
    business_name: spec.businessName,
  };
}
