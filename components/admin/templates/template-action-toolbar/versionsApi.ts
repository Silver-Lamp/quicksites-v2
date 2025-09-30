'use client';

export async function loadVersionRow(id: string) {
  const res = await fetch(`/api/templates/versions?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  // Shape is repo-specific; keeping it generic
  return json?.items?.[0] ?? json;
}

export async function createSnapshot(templateId: string) {
  const url = `/api/admin/snapshots/create?templateId=${encodeURIComponent(templateId)}`;
  const res = await fetch(url, { method: 'GET', cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json;
}

export async function publishSnapshot(templateId: string, snapshotId: string) {
  const url = `/api/admin/sites/publish?templateId=${encodeURIComponent(templateId)}&snapshotId=${encodeURIComponent(snapshotId)}&versionId=${encodeURIComponent(snapshotId)}`;
  const res = await fetch(url, { method: 'GET', cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json;
}
