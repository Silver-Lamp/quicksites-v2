// types/blocks.ts

// Base shared fields
export type BaseBlock = {
  _id?: string;
  tone?: string;
  industry?: string;
  tags?: string[];
  meta?: Record<string, any>;
};

// Individual blocks
type BlockContent = {
  text: { value: string };
  image: { url: string; alt: string };
  video: { url: string; caption?: string };
  audio: { url: string; title?: string; provider?: 'spotify' | 'soundcloud' | 'suno' };
  quote: { text: string; attribution?: string };
  button: { label: string; href: string; style?: 'primary' | 'secondary' | 'ghost' };
  grid: { columns: number; items: Block[] };
  hero: {
    headline: string;
    subheadline?: string;
    cta_text?: string;
    cta_link?: string;
    image_url?: string;
    layout_mode?: 'inline' | 'background' | 'full_bleed';
    blur_amount?: number;
    parallax_enabled?: boolean;
    image_position?: 'top' | 'center' | 'bottom';
    image_x?: number;
    image_y?: number;
  };
  services: { title?: string; subtitle?: string; items: string[] };
  faq: { title?: string; subtitle?: string; items: { question: string; answer: string }[]; layout?: 'list' | 'accordion' };
  cta: { label: string; link: string; appearance?: 'button' | 'link' };
  testimonial: {
    testimonials: { quote: string; attribution?: string; avatar_url?: string; rating?: number }[];
    randomized?: boolean;
    layout?: 'list' | 'carousel';
  };
  footer: {
    businessName: string;
    address: string;
    cityState: string;
    phone: string;
    links: { label: string; href: string }[];
    logo_url?: string;
    social_links?: { platform: string; url: string }[];
    copyright?: string;
  };
  service_areas: {
    title?: string;
    subtitle?: string;
    cities: string[];
    allCities?: string[];
    sourceLat?: number;
    sourceLng?: number;
    radiusMiles?: number;
  };
  header: { logoUrl?: string; navItems: { label: string; href: string }[] };
  contact_form: { title: string; notification_email: string };
};

export type BlockType = keyof BlockContent;
export const BLOCK_TYPES = Object.keys({
  text: true, image: true, video: true, audio: true, quote: true,
  button: true, grid: true, hero: true, services: true, faq: true,
  cta: true, testimonial: true, footer: true, service_areas: true,
  header: true, contact_form: true,
}) as BlockType[];

export type BlockCategory = 'layout' | 'content' | 'interactive' | 'meta';

export type Block = BaseBlock & {
  type: BlockType;
  content: BlockContent[BlockType];
};

export type BlockWithId = Block & { _id: string };

export function normalizeBlock(block: Partial<Block>): BlockWithId {
  return {
    ...block,
    _id: block._id ?? crypto.randomUUID(),
  } as BlockWithId;
}

export type BlockRegistryEntry = {
  type: BlockType;
  label: string;
  icon?: string;
  category: BlockCategory;
  isStatic?: boolean;
};

export const BLOCK_METADATA: BlockRegistryEntry[] = [
  { type: 'text', label: 'Text', icon: '📝', category: 'content' },
  { type: 'image', label: 'Image', icon: '🖼️', category: 'content' },
  { type: 'video', label: 'Video', icon: '🎥', category: 'content' },
  { type: 'audio', label: 'Audio', icon: '🎧', category: 'content' },
  { type: 'quote', label: 'Quote', icon: '❝', category: 'content' },
  { type: 'button', label: 'Button', icon: '🔘', category: 'interactive' },
  { type: 'grid', label: 'Grid Layout', icon: '🔲', category: 'layout' },
  { type: 'hero', label: 'Hero Section', icon: '🌄', category: 'layout', isStatic: true },
  { type: 'services', label: 'Services List', icon: '🛠️', category: 'content' },
  { type: 'faq', label: 'FAQs', icon: '❓', category: 'interactive' },
  { type: 'cta', label: 'Call to Action', icon: '📣', category: 'interactive' },
  { type: 'testimonial', label: 'Testimonials', icon: '💬', category: 'interactive' },
  { type: 'footer', label: 'Footer', icon: '⬇️', category: 'meta' },
  { type: 'service_areas', label: 'Service Areas', icon: '📍', category: 'meta' },
  { type: 'header', label: 'Header', icon: '⬆️', category: 'meta' },
  { type: 'contact_form', label: 'Contact Form', icon: '📩', category: 'interactive' },
];
