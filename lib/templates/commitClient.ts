// lib/templates/commitClient.ts
import { toast } from 'react-hot-toast';

type TemplateState = { id: string; rev: number; data: any };

// Your GET /api/templates/state?id=... should return { id, rev, data }
async function fetchState(id: string): Promise<TemplateState> {
  const res = await fetch(`/api/templates/state?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`state ${res.status}`);
  return res.json();
}

// Your POST /api/templates/commit should accept { id, base_rev, data } and return { rev }
async function postCommit(id: string, base_rev: number, data: any): Promise<number> {
  const res = await fetch('/api/templates/commit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, base_rev, data }),
  });
  if (res.status === 409) throw Object.assign(new Error('merge_conflict'), { code: 409 });
  if (!res.ok) throw new Error(`commit ${res.status}`);
  const out = await res.json();
  return out.rev ?? base_rev + 1;
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
      toast.success(toastLabel);
    } catch (e: any) {
      if (e?.code !== 409) throw e; // non-merge error

      // rebase: pull latest, re-apply user's update, retry once
      const latest = await fetchState(id);
      nextDoc = update(latest.data);
      const newRev = await postCommit(id, latest.rev, nextDoc);
      lastKnown = { id, rev: newRev, data: nextDoc };
      toast.success(toastLabel);
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
