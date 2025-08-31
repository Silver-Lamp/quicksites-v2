// lib/templateCache.ts

/**
 * Lightweight client-side cache for template editor payloads.
 * - Stores by BOTH id and slug keys so either route warms the cache.
 * - TTL-gated reads to avoid stale flashes.
 * - Size-guarded writes to prevent QuotaExceededError.
 * - Cross-tab friendly via storage events (handled by consumers).
 * - Event API for invalidate/update so other components can react.
 */

export type TemplateCacheRow = {
    id: string;
    slug: string | null;
    template_name?: string | null;
    updated_at: string;              // ISO
    color_mode?: string | null;
    data?: any;
    header_block?: any | null;
    footer_block?: any | null;
  };
  
  type CacheEnvelope = { row: TemplateCacheRow; t: number };
  
  /* ---------------- Config ---------------- */
  const CACHE_NS = 'qs:tpl';
  const CACHE_VERSION = 'v1';
  const TTL_MS = 10 * 60_000;         // 10 minutes
  const MAX_STR_BYTES = 1_000_000;    // ~1MB budget per entry to avoid quota issues
  
  /* ---------------- Key helpers ---------------- */
  const isBrowser = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  
  const keyFor = (idOrSlug: string) => `${CACHE_NS}:${CACHE_VERSION}:${idOrSlug}`;
  
  /* ---------------- Safe storage helpers ---------------- */
  const safeGet = <T,>(k: string): T | null => {
    if (!isBrowser()) return null;
    try {
      const raw = localStorage.getItem(k);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  };
  
  const safeSet = (k: string, v: any) => {
    if (!isBrowser()) return;
    try {
      const s = JSON.stringify(v);
      // Guard on approximate byte size to reduce quota errors.
      // new Blob is widely supported; if it throws we fall back to set anyway.
      try {
        if (new Blob([s]).size > MAX_STR_BYTES) return; // skip oversized entries
      } catch {/* ignore size calc errors */}
      localStorage.setItem(k, s);
    } catch {
      // swallow QuotaExceededError or JSON/stringify issues
    }
  };
  
  const safeRemove = (k: string) => {
    if (!isBrowser()) return;
    try { localStorage.removeItem(k); } catch {}
  };
  
  /* ---------------- Public API ---------------- */
  
  /** Read a cached row by id OR slug. Returns null if not present or expired. */
  export function readTemplateCache(idOrSlug: string): TemplateCacheRow | null {
    const env = safeGet<CacheEnvelope>(keyFor(idOrSlug));
    if (!env) return null;
    if (Date.now() - env.t > TTL_MS) return null;
    return env.row;
  }
  
  /** Write a row to cache under BOTH id and slug keys (when available). */
  export function writeTemplateCache(row: TemplateCacheRow) {
    if (!row?.id) return;
    const env: CacheEnvelope = { row, t: Date.now() };
  
    const idKey = keyFor(row.id);
    safeSet(idKey, env);
  
    const slugKey = row.slug ? keyFor(row.slug) : null;
    if (slugKey) safeSet(slugKey, env);
  }
  
  /** Returns true if timestamp a is newer-or-equal than b. */
  export function newerThan(a?: string | null, b?: string | null) {
    if (!a && !b) return true;
    if (!a) return false;
    if (!b) return true;
    return new Date(a).getTime() >= new Date(b).getTime();
  }
  
  /**
   * Clear cache entry/entries for a given idOrSlug.
   * If we can resolve the counterpart key (id<->slug) we remove that as well.
   */
  export function clearTemplateCache(idOrSlug: string) {
    const k = keyFor(idOrSlug);
    // Attempt to read the envelope to find counterpart keys.
    const env = safeGet<CacheEnvelope>(k);
    safeRemove(k);
  
    // If we read a row, clear the other key too (id<->slug)
    const row = env?.row;
    if (row) {
      const idKey = keyFor(row.id);
      const slugKey = row.slug ? keyFor(row.slug) : null;
  
      // Avoid removing twice; keys may equal idOrSlug
      if (idKey !== k) safeRemove(idKey);
      if (slugKey && slugKey !== k) safeRemove(slugKey);
    }
  }
  
  /* ---------------- Event API (for UI sync) ---------------- */
  
  export const TEMPLATE_CACHE_INVALIDATE = 'qs:template:cache:invalidate';
  export const TEMPLATE_CACHE_UPDATE = 'qs:template:cache:update';
  
  /** Notify listeners to invalidate a cache entry (by id OR slug). */
  export function dispatchTemplateCacheInvalidate(key: string) {
    if (!isBrowser()) return;
    window.dispatchEvent(new CustomEvent(TEMPLATE_CACHE_INVALIDATE, { detail: { key } }));
  }
  
  /** Prime storage with the row and notify listeners to update their state if newer. */
  export function dispatchTemplateCacheUpdate(row: TemplateCacheRow) {
    writeTemplateCache(row);
    if (!isBrowser()) return;
    window.dispatchEvent(new CustomEvent(TEMPLATE_CACHE_UPDATE, { detail: { row } }));
  }
  
  /* ---------------- Optional utils (handy in dev) ---------------- */
  
  /** For debugging: read the raw envelope (timestamp + row). */
  export function readTemplateCacheEnvelope(idOrSlug: string): CacheEnvelope | null {
    return safeGet<CacheEnvelope>(keyFor(idOrSlug));
  }
  
  /** For debugging: purge both id and slug keys if you have the full row. */
  export function clearTemplateCacheForRow(row: TemplateCacheRow) {
    if (!row?.id) return;
    clearTemplateCache(row.id);
    if (row.slug) clearTemplateCache(row.slug);
  }
  