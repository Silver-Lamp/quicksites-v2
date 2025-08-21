// admin/lib/cleanTemplateData.ts
export function unwrapData<T = any>(obj: any): T {
  let current = obj ?? {};
  let depth = 0;
  while (current && typeof current === 'object' && current.data && depth < 10) {
    current = current.data;
    depth++;
  }
  return current as T;
}

/**
 * Return a stable, editor-friendly shape that only includes top-level, pages, services.
 * - Safely unwraps nested `.data` layers
 * - Guarantees arrays for pages/services
 * - Avoids accessing properties on `undefined`
 */
export function cleanTemplateDataStructure(raw: any) {
  const base = unwrapData(raw ?? {});
  const pages = Array.isArray((base as any).pages) ? (base as any).pages : [];
  const services = Array.isArray((base as any).services) ? (base as any).services : [];

  // drop pages/services from the rest to avoid duplication
  const { pages: _p, services: _s, ...rest } = (base && typeof base === 'object') ? base : {};

  return {
    ...rest,
    pages,
    services,
  };
}
