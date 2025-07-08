// types/template.ts
import type { Block } from './blocks.js';

export type Page = {
  id: string;
  slug: string;
  title: string;
  content_blocks: Block[];
};

export type TemplateData = {
  pages: Page[];
};

export type Template = {
  id?: string;
  site_id?: string;
  name: string;
  layout: string;
  color_scheme: string;
  commit: string;
  industry: string;
  theme: string;
  brand: string;
  headline?: string;
  description?: string;
  hero_url?: string;
  banner_url?: string;
  logo_url?: string;
  team_url?: string;

  data: TemplateData;

  created_at?: string;
  updated_at?: string;
  domain?: string | null;
  published?: boolean;
  custom_domain?: string | null;
  name_exists?: boolean;
  show_name_error?: boolean;
  slug?: string;
  slug_preview?: string;
  input_value?: string;
  is_renaming?: boolean;
  is_creating?: boolean;
  autosave_status?: string;
  autosave_error?: string;
  autosave_message?: string;
  autosave_timestamp?: string;
};

export type Snapshot = {
  id: string;
  template_name: string;
  layout: string;
  color_scheme: string;
  theme: string;
  brand: string;
  data: TemplateData;
};

export type TemplateSnapshot = Snapshot;

export type Theme = 'light' | 'dark';
export type Brand = 'green' | 'blue' | 'purple' | 'red' | 'orange'; // Add whatever variants you support
