// types/blocks.ts
// Core block typing
export type BlockType = keyof typeof BlockContentMap;
export type BlockCategory = 'layout' | 'content' | 'interactive' | 'meta';

export type BaseBlock = {
  _id?: string;
  tone?: string;
  industry?: string;
  tags?: string[];
  meta?: Record<string, any>;
};

export const BlockContentMap = {
  text: { value: '' },
  image: { url: '', alt: '' },
  video: { url: '', caption: '' },
  audio: { url: '', title: '', provider: 'suno' },
  quote: { text: '', attribution: '' },
  button: { label: '', href: '', style: 'primary' },
  grid: { columns: 1, items: [] },
  hero: {
    headline: '',
    subheadline: '',
    cta_text: '',
    cta_link: '',
    image_url: '',
    layout_mode: 'inline',
    blur_amount: 0,
    image_position: 'center',
    parallax_enabled: false,
    mobile_layout_mode: 'inline',
    mobile_crop_behavior: 'cover',
    mobile_crop_amount: 0,
    mobile_crop_position: 'center',
    mobile_crop_focal_point: { x: 0.5, y: 0.5 },
    mobile_crop_focal_point_offset: { x: 0, y: 0 },
    mobile_crop_focal_point_offset_x: 0,
    mobile_crop_focal_point_offset_y: 0,
    mobile_crop_focal_point_offset_x_mobile: 0,
    mobile_crop_focal_point_offset_y_mobile: 0,
  },
  services: {
    title: 'Our Services',
    subtitle: 'What we offer',
    items: ['Towing', 'Roadside Assistance', 'Jump Starts'],
  },  
  faq: { title: '', subtitle: '', items: [{ question: '', answer: '', appearance: 'default' }], layout: 'accordion' },
  cta: { label: '', link: '', appearance: 'button' },
  testimonial: {
    testimonials: [{ quote: '', attribution: '', image_url: '', rating: 0 }],
    randomized: false,
    layout: 'list',
  },
  footer: {
    business_name: '',
    address: '',
    cityState: '',
    phone: '',
    links: [{ label: '', href: '', appearance: 'default' }],
  },
  service_areas: {
    cities: [{ name: '', address: '', radius_miles: 0 }],
    radius_miles: 0,
  },
  header: { logo_url: '', nav_items: [{ label: '', href: '', appearance: 'default' }] },
  contact_form: { title: '', notification_email: '' },
  meal_card: {
    title: '',
    chef_name: '',
    price: '',
    image_url: '',
    description: '',
    availability: '',
  },
  chef_profile: {
    name: '',
    location: '',
    profile_image_url: '',
    bio: '',
    certifications: [''],
    meals: [{ name: '', description: '', image_url: '', price: '', availability: '' }],
  },
} satisfies Record<string, any>;

export type Block = BaseBlock & {
  type: BlockType;
  content: (typeof BlockContentMap)[BlockType];
};

export type BlockWithId = Block & { _id: string };

export const BLOCK_METADATA = [
  { type: 'text', label: 'Text', icon: '📝', category: 'content' },
  { type: 'image', label: 'Image', icon: '🖼️', category: 'content' },
  { type: 'video', label: 'Video', icon: '🎥', category: 'content' },
  { type: 'audio', label: 'Audio', icon: '🎧', category: 'content' },
  { type: 'quote', label: 'Quote', icon: '❝', category: 'content' },
  { type: 'button', label: 'Button', icon: '🔘', category: 'interactive' },
  { type: 'grid', label: 'Grid Layout', icon: '🔲', category: 'layout' },
  { type: 'hero', label: 'Hero Section', icon: '🌄', category: 'layout' },
  { type: 'services', label: 'Services List', icon: '🛠️', category: 'content' },
  { type: 'faq', label: 'FAQs', icon: '❓', category: 'interactive' },
  { type: 'cta', label: 'Call to Action', icon: '📣', category: 'interactive' },
  { type: 'testimonial', label: 'Testimonials', icon: '💬', category: 'interactive' },
  { type: 'footer', label: 'Footer', icon: '⬇️', category: 'meta' },
  { type: 'service_areas', label: 'Service Areas', icon: '📍', category: 'meta' },
  { type: 'header', label: 'Header', icon: '⬆️', category: 'meta', isStatic: true },
  { type: 'contact_form', label: 'Contact Form', icon: '📩', category: 'interactive' },
  { type: 'meal_card', label: 'Meal Card', icon: '🍽️', category: 'content' },
  { type: 'chef_profile', label: 'Chef Profile', icon: '👨‍🍳', category: 'content' },
] as const;
