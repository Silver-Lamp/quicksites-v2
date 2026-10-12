// lib/analytics/posthogQuery.ts
//
// Read-only HogQL against our PostHog project, from the server. `captureServer` (posthog-server.ts)
// WRITES events with the project key; reading them back needs a PERSONAL API key, which is a
// different credential with a different blast radius — it is the owner's read-only key and it is
// never sent anywhere but PostHog's query endpoint.
//
// Degrades to `null`, never throws, when the key is unset: a caller gets "no visit data" and says
// so, rather than a 500 on a cron that also has other work to do.
const HOST = (process.env.POSTHOG_API_HOST || 'https://us.posthog.com').replace(/\/+$/, '');
const KEY = process.env.POSTHOG_PERSONAL_API_KEY || '';
const PROJECT = process.env.POSTHOG_PROJECT_ID || '';

export type HogqlResult = { columns: string[]; results: unknown[][] };

export function posthogQueryConfigured(): boolean {
  return Boolean(KEY && PROJECT);
}

/** Why a query cannot run, for the facts record; null when it can. */
export function posthogQueryUnavailableReason(): string | null {
  if (!KEY) return 'POSTHOG_PERSONAL_API_KEY is not set';
  if (!PROJECT) return 'POSTHOG_PROJECT_ID is not set';
  return null;
}

export async function posthogHogql(query: string, opts: { timeoutMs?: number } = {}): Promise<HogqlResult | null> {
  if (!posthogQueryConfigured()) return null;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 12_000);
  try {
    const res = await fetch(`${HOST}/api/projects/${encodeURIComponent(PROJECT)}/query/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
      signal: ctl.signal,
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { columns?: string[]; results?: unknown[][] };
    return { columns: j.columns ?? [], results: j.results ?? [] };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** HogQL string literal: single quotes doubled, backslashes escaped. */
export function hogqlString(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}
