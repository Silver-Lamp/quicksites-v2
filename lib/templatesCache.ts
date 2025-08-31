// lib/templatesCache.ts
export type TemplateListItem = {
    id: string;
    slug: string | null;
    template_name: string;
    updated_at: string;           // ISO
    created_at?: string;
    is_site?: boolean | null;
    is_version?: boolean | null;
    archived?: boolean | null;
    industry?: string | null;
    color_mode?: 'dark'|'light'|null;
  };
  
  const LS_KEY = 'qs:templates:list:v1';
  const META_KEY = 'qs:templates:meta:v1'; // { lastSeenISO: string }
  
  const safeStorage = {
    get<T = any>(k: string): T | null {
      try { return JSON.parse(localStorage.getItem(k) || 'null') as T | null; }
      catch { return null; }
    },
    set(k: string, v: any) {
      try { localStorage.setItem(k, JSON.stringify(v)); }
      catch (e) { console.warn('[templatesCache] localStorage.set failed:', e); }
    }
  };
  
  export function readCache() {
    const list = safeStorage.get<TemplateListItem[]>(LS_KEY) || [];
    const meta = safeStorage.get<{ lastSeenISO?: string }>(META_KEY) || {};
    return { list, lastSeenISO: meta.lastSeenISO || null };
  }
  
  export function writeCache(list: TemplateListItem[]) {
    // keep only minimal fields and cap size (e.g., 2k rows)
    const slim = list
      .sort((a,b) => (b.updated_at > a.updated_at ? 1 : -1))
      .slice(0, 2000);
    safeStorage.set(LS_KEY, slim);
    safeStorage.set(META_KEY, { lastSeenISO: slim[0]?.updated_at || null });
  }
  