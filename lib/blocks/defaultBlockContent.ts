// lib/blocks/defaultBlockContent.ts
import type { BlockType } from '@/types/blocks';

export const DEFAULT_BLOCK_CONTENT: Record<BlockType, any> = {
  text: {
    value: 'Sample text block',
  },
  image: {
    url: 'https://placekitten.com/800/400',
    alt: 'A cute kitten',
  },
  video: {
    url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    caption: 'Intro video',
  },
  audio: {
    url: 'https://spotify.com/sample',
    title: 'Sample Audio',
    provider: 'spotify',
  },
  quote: {
    text: 'This changed everything.',
    attribution: 'Jane Doe',
  },
  button: {
    label: 'Click Me',
    href: '#',
    style: 'primary',
  },
  grid: {
    columns: 2,
    items: [],
  },
  hero: {
    headline: 'Welcome to Your Site!',
    subheadline: 'This is the hero section.',
    cta_text: 'Get Started',
    cta_link: '#',
    image_url: 'https://placekitten.com/1200/600',
    blur_amount: 0,
    layout_mode: 'cover',
  },
  services: {
    title: 'Our Services',
    subtitle: 'We offer everything from towing to roadside assistance.',
    items: ['Towing', 'Jump Starts', 'Flat Tire Help'],
  },
  faq: {
    title: 'Frequently Asked Questions',
    subtitle: '',
    items: [
      {
        question: 'How fast is your response time?',
        answer: 'Usually within 30 minutes.',
      },
      {
        question: 'Do you offer 24/7 towing?',
        answer: 'Yes, always on call.',
      },
    ],
    layout: 'accordion',
  },
  cta: {
    label: 'Learn More',
    link: '#about',
    appearance: 'button',
  },
  testimonial: {
    testimonials: [
      {
        quote: 'They did a great job!',
        attribution: 'Happy Client',
        avatar_url: 'https://placekitten.com/800/400',
        rating: 5,
      },
    ],
    layout: 'list',
    randomized: false,
  },
  footer: {
    business_name: 'Grafton Towing',
    address: '1600 7th Ave',
    cityState: 'Grafton, WI',
    phone: '(262) 228-2491',
    links: [
      { label: 'Home', href: '/' },
      { label: 'Towing Service', href: '/towing-service' },
      { label: 'Emergency Towing', href: '/emergency-towing' },
      { label: 'Roadside Assistance', href: '/roadside-assistance' },
      { label: 'Auto Wrecking & Flatbed', href: '/auto-wrecking' },
    ],
  },
  service_areas: {
    cities: ['Grafton', 'Milwaukee', 'Madison'],
    allCities: ['Grafton', 'Milwaukee', 'Madison'],
    sourceLat: 43.3242,
    sourceLng: -88.0899,
    radiusMiles: 30,
  },
  header: {
    logoUrl: 'https://placekitten.com/800/400',
    navItems: [
      { label: 'Home', href: '/', appearance: 'default' },
      { label: 'Services', href: '/services', appearance: 'default' },
      { label: 'Contact', href: '/contact', appearance: 'default' },
    ],
  },
  contact_form: {
    title: 'Contact Us',
    notification_email: 'sandon@quicksites.ai',
  },
  meal_card: {
    title: 'Meal A',
    chef_name: 'John Doe',
    price: '$10',
    image_url: 'https://placekitten.com/800/400',
    description: 'This is a description',
    availability: 'Available',
    tags: ['Vegan', 'Spicy'],
    video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
  },
  chef_profile: {
    name: 'John Doe',
    location: 'New York, NY',
    profile_image_url: 'https://placekitten.com/800/400',
    kitchen_video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    bio: 'This is a bio',
    certifications: ['Certification A', 'Certification B'],
    meals: [
      {
        title: 'Meal A',
        price: '$10',
        availability: 'Available',
        image_url: 'https://placekitten.com/800/400',
      },
    ],
  },
};
