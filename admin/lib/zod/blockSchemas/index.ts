import { z } from 'zod';
import { defineBlock } from './defineBlock';

// ─────────────────────────────────────
// 🔹 Block Schemas

export const HeroBlock = defineBlock({
  type: 'hero',
  content: {
    headline: z.string(),
    subheadline: z.string().optional(),
    cta_text: z.string().optional(),
    cta_link: z.string().optional(),
    image_url: z.string().url(),
    blur_amount: z.number().optional(),
    layout_mode: z.string().optional(),
    image_y: z.number().optional(),
    image_position: z.string().optional(),
    parallax_enabled: z.boolean().optional(),
    mobile_layout_mode: z.string().optional(),
    mobile_crop_behavior: z.string().optional(),
    mobile_crop_amount: z.number().optional(),
    mobile_crop_position: z.string().optional(),
    mobile_crop_focal_point: z.object({ x: z.number(), y: z.number() }).optional(),
    mobile_crop_focal_point_offset: z.object({ x: z.number(), y: z.number() }).optional(),
    mobile_crop_focal_point_offset_x: z.number().optional(),
    mobile_crop_focal_point_offset_y: z.number().optional(),
    mobile_crop_focal_point_offset_x_mobile: z.number().optional(),
    mobile_crop_focal_point_offset_y_mobile: z.number().optional(),
  },
  meta: {
    label: 'Hero Section',
    icon: '🌄',
    description: 'Banner with heading, subheading, image, and CTA.',
  },
});

export const TextBlock = defineBlock({
  type: 'text',
  content: {
    value: z.string().min(1),
  },
  meta: {
    label: 'Text',
    icon: '📝',
    description: 'Simple paragraph or message block.',
  },
});

export const QuoteBlock = defineBlock({
  type: 'quote',
  content: {
    text: z.string(),
    attribution: z.string().optional(),
  },
  meta: {
    label: 'Quote',
    icon: '❝',
    description: 'Stylized quote with optional attribution.',
  },
});

export const FAQBlock = defineBlock({
  type: 'faq',
  content: {
    title: z.string().optional(),
    subtitle: z.string().optional(),
    layout: z.enum(['list', 'accordion']).optional(),
    items: z.array(
      z.object({
        question: z.string(),
        answer: z.string(),
        appearance: z.string().optional(),
      })
    ),
  },
  meta: {
    label: 'FAQs',
    icon: '❓',
    description: 'Expandable accordion or flat list of common questions.',
  },
});

export const VideoBlock = defineBlock({
  type: 'video',
  content: {
    url: z.string(),
    caption: z.string().optional(),
  },
  meta: {
    label: 'Video',
    icon: '🎥',
    description: 'Embedded video with optional caption.',
  },
});

export const ImageBlock = defineBlock({
  type: 'image',
  content: {
    url: z.string(),
    alt: z.string(),
  },
  meta: {
    label: 'Image',
    icon: '🖼️',
    description: 'Displays a static image.',
  },
});

export const ButtonBlock = defineBlock({
  type: 'button',
  content: {
    label: z.string(),
    href: z.string(),
    style: z.enum(['primary', 'secondary', 'ghost']).optional(),
  },
  meta: {
    label: 'Button',
    icon: '🔘',
    description: 'Clickable button with optional style.',
  },
});

export const AudioBlock = defineBlock({
  type: 'audio',
  content: {
    url: z.string(),
    title: z.string().optional(),
    provider: z.enum(['spotify', 'soundcloud', 'suno']).optional(),
  },
  meta: {
    label: 'Audio',
    icon: '🎧',
    description: 'Embedded audio with optional provider and title.',
  },
});

export const CTA_Block = defineBlock({
  type: 'cta',
  content: {
    label: z.string(),
    link: z.string(),
    appearance: z.enum(['button', 'link']).optional(),
  },
  meta: {
    label: 'Call to Action',
    icon: '📣',
    description: 'Single CTA block with optional style.',
  },
});

export const TestimonialBlock = defineBlock({
  type: 'testimonial',
  content: {
    layout: z.enum(['list', 'carousel']).optional(),
    randomized: z.boolean().optional(),
    testimonials: z.array(
      z.object({
        quote: z.string(),
        attribution: z.string().optional(),
        image_url: z.string().optional(),
        rating: z.number().optional(),
      })
    ),
  },
  meta: {
    label: 'Testimonials',
    icon: '💬',
    description: 'List or carousel of client quotes and ratings.',
  },
});

export const ServicesBlock = defineBlock({
  type: 'services',
  content: {
    title: z.string().optional(),
    subtitle: z.string().optional(),
    items: z.array(z.string()),
  },
  meta: {
    label: 'Services',
    icon: '🛠️',
    description: 'Displays a list of services offered.',
  },
});

export const ServiceAreaBlock = defineBlock({
    type: 'service_areas',
    content: {
      title: z.string().optional(),
      subtitle: z.string().optional(),
      cities: z.array(z.string()),
      allCities: z.array(z.string()).optional(),
      sourceLat: z.number().nullable().optional(),
      sourceLng: z.number().nullable().optional(),
      radiusMiles: z.number().nullable().optional(),
    },
    meta: {
      label: 'Service Areas',
      icon: '📍',
      description: 'Geographic areas served.',
    },
  });
  
  
  

export const FooterBlock = defineBlock({
  type: 'footer',
  content: {
    business_name: z.string(),
    address: z.string(),
    cityState: z.string(),
    phone: z.string(),
    links: z.array(z.object({ label: z.string(), href: z.string(), appearance: z.string().optional() })),
    logo_url: z.string().optional(),
    social_links: z.array(z.object({ platform: z.string(), url: z.string() })).optional(),
    copyright: z.string().optional(),
  },
  meta: {
    label: 'Footer',
    icon: '⬇️',
    description: 'Footer with address, links, and branding.',
  },
});

export const HeaderBlock = defineBlock({
    type: 'header',
    content: {
      logo_url: z.string().optional(),
      nav_items: z.array(z.object({ label: z.string(), href: z.string(), appearance: z.string().optional() })),
    },
    meta: {
      label: 'Header',
      icon: '⬆️',
      description: 'Site navigation bar with logo and nav links.',
    },
  });
  

export const GridBlock = defineBlock({
  type: 'grid',
  content: {
    columns: z.number(),
    items: z.array(z.any()),
    title: z.string().optional(),
    subtitle: z.string().optional(),
    layout: z.string().optional(),
  },
  meta: {
    label: 'Grid Layout',
    icon: '🔲',
    description: 'Columns of blocks rendered in a row/column grid.',
  },
});

export const ContactFormBlock = defineBlock({
  type: 'contact_form',
  content: {
    title: z.string(),
    notification_email: z.string().email(),
  },
  meta: {
    label: 'Contact Form',
    icon: '📩',
    description: 'Contact submission form.',
  },
});

export const MealCardBlock = defineBlock({
  type: 'meal_card',
  content: {
    title: z.string(),
    chef_name: z.string(),
    price: z.string(),
    image_url: z.string().url(),
    description: z.string(),
    availability: z.string(),
    tags: z.array(z.string()).optional(),
    video_url: z.string().url().optional(),
  },
  meta: {
    label: 'Meal Card',
    icon: '🍽️',
    description: 'Structured meal listing with pricing and availability.',
  },
});

export const ChefProfileBlock = defineBlock({
  type: 'chef_profile',
  content: {
    name: z.string(),
    location: z.string().optional(),
    profile_image_url: z.string().url().optional(),
    video_url: z.string().url().optional(),
    bio: z.string().optional(),
    certifications: z.array(z.string()).optional(),
    meals: z
      .array(
        z.object({
          name: z.string(),
          description: z.string(),
          price: z.string(),
          availability: z.string().optional(),
          image_url: z.string().url().optional(),
        })
      )
      .optional(),
  },
  meta: {
    label: 'Chef Profile',
    icon: '👨‍🍳',
    description: 'Profile with bio, certifications, and meals.',
  },
});

// ─────────────────────────────────────
// ✅ Final Export

export const blockSchemas = {
  hero: HeroBlock,
  text: TextBlock,
  quote: QuoteBlock,
  faq: FAQBlock,
  video: VideoBlock,
  image: ImageBlock,
  button: ButtonBlock,
  audio: AudioBlock,
  cta: CTA_Block,
  testimonial: TestimonialBlock,
  services: ServicesBlock,
  service_areas: ServiceAreaBlock,
  footer: FooterBlock,
  header: HeaderBlock,
  grid: GridBlock,
  contact_form: ContactFormBlock,
  meal_card: MealCardBlock,
  chef_profile: ChefProfileBlock,
};

export const BlockSchema = z.discriminatedUnion(
  'type',
  Object.values(blockSchemas).map((b) => b.schema) as unknown as [
    z.ZodDiscriminatedUnionOption<'type'>,
    ...z.ZodDiscriminatedUnionOption<'type'>[]
  ]
);

export type ValidatedBlock = z.infer<typeof BlockSchema>;
