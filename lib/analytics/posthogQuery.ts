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

/**
 * Runs one HogQL query. A failure comes back as `{ ok: false, reason }` — HTTP status plus the
 * first line of PostHog's error, or `timeout` — never a bare null, because "PostHog query
 * failed" on a stored analysis (the first production call, 2026-10-13) told nobody whether the
 * key was wrong, the query was wrong, or the network was slow.
 */
export async function posthogHogqlResult(
  query: string,
  opts: { timeoutMs?: number } = {},
): Promise<{ ok: true; result: HogqlResult } | { ok: false; reason: string }> {
  const unavailable = posthogQueryUnavailableReason();
  if (unavailable) return { ok: false, reason: unavailable };
  const ctl = new AbortController();
  const timeoutMs = opts.timeoutMs ?? 12_000;
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`${HOST}/api/projects/${encodeURIComponent(PROJECT)}/query/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
      signal: ctl.signal,
    });
    if (!res.ok) {
      const text = (await res.text().catch(() => '')).replace(/\s+/g, ' ').trim().slice(0, 160);
      return { ok: false, reason: `PostHog HTTP ${res.status}${text ? `: ${text}` : ''}` };
    }
    const j = (await res.json()) as { columns?: string[]; results?: unknown[][] };
    return { ok: true, result: { columns: j.columns ?? [], results: j.results ?? [] } };
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    return { ok: false, reason: aborted ? `PostHog timeout after ${timeoutMs} ms` : `PostHog fetch failed: ${e instanceof Error ? e.message.slice(0, 120) : 'error'}` };
  } finally {
    clearTimeout(timer);
  }
}

export async function posthogHogql(query: string, opts: { timeoutMs?: number } = {}): Promise<HogqlResult | null> {
  const r = await posthogHogqlResult(query, opts);
  return r.ok ? r.result : null;
}

/** HogQL string literal: single quotes doubled, backslashes escaped. */
export function hogqlString(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}
