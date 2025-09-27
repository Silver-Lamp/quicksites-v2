// components/admin/templates/truth/utils.ts
import type { TemplateEvent } from './types';

export const shortHash = (h?: string) => (!h ? '' : h.length <= 7 ? h : h.slice(0, 7));

export function shortTime(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString()
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString();
}

export function safeTruthRefresh() {
  try { window.dispatchEvent(new CustomEvent('qs:truth:refresh')); } catch {}
}

export function eventKey(e: TemplateEvent) {
  const rev = e.revAfter ?? e.revBefore ?? '';
  return JSON.stringify([e.type, rev, e.fieldsTouched ?? [], e.diff ?? {}, (e.meta as any)?.k ?? '']);
}
export function dedupeEvents(list: TemplateEvent[]) {
  const seen = new Set<string>();
  const out: TemplateEvent[] = [];
  for (const e of list ?? []) {
    const k = eventKey(e);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out;
}

export const getSnapshotIdFromEvent = (evt: TemplateEvent) => {
  const m = (evt.meta as any) || {};
  return m?.snapshot?.id || m?.snapshotId || m?.snapshot_id || m?.id || undefined;
};
export const getVersionIdFromEvent = (evt: TemplateEvent) => {
  const m = (evt.meta as any) || {};
  return m?.version?.id || m?.versionId || m?.version_id || undefined;
};
