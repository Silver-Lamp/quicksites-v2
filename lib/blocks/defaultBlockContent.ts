// lib/blocks/defaultBlockContent.ts
import type { BlockType } from '@/types/blocks';

// Keep this aligned with the block types you actually support.
// If you add/remove a block type, update this object (or your BlockType union).
export const DEFAULT_BLOCK_CONTENT = {
  text: { value: 'Write something great…' },

  image: { url: 'https://placehold.co/800x400', alt: '' },

  video: { url: 'https://example.com/video.mp4', caption: '' },

  audio: { url: 'https://example.com/audio.mp3', title: '', provider: 'suno' },

  quote: { text: 'This changed everything.', attribution: 'Jane Doe' },

  button: { label: 'Click Me', href: '#', style: 'primary' },

  grid: {
    columns: 2,
    items: [],
    title: 'Grid',
    subtitle: '',
    layout: 'grid',
  },

  hero: {
    headline: 'Welcome to Your New Site',
    subheadline: 'Start editing, and let the magic happen.',
    cta_text: 'Get Started',
    cta_link: '#',
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

  faq: {
    title: 'Frequently Asked Questions',
    subtitle: '',
    items: [
      { question: 'How fast is your response time?', answer: 'Usually within 30 minutes.', appearance: 'default' },
    ],
    layout: 'accordion',
  },

  cta: {
    label: 'Call to Action',
    link: '#',
    appearance: 'button',
  },

  testimonial: {
    testimonials: [{ quote: 'They did a great job!', attribution: 'Happy Client', image_url: '', rating: 5 }],
    randomized: false,
    layout: 'list',
  },

  footer: {
    business_name: 'Your Business',
    address: '123 Main St',
    cityState: 'Anytown, ST',
    phone: '(123) 456-7890',
    links: [{ label: 'Home', href: '/', appearance: 'default' }],
  },

  service_areas: {
    cities: [{ name: 'Downtown', address: '', radius_miles: 0 }],
    radius_miles: 0,
  },

  header: {
    logo_url: '',
    nav_items: [
      { label: 'Home', href: '/', appearance: 'default' },
      { label: 'Services', href: '/services', appearance: 'default' },
      { label: 'Contact', href: '/contact', appearance: 'default' },
    ],
  },

  contact_form: {
    title: 'Contact Us',
    notification_email: 'you@example.com',
  },

  meal_card: {
    title: 'Meal Title',
    chef_name: 'Chef Name',
    price: '$10',
    image_url: 'https://placehold.co/800x400',
    description: 'A tasty thing.',
    availability: 'Available',
  },

  chef_profile: {
    name: 'John Doe',
    location: 'New York, NY',
    profile_image_url: 'https://placehold.co/200x200',
    bio: 'This is a bio',
    certifications: ['Certification A'],
    meals: [
      {
        name: 'Meal A',
        description: '',
        price: '$10',
        availability: 'Available',
        image_url: 'https://placehold.co/800x400',
      },
    ],
  },
} as const satisfies Record<BlockType, any>;
