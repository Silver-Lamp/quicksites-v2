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
  site_id: z.string().optional(),
  name: z.string(),
  layout: z.string(),
  color_scheme: z.string(),
  industry: z.string(),
  theme: z.string(),

  headline: z.string().optional(),
  description: z.string().optional(),
  hero_url: z.string().optional(),
  banner_url: z.string().optional(),
  logo_url: z.string().optional(),
  team_url: z.string().optional(),

  data: TemplateDataSchema,
  updated_at: z.string().optional(),
});
export type ValidatedTemplate = z.infer<typeof TemplateSaveSchema>;
