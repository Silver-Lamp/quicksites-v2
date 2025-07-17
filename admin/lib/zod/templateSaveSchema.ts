// admin/lib/zod/templateSaveSchema.ts
import { z } from 'zod';
import { BlockSchema } from './blockSchema';

// Blocks
export type ValidatedBlock = z.infer<typeof BlockSchema>;

// Pages
export const PageSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  content_blocks: z.array(BlockSchema),
});
export type ValidatedPage = z.infer<typeof PageSchema>;

// TemplateData
export const TemplateDataSchema = z.object({
  pages: z.array(PageSchema),
});
export type ValidatedTemplateData = z.infer<typeof TemplateDataSchema>;

// Full Template
export const TemplateSaveSchema = z.object({
  id: z.string().optional(),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      message: 'Slug must be lowercase, alphanumeric, and hyphen-separated',
    }),
  site_id: z.string().optional(),
  template_name: z.string(),
  layout: z.string(),
  color_scheme: z.string(),
  industry: z.string(),
  theme: z.string(),
  is_site: z.boolean().optional(),
  published: z.boolean().optional(),
  headline: z.string().optional(),
  description: z.string().optional(),
  hero_url: z.string().nullable().optional(),
  banner_url: z.string().nullable().optional(),
  logo_url: z.string().nullable().optional(),
  team_url: z.string().nullable().optional(),
  data: TemplateDataSchema,
  updated_at: z.string().optional(),
});


export type ValidatedTemplate = z.infer<typeof TemplateSaveSchema>;
