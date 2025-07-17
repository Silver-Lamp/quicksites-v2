import type { BlockWithId, Block } from '@/types/blocks';

export function createFallbackBlock(type: Block['type']): BlockWithId {
  const id = crypto.randomUUID?.() || Date.now().toString();

  switch (type) {
    case 'text':
      return {
        _id: id,
        type: 'text',
        content: { value: 'New text block' },
      };
    case 'quote':
      return {
        _id: id,
        type: 'quote',
        content: { text: 'New quote' },
      };
    case 'button':
      return {
        _id: id,
        type: 'button',
        content: { label: 'Click me', href: '#' },
      };
    case 'cta':
      return {
        _id: id,
        type: 'cta',
        content: { label: 'Learn more', link: '#' },
      };
    case 'hero':
      return {
        _id: id,
        type: 'hero',
        content: {
          headline: 'Welcome to Our Towing Service',
          subheadline: 'Fast, Friendly, and Available 24/7',
          cta_text: 'Get Help Now',
          cta_link: '#',
          image_url: 'https://placekitten.com/600/300',
        },
      };
    case 'testimonial':
      return {
        _id: id,
        type: 'testimonial',
        content: { testimonials: [{ quote: 'Great service!', attribution: 'John Doe' }] },
      };
    case 'image':
      return {
        _id: id,
        type: 'image',
        content: { url: 'https://placekitten.com/600/300', alt: 'Placeholder image' },
      };
    case 'services':
      return {
        _id: id,
        type: 'services',
        content: { items: ['Roadside Assistance', 'Flatbed Towing', 'Jump Starts'] },
      };
    case 'video':
      return {
        _id: id,
        type: 'video',
        content: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', caption: 'Watch our service in action' },
      };
    case 'audio':
      return {
        _id: id,
        type: 'audio',
        content: { url: 'https://example.com/audio.mp3', title: 'Customer Testimonial', provider: 'soundcloud' },
      };
    case 'footer':
      return {
        _id: id,
        type: 'footer',
        content: {
          businessName: 'Towing Co.',
          address: '123 Main St',
          cityState: 'Springfield, IL',
          phone: '(555) 123-4567',
          links: [
            { label: 'Privacy Policy', href: '#' },
            { label: 'Terms of Service', href: '#' },
          ],
        },
      };
    default:
      return {
        _id: id,
        type: 'text',
        content: { value: 'Unsupported block' },
      };
  }
}
