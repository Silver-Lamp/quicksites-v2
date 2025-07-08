// lib/utils/slug.ts

export function slugify(str: string): string {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // remove special chars
      .replace(/[\s_-]+/g, '-') // normalize dashes
      .replace(/^-+|-+$/g, ''); // trim edges
  }
  
  export function generateTimestampSlug(): string {
    const now = new Date();
    const parts = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
    ];
    return parts.join('-');
  }
  
  export function generateUniqueTemplateName(base: string): string {
    return `${slugify(base)}-${generateTimestampSlug()}`;
  }
  
  export function stripTimestampFromName(name: string): string {
    return name.replace(/-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/, '');
  }
  