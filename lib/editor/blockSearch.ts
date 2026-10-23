// lib/editor/blockSearch.ts
//
// The block library's search, matched on the words a site owner uses — not only our block names.
// "Type in about … no, maybe there's not" (walkthrough, 2026-10-22): an owner wanting an About
// section typed "about" and the library had nothing called that, because the block that does the
// job is "Story Sections" / "Text Block". Synonyms map a plain word to the blocks that serve it.

const SYNONYMS: Record<string, string[]> = {
  about: ['story', 'text', 'selected_work'],
  'about us': ['story', 'text'],
  'about me': ['story', 'text', 'selected_work'],
  bio: ['story', 'text'],
  team: ['story', 'text', 'agent_roster'],
  history: ['story', 'text'],
  mission: ['story', 'text'],
  photo: ['gallery', 'image', 'before_after'],
  photos: ['gallery', 'image', 'before_after'],
  pictures: ['gallery', 'image', 'before_after'],
  portfolio: ['gallery', 'selected_work', 'before_after'],
  work: ['selected_work', 'gallery'],
  reviews: ['reviews', 'testimonial'],
  testimonials: ['testimonial', 'reviews'],
  contact: ['contact_form', 'location', 'cta'],
  form: ['contact_form'],
  email: ['contact_form'],
  signup: ['contact_form'],
  newsletter: ['contact_form'],
  map: ['location', 'service_areas'],
  address: ['location'],
  directions: ['location'],
  pricing: ['services', 'service_offer', 'products_grid'],
  prices: ['services', 'service_offer', 'products_grid'],
  booking: ['scheduler', 'table_booking'],
  appointment: ['scheduler'],
  appointments: ['scheduler'],
  schedule: ['scheduler', 'events', 'hours'],
  calendar: ['events', 'scheduler'],
  shop: ['products_grid'],
  store: ['products_grid'],
  sell: ['products_grid', 'service_offer'],
  jobs: ['job_listing'],
  careers: ['job_listing'],
  hiring: ['job_listing'],
  join: ['job_listing', 'contact_form', 'cta'],
  questions: ['faq'],
  banner: ['hero', 'announcement_bar'],
  button: ['cta', 'button'],
};

/** Does block `type` (label `label`) answer the owner's query `q`? */
export function blockMatchesQuery(type: string, label: string, q: string): boolean {
  const query = q.trim().toLowerCase();
  if (!query) return true;
  const t = type.toLowerCase();
  const l = label.toLowerCase();
  if (l.includes(query) || t.includes(query) || t.replace(/_/g, ' ').includes(query)) return true;
  const hits = SYNONYMS[query] ?? SYNONYMS[query.replace(/s$/, '')] ?? [];
  return hits.includes(type);
}
