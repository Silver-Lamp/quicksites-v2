// lib/baseSlug.ts
export function baseSlug(slug: string | null | undefined) {
    if (!slug) return '';
    // remove only the last -[a-z0-9]{2,12}
    return slug.replace(/-[a-z0-9]{2,12}$/i, '');
  }  