// /hooks/useChefSiteId.ts

import { useEffect, useState } from 'react';


const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DEFAULT_SITE_HINT =
  process.env.NEXT_PUBLIC_DEFAULT_SITE_HINT || 'deliveredmenu';

async function resolveSite(hint: string): Promise<string | null> {
  try {
    const r = await fetch(`/api/public/site/resolve?hint=${encodeURIComponent(hint)}`);
    if (!r.ok) return null;
    const d = await r.json();
    return d?.site_id ?? null;
  } catch { return null; }
}

export function useChefSiteId() {
const [siteId, setSiteId] = useState('');


// On first load, find a reasonable siteId
useEffect(() => {
(async () => {
// 1) already set
if (siteId) return;
// 2) localStorage
const stored = localStorage.getItem('chef.siteId');
if (stored) { setSiteId(stored); return; }
// 3) URL ?site / ?siteId
const params = new URLSearchParams(window.location.search);
const fromQuery = params.get('site') || params.get('siteId');
if (fromQuery) {
const resolved = UUID_RE.test(fromQuery) ? fromQuery : await resolveSite(fromQuery);
if (resolved) { setSiteId(resolved); return; }
}
// 4) Hostname
const byHost = await resolveSite(window.location.hostname);
if (byHost) { setSiteId(byHost); return; }
// 5) Default hint
const fallback = await resolveSite(DEFAULT_SITE_HINT);
if (fallback) setSiteId(fallback);
})();
}, [siteId]);


// When user enters a non-UUID, resolve to UUID (but only persist UUIDs)
useEffect(() => {
if (!siteId || UUID_RE.test(siteId)) return;
let cancelled = false;
(async () => {
const id = await resolveSite(siteId);
if (!cancelled && id && UUID_RE.test(id)) {
setSiteId(id);
localStorage.setItem('chef.siteId', id);
}
})();
return () => { cancelled = true; };
}, [siteId]);


// Persist only UUIDs
useEffect(() => {
if (siteId && UUID_RE.test(siteId)) localStorage.setItem('chef.siteId', siteId);
}, [siteId]);


return { siteId, setSiteId };
}