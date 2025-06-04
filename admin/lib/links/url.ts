export function getTemplateUrl(id: string, query?: Record<string, string | number | boolean>): string {
  const base = `/templates/${id}`;
  if (!query) return base;
  const qs = new URLSearchParams();
  for (const key in query) {
    if (query[key] !== undefined) qs.set(key, String(query[key]));
  }
  return `${base}?${qs.toString()}`;
}

export function getSnapshotUrl(id: string, query?: Record<string, string | number | boolean>): string {
  const base = `/shared/${id}`;
  if (!query) return base;
  const qs = new URLSearchParams();
  for (const key in query) {
    if (query[key] !== undefined) qs.set(key, String(query[key]));
  }
  return `${base}?${qs.toString()}`;
}

