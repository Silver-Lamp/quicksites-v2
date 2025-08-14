export const RESERVED_SLUGS = new Set([
    'api','meals','meal','chefs','chef','alerts','login','signup','dashboard','admin','settings'
  ]);
  
  export function slugify(input: string, maxLen = 60) {
    const s = (input || '')
      .toLowerCase()
      .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')   // strip accents
      .replace(/[^a-z0-9]+/g, '-')                         // non-alnum → dash
      .replace(/^-+|-+$/g, '')                             // trim dashes
      .replace(/-+/g, '-')                                 // collapse dashes
      .slice(0, maxLen)
      .replace(/^-+|-+$/g, '');
    return s || 'meal';
  }
  