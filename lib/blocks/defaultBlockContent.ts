// lib/blocks/defaultBlockContent.ts
import type { BlockType } from '@/types/blocks';

const DUMMY_UUID = '00000000-0000-0000-0000-000000000000';

// Keep this aligned with the block types you actually support.
// If you add/remove a block type, update this object (or your BlockType union).
export const DEFAULT_BLOCK_CONTENT = {
  /* ───────── exterior-agency family (root-level props, not {content:{...}}) ───────── */
  pnw_prestige: {
    brand: 'Your Company',
    tagline: 'Exterior Cleaning • Roof & Gutter • Pressure & Soft Wash',
    ctaLabel: 'Get a Free Quote',
    phone: '',
    email: '',
    address: '',
    badges: ['Licensed', 'Insured', 'Eco-Safe'],
    services: [],
    packages: [],
    portfolio: [],
    testimonials: [],
    serviceAreas: [],
    footerNote: `© ${new Date().getFullYear()} Your Company. All rights reserved.`,
  },
  exterior_agency: {
    brand: 'Your Company',
    tagline: 'Exterior Cleaning • Roof & Gutter • Pressure & Soft Wash',
    ctaLabel: 'Get a Free Quote',
    phone: '',
    email: '',
    address: '',
    badges: ['Licensed', 'Insured', 'Eco-Safe'],
    services: [],
    packages: [],
    portfolio: [],
    testimonials: [],
    serviceAreas: [],
    footerNote: `© ${new Date().getFullYear()} Your Company. All rights reserved.`,
  },
  exterior_cleaning_agency: {
    brand: 'Your Company',
    tagline: 'Exterior Cleaning • Roof & Gutter • Pressure & Soft Wash',
    ctaLabel: 'Get a Free Quote',
    phone: '',
    email: '',
    address: '',
    badges: ['Licensed', 'Insured', 'Eco-Safe'],
    services: [],
    packages: [],
    portfolio: [],
    testimonials: [],
    serviceAreas: [],
    footerNote: `© ${new Date().getFullYear()} Your Company. All rights reserved.`,
  },

  /* ───────── basic content ───────── */
  text: { value: '' },

  image: { url: 'https://placehold.co/800x400', alt: '' },

  video: { url: 'https://example.com/video.mp4', caption: '' },

  audio: { url: 'https://example.com/audio.mp3', title: '', provider: 'suno' },

  // Empty: a default quote + named attribution is a fabricated statement by a named person.
  quote: { text: '', attribution: '' },

  button: { label: 'Click Me', href: '#', style: 'primary' },

  grid: {
    columns: 2,
    items: [],
    title: 'Grid',
    subtitle: '',
    layout: 'grid',
  },

  section: {
    columns: [{ items: [] }, { items: [] }],
    gap: 'md',
    align: 'stretch',
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

  file_downloads: {
    title: 'Download',
    note: '',
    files: [],
  },
  agreement: {
    title: 'Before you book',
    body:
      'Please read and accept these terms.\n\n' +
      '1. Replace this text with your own terms, waiver, or policy.\n\n' +
      '2. Whoever accepts will see exactly this text, and a copy of it is kept with their acceptance.',
    button_label: 'I accept',
    require_email: false,
    confirmation: 'Thank you — your acceptance has been recorded.',
  },
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

  mortgage_calculator: {
    title: 'Estimate your monthly payment',
    subtitle: 'Play with the numbers — see what this home could cost per month.',
    price: '$524,900',
    down_payment_percent: 20,
    interest_rate: 6.8,
    loan_term_years: 30,
    property_tax_rate: 1.1,
    home_insurance_monthly: 120,
    hoa_monthly: 0,
    cta_text: 'Get pre-approved',
    cta_link: '#contact',
    disclaimer: 'Estimate only — not a loan offer or a commitment to lend. Actual rates, taxes, and insurance vary.',
  },

  /* ───────── testimonial (avatar_url per schema) ───────── */

  testimonial: {
    // ⚠️ EMPTY ON PURPOSE — do not put a specimen back.
    // This default used to ship { quote: 'They did a great job!', attribution: 'Happy Client',
    // rating: 5 }. A block default is a GENERATOR that runs every time the block is created by
    // any path (scaffold, editor add-block, createDefaultBlock), so a fabricated quote here is
    // not a placeholder — it is a fabrication with unlimited reach, authored once and emitted
    // forever. It reached a real named business's draft (florencetow) before anyone noticed.
    // A fabricated `rating` is the worst part: a star is what gets aggregated and believed at a
    // glance. See crosstalk/contracts/honest-scaffold-standard.md.
    testimonials: [],
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

  /* ───────── menu (restaurant) ───────── */

  menu: {
    title: 'Menu',
    note: '',
    currency: 'USD',
    sections: [
      {
        name: 'Popular',
        description: '',
        items: [
          {
            name: 'House Favorite',
            description: 'A short, appetizing description.',
            price: '$12',
            tags: [],
          },
        ],
      },
    ],
  },

  /* ───────── location ───────── */

  location: {
    title: 'Find Us',
    business_name: '',
    address: '',
    phone: '',
    email: '',
    map_query: '',
    show_map: true,
    directions_url: '',
  },

  /* ───────── order bar (restaurant) ───────── */

  order_bar: {
    phone: '',
    call_label: 'Call',
    cta_label: 'View Menu',
    cta_href: '#menu',
    enabled: true,
  },

  /* ───────── commerce ───────── */

  products_grid: { title: 'Featured Products', columns: 3, productIds: [], products: [] },

  // Apex portal directory — campaign_id drives the live fetch; entries is the snapshot fallback.
  restaurants_directory: { title: 'Order from local restaurants', campaign_id: '', entries: [] },
  menu_finder: { title: 'What are you hungry for?', campaign_id: '' },
  auto_shops_directory: { title: 'Trusted auto shops near you', campaign_id: '', entries: [] },
  service_transparency: {
    headline: 'See the work before you pay for it',
    blurb: 'Our techs document the actual problem — a photo and a quick note — so you see it and approve the repair before we start. No surprises, no “trust us.”',
    cta_label: '',
    cta_link: '',
  },
  about_that: { embed_id: '', url: '', width: '' },
  audio_faq: { embed_id: '', title: 'Ask about this page', url: '' },
  quote_of_the_day: { align: 'center' },
  daily_artifact: { embed: '', show_caption: true },
  announcement_bar: {
    message: 'Free local delivery on orders over $50',
    link_text: '',
    link_href: '',
    code: '',
    ends_at: '',
    dismissible: true,
  },
  sticky_cart: {
    productId: '',
    cta_text: 'Add to cart',
    label: '',
    price_cents: 0,
    show_on_desktop: false,
    enabled: true,
  },
  demo_embed: { slug: '', width: '' },
  voice_welcome: {
    audio_url: '',
    embed_id: '',
    welcome_id: '',
    script: '',
    voice: 'narrator',
    title: '',
  },
  testimonial_audio: {
    title: 'What customers say',
    testimonials: [
      // Empty claim fields. The guidance that used to sit in `quote` was good advice in the
      // wrong place — anything in a claim field can RENDER as a claim, so it belongs in the
      // editor's placeholder, not in content.
      {
        quote: '',
        author: '',
        audio_url: '',
        testimonial_id: '',
      },
    ],
  },
  route_optimizer: {
    title: 'Plan your route',
    start: { label: 'Start', latitude: undefined, longitude: undefined },
    stops: [],
    round_trip: false,
  },
  events: {
    title: 'Upcoming events',
    events: [
      {
        name: 'Weekly gathering',
        date: '',
        when: 'Sundays, 10:00 AM',
        location: '',
        description: 'Everyone welcome.',
        cta_text: '',
        cta_link: '',
      },
    ],
  },
  gallery: {
    title: 'Gallery',
    columns: 3,
    images: [],
  },
  before_after: {
    title: 'See the difference',
    before_url: '',
    after_url: '',
    before_label: 'Before',
    after_label: 'After',
  },
  comments: {
    title: 'Comments',
    moderation: true,
    allow_links: false,
    closed: false,
    notify_email: '',
  },
  job_listing: {
    kind: 'general',
    title: 'Help wanted — one-time gig',
    store_name: '',
    location: '',
    pay: '',
    instructions: 'Describe the job, when it needs doing, and how you’ll pay. Post real gigs only.',
    deliverable: 'message',
    recipient_email: '',
    submit_url: '',
    permission_confirmed: false,
  },
  deck_estimate: {
    trade: 'deck',
    title: 'Instant deck estimate',
    subtitle:
      'Enter a few dimensions for a ballpark price — then we’ll follow up with a real quote.',
    default_material_tier: 'pressure_treated',
    show_refiners: true,
    cta_text: 'Get this quote from us',
    recipient_email: '',
  },
  reviews: {
    title: 'What customers say',
    product_name: '',
    show_schema: true,
    reviews: [
      // ⚠️ This shipped `rating: 5` with `show_schema: true` — a fabricated five-star review
      // emitted as structured data for search engines to ingest. A star is the part that gets
      // aggregated and believed at a glance; it is the first thing to pull, not the last.
      {
        author: '',
        rating: 0,
        text: '',
        date: '',
      },
    ],
  },
  listings_grid: {
    title: 'Current Listings',
    columns: 3,
    listings: [
      {
        headline: 'Sun-filled craftsman',
        address: '123 Maple St, Your City, ST',
        price: '$524,900',
        status: 'For sale',
        beds: '3',
        baths: '2.5',
        sqft: '1,850',
        image_url: '',
        cta_link: '#contact',
        about_that_embed_id: '',
      },
      {
        headline: 'Modern townhome',
        address: '88 Birch Ln, Your City, ST',
        price: '$389,000',
        status: 'For sale',
        beds: '2',
        baths: '1.5',
        sqft: '1,320',
        image_url: '',
        cta_link: '#contact',
        about_that_embed_id: '',
      },
      {
        headline: 'Lakeside retreat',
        address: '5 Cove Rd, Your City, ST',
        price: '$742,500',
        status: 'Pending',
        beds: '4',
        baths: '3',
        sqft: '2,600',
        image_url: '',
        cta_link: '#contact',
        about_that_embed_id: '',
      },
    ],
  },
  vehicles_grid: {
    title: 'Current Inventory',
    columns: 3,
    vehicles: [
      {
        year: '2021',
        make: 'Toyota',
        model: 'RAV4',
        trim: 'XLE AWD',
        price: '$26,995',
        mileage: '38,420 mi',
        status: 'Available',
        image_url: '',
        cta_link: '#contact',
        about_that_embed_id: '',
      },
      {
        year: '2019',
        make: 'Honda',
        model: 'Civic',
        trim: 'EX',
        price: '$18,995',
        mileage: '52,110 mi',
        status: 'Available',
        image_url: '',
        cta_link: '#contact',
        about_that_embed_id: '',
      },
      {
        year: '2020',
        make: 'Ford',
        model: 'F-150',
        trim: 'XLT 4x4',
        price: '$34,500',
        mileage: '41,780 mi',
        status: 'Available',
        image_url: '',
        cta_link: '#contact',
        about_that_embed_id: '',
      },
    ],
  },
  listing_card: {
    headline: 'Sun-filled craftsman on a quiet street',
    address: '123 Maple Street, Your City, ST',
    price: '$524,900',
    status: 'For sale',
    beds: '3',
    baths: '2.5',
    sqft: '1,850',
    description:
      'Bright open floor plan, refinished oak floors, and a level backyard made for summer evenings. Minutes to schools, parks, and the Saturday market.',
    images: [],
    cta_text: 'Request a showing',
    cta_link: '#contact',
    about_that_embed_id: '',
    about_that_url: '',
    about_that_width: '',
  },

  /**
   * ⚠️ SHIPS EMPTY — STRUCTURE, NOT PEOPLE.
   *
   * This default used to carry THREE INVENTED EMPLOYEES: "Jordan Avery, Listing Agent —
   * fifteen years matching families to the right block", "Priya Nair, Buyer's Agent",
   * "Marcus Bellamy, Broker". Names, job titles and biographies for people who do not exist,
   * on a block an agency drops onto its own site. Anyone who didn't fully edit it published a
   * staff page for a team it never hired — and a prospective client could try to phone them.
   *
   * Exactly the fabricated-testimonial bug (#652) wearing a different shape, and worse: a
   * review invents an opinion, this invents colleagues. It is rule 9 (no generated people)
   * applied to words instead of images.
   *
   * It survived the guard written for #652 because that one checks CLAIM_FIELDS —
   * quote/attribution/rating — and an agent has none of those. The test now also looks for
   * PERSON-SHAPED objects (a `name` alongside a bio/photo/title), which is what these are.
   *
   * The renderer already returns null on an empty list, so a site shows nothing here until
   * the owner adds someone real.
   */
  /**
   * ⚠️ THE PROVIDER FIELDS SHIP EMPTY. A savings figure belongs to whoever published it, and a
   * default like "save 20–50%" would put an unattributed third-party claim into every new block
   * — the same failure as a seeded testimonial, aimed at a competitor's pricing instead of a
   * customer's opinion. The owner fills these in with a figure they can point at.
   */
  /** Ships empty for the same reason bill_estimator does: no unattributed claims by default. */
  cloud_savings_agency: {
    headline: '',
    subheadline: '',
    operator_name: '',
    operator_bio: '',
    provider_name: '',
    provider_claim: '',
    fee_disclosure: '',
    proof_points: [] as Array<{ label: string; detail: string }>,
  },

  bill_estimator: {
    title: 'Send a bill, not your account details',
    blurb: '',
    provider_name: '',
    provider_claim: '',
  },

  agent_roster: {
    title: 'Meet Our Agents',
    subtitle: 'Every one of our agents will walk you through their listings — in their own voice.',
    columns: 3,
    agents: [] as Array<{
      name: string; title: string; photo_url: string; bio: string;
      phone: string; email: string; about_that_embed_id: string;
    }>,
  },

  neighborhood_stay: {
    title: 'Cozy tiny home by the creek',
    address: 'Cedar Hollow, OR',
    price_per_night: '$180',
    beds: '2',
    bathrooms: '1',
    max_guests: '4',
    min_stay: '2',
    max_stay: '14',
    amenities: ['Full kitchen', 'Wi-Fi', 'Wood stove', 'Creek-side deck', 'Free parking', 'Pet friendly'],
    description:
      'A hand-built tiny home tucked among the cedars, steps from the creek. Wake up to birdsong, cook in a full kitchen, and unwind on the deck under the stars. Minutes to trailheads and downtown.',
    images: [],
    cancellation: 'Free cancellation up to 7 days before check-in.',
    host_audio_url: '',
    about_that_embed_id: '',
    about_that_width: '',
    cta_text: 'Check availability',
    cta_link: '#contact',
    porchhearth_property_id: '',
    site_ref: '',
  },

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

  /* ───────── candidate blocks ───────── */

  candidate_hero: {
    // Empty, not "John Doe". A blank headline reads as unfinished; a placeholder NAME on a
    // political candidate's page reads as a candidate. Nothing real ships it (a fleet scan
    // found it on three dev templates only), so the cost of removing it is zero.
    name: '',
    title: 'Mayor Candidate',
    tagline: 'Building a Better Future Together',
    image_url: '',
    cta_text: 'Learn More',
    cta_link: '/about',
  },

  candidate_about: {
    title: 'About John',
    content: 'John has been serving our community for over 10 years...',
    image_url: '',
  },

  candidate_issues_grid: {
    title: 'Key Issues',
    subtitle: 'My priorities for our community',
    issues: [
      {
        title: 'Economic Growth',
        description: 'Creating jobs and supporting local businesses',
        icon: '💼',
      },
    ],
  },

  candidate_endorsements: {
    title: 'Endorsements',
    subtitle: 'Trusted by community leaders',
    endorsements: [
      // Empty: a default endorsement invents a named public figure backing a real candidate.
      {
        name: '',
        title: '',
        quote: '',
        image_url: '',
      },
    ],
  },

  candidate_events: {
    title: 'Upcoming Events',
    subtitle: 'Join me at these community events',
    events: [
      {
        title: 'Town Hall Meeting',
        date: '2024-01-15',
        time: '7:00 PM',
        location: 'Community Center',
        description: 'Discussing local issues',
      },
    ],
  },

  candidate_stay_connected: {
    title: 'Stay Connected',
    subtitle: 'Get updates on the campaign',
    email_placeholder: 'Enter your email',
    cta_text: 'Subscribe',
    social_links: {
      facebook: '',
      twitter: '',
      instagram: '',
    },
  },

  candidate_print_qr: {
    title: 'Print QR Code',
    subtitle: 'Share this QR code to help spread the word',
    qr_size: 'medium',
    include_text: true,
    text: 'Vote for John Doe',
  },

  public_qr_info: {
    title: 'Scan for More Info',
    subtitle: 'Get instant access to candidate information',
    qr_size: 'large',
    show_candidate_info: true,
  },

  public_qr_sidebar: {
    title: 'Quick Access',
    qr_size: 'small',
    show_links: true,
    links: [
      { label: 'Platform', href: '/platform' },
      { label: 'Events', href: '/events' },
    ],
  },
  candidate_donate: {
    headline: 'Donate to the Campaign',
    description: 'Every contribution helps us reach more voters.',
  },
  candidate_volunteer: {
    headline: 'Volunteer for the Campaign',
    description: 'Join the team to canvass, phone bank, or host a yard sign.',
  },
  story: {
    sections: [
      {
        heading: 'Our Story',
        body: 'Tell your story here.',
        image_url: '',
        cta_text: '',
        cta_link: '',
      },
    ],
  },
  home_valuation: {
    title: "What's your home worth?",
    subtitle: 'Get a personalized valuation from a local expert who knows your neighborhood.',
    cta_label: 'Get my valuation',
    disclaimer:
      "Your info comes straight to me — no spam, no obligation. I'll prepare a comparative market analysis for your home and follow up personally.",
  },
  listing_alert: {
    title: 'Get new listings first',
    subtitle:
      'Tell me what you’re looking for and I’ll send you matching homes the moment they hit the market.',
    cta_label: 'Notify me of new listings',
    disclaimer: 'No spam, no obligation — just the homes that fit. Unsubscribe anytime.',
  },
  affordability_calculator: {
    title: 'How much home can I afford?',
    cta_label: 'Talk to me about your budget',
    cta_href: '#contact',
  },
  listing_search: {
    title: 'Search homes for sale',
  },
} as const satisfies Record<BlockType, any>;
