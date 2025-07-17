// types/template.ts
import { BlockValidationErrorMap } from '@/lib/validateBlock.js';
import type { Block } from './blocks.js';

export type Page = {
  id: string;
  slug: string;
  title: string;
  content_blocks: Block[];
  meta?: {
    title?: string;
    description?: string;
    visible?: boolean;
  };
};

export type TemplateData = {
  pages: Page[];
};

export type Snapshot = {
  id: string;
  template_name: string;
  layout: string;
  color_scheme: string;
  theme: string;
  brand: string;
  data: TemplateData;
  slug: string;
  industry: string;
  block_errors?: BlockValidationErrorMap;
  block_errors_map?: Record<string, string[]>;
  commit?: string;
  created_at?: string;
  updated_at?: string;
  domain?: string | null;
  published?: boolean;
  archived?: boolean;
  custom_domain?: string | null;
  name_exists?: boolean;
  show_name_error?: boolean;
  slug_preview?: string;
  input_value?: string;
  is_renaming?: boolean;
  is_creating?: boolean;
  autosave_status?: string;
  autosave_error?: string;
  autosave_message?: string;
  autosave_timestamp?: string;
  is_site?: boolean;
};

export type Template = Snapshot & {
  site_name?: string;
  template_name?: string;
  site_id?: string;
  headline?: string;
  description?: string;
  hero_url?: string;
  banner_url?: string;
  logo_url?: string;
  team_url?: string;
};

export type TemplateSnapshot = Snapshot;

export type Theme = 'light' | 'dark';
export type Brand = 'green' | 'blue' | 'purple' | 'red' | 'orange'; // Add whatever variants you support
