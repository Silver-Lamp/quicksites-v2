// types/template.ts

import type { Block } from './block';

export type Page = {
  id: string;
  slug: string;
  title: string;
  content_blocks: Block[];
};

export type Template = {
  // Core fields
  id?: string;
  site_id?: string;
  name: string; // unified from template_name
  layout: string;
  color_scheme: string;
  commit: string;
  industry: string;
  theme: string;
  brand: string;

  // Optional URL fields for assets
  hero_url?: string;
  banner_url?: string;
  logo_url?: string;
  team_url?: string;

  // Content
  data: {
    pages: Page[];
  };

  // Optional database metadata
  created_at?: string; // or Date
  updated_at?: string; // or Date
  domain?: string | null;
  published?: boolean;
  custom_domain?: string | null;
};
