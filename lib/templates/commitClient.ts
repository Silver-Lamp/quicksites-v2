// lib/templates/commitClient.ts
import { toast } from 'react-hot-toast';

type TemplateState = { id: string; rev: number; data: any };

// Your GET /api/templates/state?id=... should return { id, rev, data }
async function fetchState(id: string): Promise<TemplateState> {
  const res = await fetch(`/api/templates/state?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`state ${res.status}`);
  return res.json();
}

// Your POST /api/templates/commit now accepts { id, baseRev, patch, kind } and returns { rev, template? }
export async function postCommit(id: string, base_rev: number, data: any): Promise<number> {
  const res = await fetch('/api/templates/commit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      id,
      baseRev: base_rev,
      patch: { data },     // keep callers unchanged: they pass `data`, we wrap as patch
      kind: 'save',
    }),
  });

  const json = await res.json().catch(() => ({}));

  if (res.status === 409) {
    const err: any = new Error('merge_conflict');
    err.code = 409;
    err.rev = typeof json?.rev === 'number' ? json.rev : undefined;
    throw err;
  }
  if (!res.ok) {
    const err: any = new Error(json?.error || `commit ${res.status}`);
    err.code = res.status;
    throw err;
  }

  // ✅ hydrate editor immediately from authoritative row
  try {
    if (json?.template) {
      window.dispatchEvent(new CustomEvent('qs:template:merge', { detail: json.template }));
    } else {
      window.dispatchEvent(new Event('qs:template:invalidate'));
    }
  } catch {}

  return typeof json?.rev === 'number' ? json.rev : base_rev + 1;
}

// ---- queue / single-flight ----
let inFlight = false;
let queuedUpdate: ((base: any) => any) | null = null;
let lastKnown: TemplateState | null = null;

export async function commitTemplate(
  id: string,
  update: (base: any) => any,          // given server data, return the full next doc to save
  { toastLabel = 'Saved!' }: { toastLabel?: string } = {}
) {
  // coalesce rapid updates
  if (inFlight) { queuedUpdate = update; return; }
  inFlight = true;
  try {
    // ensure we have a fresh base (and rev)
    const base = lastKnown?.id === id ? lastKnown! : await fetchState(id);

    // attempt 1
    let nextDoc = update(base.data);
    try {
      const newRev = await postCommit(id, base.rev, nextDoc);
      lastKnown = { id, rev: newRev, data: nextDoc };
      // toast.success(toastLabel);
    } catch (e: any) {
      if (e?.code !== 409) throw e; // non-merge error

      // rebase: pull latest, re-apply user's update, retry once
      const latest = await fetchState(id);
      nextDoc = update(latest.data);
      const newRev = await postCommit(id, latest.rev, nextDoc);
      lastKnown = { id, rev: newRev, data: nextDoc };
      // toast.success(toastLabel);
    }
  } finally {
    inFlight = false;
    if (queuedUpdate) {
      const q = queuedUpdate; queuedUpdate = null;
      // fire-and-forget the queued update; no toast spam
      commitTemplate(id, q, { toastLabel });
    }
  }
}
