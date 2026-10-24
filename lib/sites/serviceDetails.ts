// lib/sites/serviceDetails.ts
//
// A description per service, and optionally a page of its own (Amy, SVE Consulting, 2026-10-23:
// "I want to add descriptions under each of these different services … this is where I'm getting
// stuck"). The services list itself stays a plain list of names (`data.services`) — the contact
// form's dropdown, the scheduler import and the AI suggestions all read it as strings — so the
// details live BESIDE it, keyed by service name, at `data.meta.service_details`.
//
// Pure: no React, no I/O. The services panel writes through these; the services block reads them.

export type ServiceDetail = {
  /** Shown in a pop-up when a visitor taps or hovers the service. */
  description?: string;
  /** The slug of the service's own page, when it has one. */
  page_slug?: string;
};

export type ServiceDetails = Record<string, ServiceDetail>;

/** The canonical key for a service name: trimmed, case-folded, any "— $price" suffix dropped. */
export function serviceKey(name: string | null | undefined): string {
  const s = String(name ?? '').trim();
  const cut = s.indexOf(' — ');
  return (cut > -1 ? s.slice(0, cut) : s).trim().toLowerCase();
}

/** Read the stored details; anything malformed is dropped rather than trusted. */
export function readServiceDetails(data: unknown): ServiceDetails {
  const raw = (data as any)?.meta?.service_details;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: ServiceDetails = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue;
    const description = typeof (v as any).description === 'string' ? (v as any).description.trim() : '';
    const page_slug = typeof (v as any).page_slug === 'string' ? (v as any).page_slug.trim() : '';
    if (!description && !page_slug) continue;
    out[serviceKey(k)] = { ...(description ? { description } : {}), ...(page_slug ? { page_slug } : {}) };
  }
  return out;
}

export function detailFor(details: ServiceDetails, name: string): ServiceDetail | null {
  return details[serviceKey(name)] ?? null;
}

/**
 * Build the details map for a saved list. Each row carries the name it had when the panel opened
 * (`origName`), so RENAMING a service carries its description and page with it instead of
 * orphaning them under the old name; a removed service's details are dropped.
 */
export function detailsForRows(rows: Array<{ name: string; description?: string; page_slug?: string }>): ServiceDetails {
  const out: ServiceDetails = {};
  for (const r of rows) {
    const key = serviceKey(r.name);
    if (!key) continue;
    const description = String(r.description ?? '').trim();
    const page_slug = String(r.page_slug ?? '').trim();
    if (!description && !page_slug) continue;
    out[key] = { ...(description ? { description } : {}), ...(page_slug ? { page_slug } : {}) };
  }
  return out;
}

/** A URL-safe slug for a service page that does not collide with an existing page. */
export function servicePageSlug(name: string, existing: Iterable<string>): string {
  const base =
    serviceKey(name)
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'service';
  const taken = new Set(Array.from(existing, (s) => String(s).toLowerCase()));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The HTML a new service page starts with: the service as a heading, the description as paragraphs. */
export function servicePageHtml(name: string, description: string): string {
  const paras = String(description ?? '')
    .split(/\n{2,}|\r\n\r\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br/>')}</p>`)
    .join('');
  return `<h2>${esc(String(name).trim())}</h2>${paras}`;
}
