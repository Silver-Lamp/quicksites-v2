// Base type for shared props
export type BaseBlock = {
  _id?: string;
  tone?: string;
  industry?: string;
  tags?: string[];
  meta?: Record<string, any>;
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
    layout_mode?: 'inline' | 'background' | 'full_bleed';
    blur_amount?: number;
    parallax_enabled?: boolean;
    image_position?: 'top' | 'center' | 'bottom';
    image_x?: number;
    image_y?: number;
  };
};

export type ServicesBlock = BaseBlock & {
  type: 'services';
  content: {
    title?: string;
    subtitle?: string;
    items: string[];
  };
};

export type FAQBlock = BaseBlock & {
  type: 'faq';
  content: {
    title?: string;
    subtitle?: string;
    items: {
      question: string;
      answer: string;
    }[];
    layout?: 'list' | 'accordion';
  };
};

export type CtaBlock = BaseBlock & {
  type: 'cta';
  content: {
    label: string;
    link: string;
    appearance?: 'button' | 'link';
  };
};

export type TestimonialBlock = BaseBlock & {
  type: 'testimonial';
  content: {
    testimonials: {
      quote: string;
      attribution?: string;
      avatar_url?: string;
      rating?: number;
    }[];
    randomized?: boolean;
    layout?: 'list' | 'carousel';
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
    logo_url?: string;
    social_links?: {
      platform: string;
      url: string;
    }[];
    copyright?: string;
  };
};

export type ServiceAreaBlock = BaseBlock & {
  type: 'service_areas';
  content: {
    title?: string;
    subtitle?: string;
    cities: string[];
    allCities?: string[];
    sourceLat?: number;
    sourceLng?: number;
    radiusMiles?: number;
  };
};

export type HeaderBlock = BaseBlock & {
  type: 'header';
  content: {
    logoUrl?: string;
    navItems: { label: string; href: string }[];
  };
};

export type ContactFormBlock = BaseBlock & {
  type: 'contact_form';
  content: {
    title: string;
    notificationEmail: string;
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
  | FooterBlock
  | ServiceAreaBlock
  | HeaderBlock
  | FAQBlock
  | ContactFormBlock;

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

// Dev: mock content helpers
export function generateMockTestimonial(): TestimonialBlock['content']['testimonials'][0] {
  const quotes = [
    'Absolutely fantastic service!',
    'They went above and beyond!',
    'Fast, friendly, and reliable.',
    'I highly recommend them!',
    'Saved me in a pinch. 10/10.',
  ];
  const names = ['Jane D.', 'John S.', 'Emily R.', 'Carlos M.', 'Tina K.'];
  return {
    quote: quotes[Math.floor(Math.random() * quotes.length)],
    attribution: names[Math.floor(Math.random() * names.length)],
    rating: Math.ceil(Math.random() * 5),
    avatar_url: `https://i.pravatar.cc/150?img=${Math.ceil(Math.random() * 70)}`,
  };
}

export function generateMockHero(): HeroBlock['content'] {
  return {
    headline: 'Your Local Experts in Towing & Recovery',
    subheadline: 'Here when you need us — day or night.',
    cta_text: 'Get Help Now',
    cta_link: '/contact',
    image_url: 'https://source.unsplash.com/featured/?towtruck',
    layout_mode: 'background',
  };
}

export function generateMockFooter(): FooterBlock['content'] {
  return {
    businessName: 'QuickTow Services',
    address: '123 Main Street',
    cityState: 'Anytown, USA',
    phone: '(555) 123-4567',
    links: [
      { label: 'Home', href: '/' },
      { label: 'Services', href: '/services' },
      { label: 'Contact', href: '/contact' },
    ],
    logo_url: 'https://placehold.co/100x40?text=Logo',
    social_links: [
      { platform: 'Facebook', url: 'https://facebook.com' },
      { platform: 'Instagram', url: 'https://instagram.com' },
    ],
  };
}

export function generateMockServices(): ServicesBlock['content'] {
  const presets: Record<string, string[]> = {
    towing: ['24/7 Emergency Towing', 'Roadside Assistance', 'Flatbed Towing', 'Battery Jumpstart', 'Vehicle Lockout'],
    plumbing: [
      'Leak Detection',
      'Pipe Repairs',
      'Drain Cleaning',
      'Water Heater Installation',
      'Emergency Plumbing',
    ],
    it: [
      'Network Setup',
      'Cybersecurity Audits',
      'Cloud Migration',
      'IT Support & Helpdesk',
      'Software Deployment',
    ],
  };
  const items = Object.values(presets).flat();
  return {
    items,
  };
}

export function generateMockFAQ(): FAQBlock['content'] {
    const title = "Frequently Asked Questions";
    const subtitle = "We're here to help you with all your towing and roadside assistance needs.";
    const items = [
      {
        question: 'How quickly can you arrive?',
        answer: "We usually arrive within 30 minutes in Grafton and nearby areas.",
      },
      {
        question: 'Do you offer 24/7 service?',
        answer: "Yes, we're available 24/7 for all towing and roadside assistance needs.",
      },
      {
        question: 'What forms of payment do you accept?',
        answer: "We accept all major credit cards, cash, and digital payments.",
      },
      {
        question: 'Are you licensed and insured?',
        answer: "Yes, we're fully licensed and insured for your peace of mind.",
      },
    ];
    return {
      title,
      subtitle,
      items,
      layout: 'accordion',
    };  
}
export function generateMockContactForm(): ContactFormBlock['content'] {
  return {
    title: 'Contact Us',
    notificationEmail: 'info@quicktowservices.com',
  };
}