// lib/blockContentExamples.ts

export const blockContentExamples: Record<string, any> = {
    text: {
      value: 'Example text goes here.',
    },
    image: {
      url: 'https://example.com/image.jpg',
      alt: 'Descriptive alt text',
    },
    video: {
      url: 'https://example.com/video.mp4',
      caption: 'Optional caption',
    },
    audio: {
      url: 'https://example.com/audio.mp3',
      title: 'Optional title',
      provider: 'spotify', // or 'soundcloud', 'suno'
    },
    quote: {
      text: 'Customer testimonial quote goes here.',
      attribution: 'Jane Doe, CEO of TowCo',
    },
    testimonial: {
      quote: 'They were fast, professional, and saved the day.',
      attribution: 'Alex Smith',
    },
    services: {
      items: ['Towing', 'Lockout Service', 'Jumpstart'],
    },
    cta: {
      label: 'Call Now',
      link: '/contact',
    },
    hero: {
      headline: '24/7 Emergency Towing',
      subheadline: 'Fast, Reliable, Affordable',
      cta_text: 'Get Help Now',
      cta_link: '/contact',
    },
    button: {
      label: 'Learn More',
      href: '/about',
      style: 'primary',
    },
    grid: {
      columns: 3,
      items: [],
    },
  };
  