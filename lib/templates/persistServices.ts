// lib/templates/persistServices.ts
/**
 * Persist services via the canonical commit endpoint.
 * Writes to template.data.services (array of strings), and returns the saved list.
 */
export async function persistServices(templateId: string, services: string[]) {
  const cleaned = Array.from(
    new Set((services || []).map((s) => String(s ?? '').trim()).filter(Boolean))
  );

  // Load current rev for optimistic commit
  const stateRes = await fetch(`/api/templates/state?id=${encodeURIComponent(templateId)}`, {
    cache: 'no-store',
  });
  const stateJson = await stateRes.json().catch(() => ({}));
  if (!stateRes.ok) {
    throw new Error(stateJson?.error || 'Failed to load template state');
  }
  const baseRev = stateJson?.infra?.template?.rev ?? 0;

  const res = await fetch('/api/templates/commit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: templateId,
      baseRev,
      patch: { data: { services: cleaned } },
      kind: 'save',
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error || 'Commit failed');
  }
  // The commit path doesn’t echo the list back — return the cleaned list
  return cleaned;
}
