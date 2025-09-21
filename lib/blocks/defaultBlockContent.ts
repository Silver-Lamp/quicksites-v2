// lib/blocks/defaultBlockContent.ts
import type { BlockType } from '@/types/blocks';

const DUMMY_UUID = '00000000-0000-0000-0000-000000000000';

// Keep this aligned with the block types you actually support.
// If you add/remove a block type, update this object (or your BlockType union).
export const DEFAULT_BLOCK_CONTENT = {
  /* ───────── basic content ───────── */

  text: { value: '' },

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

  /* ───────── hero ───────── */

  hero: {
    headline: 'Welcome to Your New Site',
    subheadline: 'Start editing, and let the magic happen.',
    cta_text: 'Get Started',
    cta_link: '/',
    image_url: '',
    layout_mode: 'inline',
    blur_amount: 0,
    image_position: 'center',
    parallax_enabled: false,
    mobile_layout_mode: 'inline',
    mobile_crop_behavior: 'cover',
    // optional/mobile tuning fields (kept for forward-compat)
    mobile_crop_amount: 0,
    mobile_crop_position: 'center',
    mobile_crop_focal_point: { x: 0.5, y: 0.5 },
    mobile_crop_focal_point_offset: { x: 0, y: 0 },
    mobile_crop_focal_point_offset_x: 0,
    mobile_crop_focal_point_offset_y: 0,
    mobile_crop_focal_point_offset_x_mobile: 0,
    mobile_crop_focal_point_offset_y_mobile: 0,
  },

  /* ───────── services ───────── */

  services: {
    title: 'Our Services',
    subtitle: 'What we offer',
    items: ['Towing', 'Roadside Assistance', 'Jump Starts'],
  },

  /* ───────── faq ───────── */

  faq: {
    title: 'Frequently Asked Questions',
    subtitle: '',
    items: [
      {
        question: 'How fast is your response time?',
        answer: 'Usually within 30 minutes.',
        appearance: 'default',
      },
    ],
    layout: 'accordion',
  },

  /* ───────── cta (aligned with schema: href/style) ───────── */

  cta: {
    label: 'Call to Action',
    href: '/',
    style: 'primary',
  },

  /* ───────── testimonial (avatar_url per schema) ───────── */

  testimonial: {
    testimonials: [
      {
        quote: 'They did a great job!',
        attribution: 'Happy Client',
        avatar_url: '',
        rating: 5,
      },
    ],
    randomized: false,
    layout: 'list',
  },

  /* ───────── footer/header (match schema shapes) ───────── */

  footer: {
    logo_url: '',
    links: [{ label: 'Home', href: '/', appearance: 'default' }],
  },

  service_areas: {
    // normalized shape the schema’s preprocessor expects
    cities: [],
    allCities: [],
    sourceLat: 0,
    sourceLng: 0,
    radiusMiles: 0,
  },

  header: {
    logo_url: '',
    nav_items: [
      { label: 'Home', href: '/', appearance: 'default' },
      { label: 'Services', href: '/services', appearance: 'default' },
      { label: 'Contact', href: '/contact', appearance: 'default' },
    ],
  },

  /* ───────── contact form ───────── */

  contact_form: {
    title: 'Contact Us',
    services: [],
  },

  /* ───────── meals (Delivered.Menu) ───────── */

  meal_card: {
    // leave mealId blank (it will be treated as undefined by the schema)
    // mealId: "",
    // placeholder ensures the refine passes on creation
    mealSlug: '__select_meal__',
    showPrice: true,
    showChef: false,
    showRating: true,
    showTags: true,
    ctaText: 'View meal',
    variant: 'default',
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

  meals_grid: {
    siteSlug: '', // leave blank if you'll pass siteId instead
    siteId: '', // UUID optional
    tag: 'featured',
    q: '',
    sort: 'recent',
    limit: 12,
    columns: 3,
    ctaText: 'View meal',
  },

  reviews_list: {
    mealId: DUMMY_UUID,
    chefId: DUMMY_UUID,
    siteId: DUMMY_UUID,
    pageSize: 6,
    sort: 'recent',
    minStars: 1,
    showSummary: true,
    showWriteCta: false,
  },

  /* ───────── hours (matches HoursOfOperationSchema) ───────── */

  hours: {
    title: 'Business Hours',
    tz: 'America/Los_Angeles',
    alwaysOpen: false,
    note: '',
    display_style: 'table',
    days: [
      { key: 'mon', label: 'Mon', closed: false, periods: [{ open: '09:00', close: '17:00' }] },
      { key: 'tue', label: 'Tue', closed: false, periods: [{ open: '09:00', close: '17:00' }] },
      { key: 'wed', label: 'Wed', closed: false, periods: [{ open: '09:00', close: '17:00' }] },
      { key: 'thu', label: 'Thu', closed: false, periods: [{ open: '09:00', close: '17:00' }] },
      { key: 'fri', label: 'Fri', closed: false, periods: [{ open: '09:00', close: '17:00' }] },
      // weekend omitted by default; add if needed
    ],
    exceptions: [],
  },

  /* ───────── commerce ───────── */

  products_grid: { title: 'Featured Products', columns: 3, productIds: [], products: [] },

  service_offer: {
    title: 'Book a Service',
    subtitle: '',
    description_html: '',
    image_url: '',
    cta_text: 'Book now',
    cta_link: '/contact',
    showPrice: true,
    // price_cents / compare_at_cents / productId are optional and omitted by default
  },

  /* ───────── NEW: scheduler ───────── */

  scheduler: {
    title: 'Book an appointment',
    subtitle: 'Choose a time that works for you',
    org_id: undefined,
    service_ids: [],
    default_service_id: undefined,
    show_resource_picker: false,
    timezone: 'America/Los_Angeles',
    slot_granularity_minutes: 30,
    lead_time_minutes: 120,
    window_days: 14,
    confirmation_message: 'Thanks! Your appointment is confirmed.',
  },
} as const satisfies Record<BlockType, any>;
