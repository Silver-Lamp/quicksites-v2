// Base type for shared props
export type BaseBlock = {
  _id?: string;
  tone?: string; // e.g. "professional", "casual", "friendly"
  industry?: string; // e.g. "technology", "finance", "healthcare"
  tags?: string[]; // e.g. ["technology", "finance", "healthcare"]
  meta?: Record<string, any>; // e.g. { "color": "blue", "size": "large" }
};

// Individual block definitions
export type TextBlock = BaseBlock & {
  type: 'text';
  content: {
    value: string;
  };
};

export type ImageBlock = BaseBlock & {
  type: 'image';
  content: {
    url: string;
    alt: string;
  };
};

export type VideoBlock = BaseBlock & {
  type: 'video';
  content: {
    url: string;
    caption?: string;
  };
};

export type AudioBlock = BaseBlock & {
  type: 'audio';
  content: {
    url: string;
    title?: string;
    provider?: 'spotify' | 'soundcloud' | 'suno';
  };
};

export type QuoteBlock = BaseBlock & {
  type: 'quote';
  content: {
    text: string;
    attribution?: string;
  };
};

export type ButtonBlock = BaseBlock & {
  type: 'button';
  content: {
    label: string;
    href: string;
    style?: 'primary' | 'secondary' | 'ghost';
  };
};

export type GridBlock = BaseBlock & {
  type: 'grid';
  content: {
    columns: number;
    items: Block[];
  };
};

export type HeroBlock = BaseBlock & {
  type: 'hero';
  content: {
    headline: string;
    subheadline?: string;
    cta_text?: string;
    cta_link?: string;
    image_url?: string;
  };
};

export type ServicesBlock = BaseBlock & {
  type: 'services';
  content: {
    items: string[];
  };
};

export type CtaBlock = BaseBlock & {
  type: 'cta';
  content: {
    label: string;
    link: string;
  };
};

export type TestimonialBlock = BaseBlock & {
  type: 'testimonial';
  content: {
    quote: string;
    attribution?: string;
  };
};

export type FooterBlock = BaseBlock & {
  type: 'footer';
  content: {
    businessName: string;
    address: string;
    cityState: string;
    phone: string;
    links: {
      label: string;
      href: string;
    }[];
  };
};

// Unified Block union
export type Block =
  | TextBlock
  | ImageBlock
  | VideoBlock
  | AudioBlock
  | QuoteBlock
  | ButtonBlock
  | GridBlock
  | HeroBlock
  | ServicesBlock
  | CtaBlock
  | TestimonialBlock
  | FooterBlock;

// Block with enforced _id
export type BlockWithId = Block & { _id: string };

// Normalization helper
export function normalizeBlock(block: Partial<Block>): BlockWithId {
  return {
    ...block,
    _id: block._id ?? crypto.randomUUID(),
  } as BlockWithId;
}

// Editor-related types
export type BlocksEditorProps = {
  blocks: Block[];
  onChange: (updated: Block[]) => void;
  industry?: string;
  onReplaceWithAI?: (index: number) => void;
  onEdit?: (index: number) => void;
};

export type BlockSidebarProps = {
  block: Block;
  onChange: (block: Block) => void;
  onClose: () => void;
};

export type BlockEditorModalProps = {
  block: Block;
  onSave: (updated: Block) => void;
  onClose: () => void;
};

export type ReorderableBlockListProps = {
  blocks: Block[];
  onBlockClick?: (block: Block) => void;
};

export type TemplatePageEditorProps = {
  pageIndex: number;
  blocks: Block[];
  onBlockChange: (pageIndex: number, updated: Block[]) => void;
};

// Optional: used in presets
export type PresetBlock = Record<string, any>;
export type PresetMap = Record<string, Record<string, PresetBlock>>;
