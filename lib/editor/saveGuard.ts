import type { Template } from '@/types/template';

/** Deterministic stringify (sorted keys) */
function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',')}}`;
}

/** Keep only fields that matter for “did anything change?”  */
export function canonicalizeTemplate(t: Template) {
  const dataPages = (t as any)?.data?.pages ?? (t as any)?.pages ?? [];
  return {
    id: t.id,
    template_name: t.template_name,
    slug: (t as any).slug ?? null,
    business_name: t.business_name ?? null,
    contact_email: t.contact_email ?? null,
    address_line1: t.address_line1 ?? null,
    address_line2: t.address_line2 ?? null,
    city: t.city ?? null,
    state: t.state ?? null,
    postal_code: t.postal_code ?? null,
    latitude: t.latitude ?? null,
    longitude: t.longitude ?? null,
    industry: t.industry ?? null,
    color_mode: (t as any).color_mode ?? null,
    headerBlock: (t as any).headerBlock ?? (t as any).header_block ?? null,
    footerBlock: (t as any).footerBlock ?? (t as any).footer_block ?? null,
    data: {
      ...(t.data ?? {}),
      pages: dataPages.map((p: any) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        show_header: p.show_header !== false,
        show_footer: p.show_footer !== false,
        content_blocks: (p.content_blocks ?? []).map((b: any) => ({
          _id: b._id,
          type: b.type,
          content: b.content ?? null,
        })),
      })),
    },
  };
}

export function templateSig(t: Template): string {
  return stableStringify(canonicalizeTemplate(t));
}

/** Optional coalescing guard (handy for bursty saves) */
export function makeSaveGuard(initial: Template) {
  let lastSig = templateSig(initial);
  let inflight: Promise<void> = Promise.resolve(); // << explicit

  return {
    hasChanged(next: Template) {
      return templateSig(next) !== lastSig;
    },
    markSaved(next: Template) {
      lastSig = templateSig(next);
    },
    async runCoalesced<T>(fn: () => Promise<T>): Promise<T> {
      // Chain after whatever's currently in flight
      const p: Promise<T> = inflight.then(() => fn());

      // Keep inflight typed as Promise<void> regardless of T
      inflight = p.then(
        () => undefined, // success -> void
        () => undefined  // error   -> void (swallow to keep chain alive)
      );

      return p;
    },
    reset(next: Template) {
      lastSig = templateSig(next);
    },
  };
}
