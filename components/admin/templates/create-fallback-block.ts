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
        content: { text: 'New quote', attribution: 'John Doe' },
      };
    case 'button':
      return {
        _id: id,
        type: 'button',
        content: { label: 'Click me', href: '#', style: 'default' },
      };
    case 'cta':
      return {
        _id: id,
        type: 'cta',
        content: { label: 'Learn more', link: '#', appearance: 'default' },
      };
    case 'faq':
      return {
        _id: id,
        type: 'faq',
        content: { title: 'Frequently Asked Questions', subtitle: 'We answer the most common questions.', items: [], layout: 'accordion' },
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
          image_url: 'https://placebear.com/600/300',
          layout_mode: 'full_width',
          blur_amount: 0,
          image_position: 'center',
          parallax_enabled: false,
          mobile_layout_mode: 'full_width',
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
      };
    case 'testimonial':
      return {
        _id: id,
        type: 'testimonial',
        content: { testimonials: [{ quote: 'Great service!', attribution: 'John Doe', image_url: 'https://placebear.com/600/300', rating: 5 }], randomized: false, layout: 'default' },
      };
    case 'image':
      return {
        _id: id,
        type: 'image',
        content: { url: 'https://placebear.com/600/300', alt: 'Placeholder image', caption: 'Placeholder image' },
      };
    case 'services':
      return {
        _id: id,
        type: 'services',
        content: {
          title: 'Our Services',
          subtitle: 'We offer everything from towing to roadside assistance.',
          items: ['Roadside Assistance', 'Flatbed Towing', 'Jump Starts'],
        },
      };
    case 'video':
      return {
        _id: id,
        type: 'video',
        content: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', caption: 'Watch our service in action', title: 'Customer Testimonial', provider: 'youtube' },
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
        tone: 'professional',
        industry: 'transportation',
        tags: ['towing', 'roadside assistance'],
        meta: {
          sourceLat: 43.3242,
          sourceLng: -88.0899,
          cityState: 'Springfield, IL',
        },
        content: {
          business_name: 'Towing Co.',
          address: '123 Main St',
          cityState: 'Springfield, IL',
          phone: '(555) 123-4567',
          links: [
            { label: 'Privacy Policy', href: '#', appearance: 'default' },
            { label: 'Terms of Service', href: '#', appearance: 'default' },
          ],
        },
      };
    case 'header':
      return {
        _id: id,
        type: 'header',
        content: {
          logo_url: 'https://placebear.com/600/300',
          nav_items: [
            { label: 'Home', href: '#', appearance: 'default' },
            { label: 'About', href: '#', appearance: 'default' },
            { label: 'Contact', href: '#', appearance: 'default' },
          ],
        },
      };
    case 'service_areas':
      return {
        _id: id,
        type: 'service_areas',
        content: {
          title: 'Our Service Areas',
          subtitle: 'We proudly serve the surrounding towns and cities within 30 miles.',
          cities: [
            { name: 'Springfield', address: '123 Main St', radius_miles: 30 },
            { name: 'Chicago', address: '123 Main St', radius_miles: 30 },
            { name: 'St. Louis', address: '123 Main St', radius_miles: 30 },
            { name: 'Kansas City', address: '123 Main St', radius_miles: 30 },
            { name: 'Omaha', address: '123 Main St', radius_miles: 30 },
          ],
          radius_miles: 30,
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
