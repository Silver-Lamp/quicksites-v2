// lib/queryUtils.ts

export function extractTags(query: string): string[] {
  const params = new URLSearchParams(query);
  const tags: string[] = [];
  if (params.has('audience')) tags.push(params.get('audience')!);
  if (params.has('source')) tags.push(params.get('source')!);
  if (params.has('medium')) tags.push(params.get('medium')!);
  if (params.has('tag')) tags.push(...params.getAll('tag'));
  return tags;
}

export function summarizeQuery(query: string): string {
  const params = new URLSearchParams(query);
  const keys = Array.from(params.keys());
  return keys.length > 0
    ? keys.slice(0, 3).join(', ') + (keys.length > 3 ? ', ...' : '')
    : '(empty)';
}
