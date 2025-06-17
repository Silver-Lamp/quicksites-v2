// ✅ types/site.ts

// Block Types
export type HeroBlock = {
  _id: string;
  type: 'hero';
  content: {
    headline: string;
    subheadline?: string;
    cta_text?: string;
    cta_link?: string;
  };
};

export type ServicesBlock = {
  _id: string;
  type: 'services';
  content: {
    items: string[];
  };
};

export type TestimonialBlock = {
  _id: string;
  type: 'testimonial';
  content: {
    quote: string;
    attribution?: string;
  };
};

// TODO: Add more blocks like text, cta, quote
export type ContentBlock = HeroBlock | ServicesBlock | TestimonialBlock;

export type Page = {
  id: string;
  slug: string;
  content_blocks: ContentBlock[];
};

export type SiteMeta = {
  id: string;
  slug: string;
  domain: string;
};

// ✅ Full shape used in EditPage
export type SiteData = {
  slug: string; // used for viewing and editing
  is_published: boolean;
  pages: Page[];
  _meta: SiteMeta;
  seo_title?: string;
  seo_description?: string;
  twitter_handle?: string;
  site_name?: string;
  business_name?: string;
  location?: string;
  color_scheme?: string;
  custom_domain?: string;
  published?: boolean;
  created_at?: string;
  updated_at?: string;
};
