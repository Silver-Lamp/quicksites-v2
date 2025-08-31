// lib/createTemplateFromPresetWithBlocks.ts
import { makeDefaultBlock, validateBlock } from '@/lib/blockRegistry.core';
import type { Block, SeedContext } from '@/types/blocks';
import { templateDefaults } from '@/lib/templateDefaults';
import { createDefaultPage } from '@/lib/pageDefaults';
import {
  TemplateSaveSchema,
  type ValidatedTemplate,
  type ValidatedPage,
} from '@/admin/lib/zod/templateSaveSchema';
import { generateUniqueTemplateName } from './utils/slug';

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').trim();
}

export const templatePresets = {
  Towing: ['hero', 'services', 'testimonial', 'cta'],
  Bakery: ['hero', 'image', 'quote', 'button'],
  Agency: ['hero', 'video', 'quote', 'grid'],
} as const;

export function createTemplateFromPresetWithBlocks(
  industry: keyof typeof templatePresets
): ValidatedTemplate {
  const template_name = generateUniqueTemplateName(industry);
  const slug = slugify(template_name);

  // default-only context is fine for presets
  const ctx: Partial<SeedContext> = {};

  const blocks = templatePresets[industry]
    .map((t) => makeDefaultBlock(t, ctx))
    .filter(Boolean) as Block[];

  const checked = blocks.map((b) => {
    const v = validateBlock(b);
    return v.ok ? v.value : b;
  });

  // derive services[] for the template (schema requires it)
  const servicesFromBlocks =
    checked
      .filter((b) => b.type === 'services')
      .flatMap((b) => {
        const items = (b as any)?.props?.items;
        return Array.isArray(items) ? items.map((i: any) => i?.name).filter(Boolean) : [];
      }) ?? [];

  const page: ValidatedPage = createDefaultPage({
    title: `${industry} Site`,
    slug: 'index',
    show_header: true,
    show_footer: true,
    content_blocks: checked,
  });

  // Build the template object with explicit schema-required keys
  const draft = {
    // bring in your standard defaults (ids/branding/etc)
    ...templateDefaults,

    // required by schema:
    id: '',
    template_name,
    industry: String(industry),
    slug,

    // ensure these exist even if templateDefaults is loosely typed
    layout: (templateDefaults as any).layout ?? 'standard',
    color_scheme: (templateDefaults as any).color_scheme ?? 'neutral',
    color_mode: (templateDefaults as any).color_mode ?? 'light',
    theme: (templateDefaults as any).theme ?? 'default',
    services: servicesFromBlocks,

    pages: [page],
  };

  // Runtime + type-level validation; returns ValidatedTemplate
  return TemplateSaveSchema.parse(draft);
}
