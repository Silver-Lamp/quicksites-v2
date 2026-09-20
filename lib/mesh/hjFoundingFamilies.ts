// lib/mesh/hjFoundingFamilies.ts
//
// HiveJournal's Cornerstone founding-families pilot (the iPad program), mirrored on our
// /admin/ops so the owner sees the queue from either product. Two halves:
//
//   LINKS  — deep links into HJ's public apply page, the gameplan, the admin board and the
//            wall-device fleet. Always rendered; they need nothing from HJ.
//   COUNTS — HJ's `GET /api/cornerstone/test-families/counts`, fetched server-side with the
//            partner headers (`X-Partner-Id: quicksites` + `X-Partner-Key`). COUNTS ONLY,
//            never rows: HJ's endpoint is built so a founding family can see the pilot's
//            shape without other applicants' emails or phones, and we hold the same line —
//            no applicant name, email or phone ever crosses this seam.
//
// Contract: crosstalk/contracts/founding-families-counts.md (single source of truth).
// The fetch never throws — an unreachable HJ or a missing secret renders as "not
// connected" beside the links, never as zeros (a zero would read as "nobody applied").

import { hjBackendUrl, partnerSecret, PARTNER_ID } from '@/lib/partners/audioProvisioning/config';

export const HJ_WWW = 'https://www.hivejournal.com';

/** The pages HJ's own admin board links between, in the order an operator walks them. */
export const HJ_FOUNDING_FAMILY_LINKS: ReadonlyArray<{ label: string; href: string; hint: string }> = [
  {
    label: 'Founding families board',
    href: `${HJ_WWW}/dashboard/admin/test-families`,
    hint: 'who applied, iPad shipped?, two-week window — edits save there',
  },
  {
    label: 'Cornerstone devices',
    href: `${HJ_WWW}/dashboard/admin/wall-devices`,
    hint: 'every registered wall by household · Plus · stale versions',
  },
  {
    label: 'Apply page',
    href: `${HJ_WWW}/cornerstone/display/founding-families`,
    hint: 'the public offer — send with ?source=<channel>',
  },
  {
    label: 'Rollout gameplan',
    href: `${HJ_WWW}/for-amy`,
    hint: 'the same steps founding families see',
  },
];

export type FoundingFamilyCounts = {
  applications: number;
  ipads_shipped: number;
  active: number;
  waiting: number;
  oldest_waiting_days: number;
};

export type FoundingFamilyStats =
  | { ok: true; counts: FoundingFamilyCounts; fetchedAt: string }
  | { ok: false; reason: 'no_secret' | 'unauthorized' | 'unreachable' | 'bad_shape'; detail?: string };

const COUNT_KEYS: ReadonlyArray<keyof FoundingFamilyCounts> = [
  'applications',
  'ipads_shipped',
  'active',
  'waiting',
  'oldest_waiting_days',
];

/** Accept exactly the five counts; anything else (or a row-shaped body) is refused. */
export function parseCounts(body: unknown): FoundingFamilyCounts | null {
  if (!body || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  const out: Partial<FoundingFamilyCounts> = {};
  for (const k of COUNT_KEYS) {
    const v = o[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return null;
    out[k] = v;
  }
  return out as FoundingFamilyCounts;
}

export function foundingFamilyStatsConfigured(): boolean {
  return !!partnerSecret();
}

/** Server-side only. Never throws. */
export async function fetchFoundingFamilyStats(
  deps: { fetchImpl?: typeof fetch; timeoutMs?: number } = {}
): Promise<FoundingFamilyStats> {
  const secret = partnerSecret();
  if (!secret) return { ok: false, reason: 'no_secret' };
  const fetchImpl = deps.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), deps.timeoutMs ?? 4000);
  try {
    const res = await fetchImpl(`${hjBackendUrl()}/api/cornerstone/test-families/counts`, {
      headers: { 'X-Partner-Id': PARTNER_ID, 'X-Partner-Key': secret, Accept: 'application/json' },
      signal: ctrl.signal,
      cache: 'no-store',
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, reason: 'unauthorized', detail: `HTTP ${res.status}` };
    }
    if (!res.ok) return { ok: false, reason: 'unreachable', detail: `HTTP ${res.status}` };
    const counts = parseCounts(await res.json());
    if (!counts) return { ok: false, reason: 'bad_shape' };
    return { ok: true, counts, fetchedAt: new Date().toISOString() };
  } catch (e) {
    return { ok: false, reason: 'unreachable', detail: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

/** One line for the tile's caption when the counts aren't available. Admin-only surface. */
export function statsUnavailableText(s: Extract<FoundingFamilyStats, { ok: false }>): string {
  switch (s.reason) {
    case 'no_secret':
      return 'Counts need PARTNER_QUICKSITES_SECRET (same value on HJ) — links still work';
    case 'unauthorized':
      return 'HJ refused the partner key — counts endpoint not yet partner-enabled on their side';
    case 'bad_shape':
      return 'HJ answered with something other than the five counts — refused';
    default:
      return `HJ unreachable${s.detail ? ` (${s.detail})` : ''} — links still work`;
  }
}
