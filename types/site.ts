// Block types

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
  
  // Add more types as needed...
  
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
  
  export type SiteData = {
    pages: Page[];
    _meta: SiteMeta;
  };
  