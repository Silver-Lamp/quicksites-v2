// lib/domains/watchlist.ts
//
// Domain WATCHLIST: names we want at registration price the moment they become registerable —
// typically an expiring/pending-delete name a squatter tried to sell us (richlandtowing.com,
// $500 ask, 2026-09-16, while the registry showed it in `pending delete`).
//
// The nightly cron (app/api/cron/domain-watch) checks each watched name against the registry
// (RDAP, informational) and the registrar (Vercel availability + price, authoritative), and
// BUYS it when it is available at or under the entry's price cap. Anything else — over the cap,
// unknown, purchase failed, flag off — files an owner task and emails ADMIN_EMAILS, and the
// entry stays `watching` so tomorrow tries again. Money moves only at or under a cap the owner
// wrote down; a premium re-list at $500 is refused by the same line that approves $12.
//
// Storage: one `site_settings` row (`domain_watchlist`), service-role only. Small list, by design.

import { getSiteSetting, setSiteSetting } from '@/lib/settings/siteSettings';
import { checkAvailability, purchaseDomain, type DomainAvailability } from '@/lib/domains/registrar';

export const WATCHLIST_KEY = 'domain_watchlist';

export type WatchStatus = 'watching' | 'bought' | 'stopped';

export type WatchEntry = {
  domain: string;
  /** Hard ceiling in whole USD for the yearly registration; the buy is refused above it. */
  max_price_usd: number;
  note?: string;
  added_at: string;
  status: WatchStatus;
  last_checked_at?: string;
  /** What the last check concluded — human-readable, for the admin view and the task. */
  last_result?: string;
  registry_status?: string[];
  bought_at?: string;
  price_usd?: number | null;
};

export function normalizeWatchDomain(input: string): string {
  const s = String(input || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s)) throw new Error(`invalid domain: ${input}`);
  return s;
}

export async function getWatchlist(): Promise<WatchEntry[]> {
  const v = await getSiteSetting<WatchEntry[]>(WATCHLIST_KEY, []);
  return Array.isArray(v) ? v : [];
}

/** `updatedBy` must be a user UUID or null — `site_settings.updated_by` is a uuid column, and a
 *  label like 'domain-watch' fails the write (found seeding the first entry, 2026-09-16). */
export async function setWatchlist(list: WatchEntry[], updatedBy?: string | null): Promise<void> {
  const uuid = typeof updatedBy === 'string' && /^[0-9a-f-]{36}$/i.test(updatedBy) ? updatedBy : null;
  await setSiteSetting(WATCHLIST_KEY, list, uuid);
}

/* ---------- pure decision ---------- */

export type WatchDecision =
  | { action: 'buy'; priceUsd: number }
  | { action: 'over_cap'; priceUsd: number }
  | { action: 'unknown'; reason: string }
  | { action: 'taken' };

/** What to do with one entry given the registrar's answer. Pure. */
export function decideWatchAction(entry: Pick<WatchEntry, 'max_price_usd'>, avail: DomainAvailability): WatchDecision {
  if (avail.error) return { action: 'unknown', reason: avail.error };
  if (!avail.available) return { action: 'taken' };
  if (typeof avail.priceUsd !== 'number') return { action: 'unknown', reason: 'available but unpriced' };
  if (avail.premium || avail.priceUsd > entry.max_price_usd) return { action: 'over_cap', priceUsd: avail.priceUsd };
  return { action: 'buy', priceUsd: avail.priceUsd };
}

/* ---------- registry (informational) ---------- */

/** RDAP status list, or null when the registry has no record (the name has dropped / never existed). */
export async function rdapStatus(domain: string, fetchImpl: typeof fetch = fetch): Promise<string[] | null | undefined> {
  // rdap.org is a redirector to the registry's RDAP; on the first live run it answered
  // non-OK from Node fetch (fine from curl), so .com/.net go straight to Verisign as well.
  const tld = domain.split('.').pop();
  const urls = [
    `https://rdap.org/domain/${encodeURIComponent(domain)}`,
    ...(tld === 'com' || tld === 'net' ? [`https://rdap.verisign.com/${tld}/v1/domain/${encodeURIComponent(domain)}`] : []),
  ];
  let sawUnknown = false;
  for (const url of urls) {
    try {
      const res = await fetchImpl(url, { headers: { accept: 'application/rdap+json, application/json' }, redirect: 'follow' });
      if (res.status === 404) return null;
      if (!res.ok) {
        sawUnknown = true;
        continue;
      }
      const j: any = await res.json().catch(() => null);
      return Array.isArray(j?.status) ? j.status.map(String) : [];
    } catch {
      sawUnknown = true;
    }
  }
  return sawUnknown ? undefined : null;
}

/* ---------- the run ---------- */

export type WatchRunDeps = {
  list: () => Promise<WatchEntry[]>;
  save: (list: WatchEntry[]) => Promise<void>;
  availability: (domain: string) => Promise<DomainAvailability>;
  purchase: (domain: string, expectedPriceUsd: number) => Promise<{ ok: boolean; purchased: boolean; priceUsd: number | null; reason?: string }>;
  registry: (domain: string) => Promise<string[] | null | undefined>;
  registerEnabled: () => boolean;
  notify: (subject: string, body: string) => Promise<void>;
  task: (title: string, details: string) => Promise<void>;
  now?: () => Date;
};

export type WatchRunReport = {
  checked: number;
  bought: string[];
  overCap: string[];
  unknown: string[];
  taken: string[];
  failed: string[];
};

export async function runDomainWatch(deps: WatchRunDeps): Promise<WatchRunReport> {
  const now = deps.now ?? (() => new Date());
  const list = await deps.list();
  const report: WatchRunReport = { checked: 0, bought: [], overCap: [], unknown: [], taken: [], failed: [] };

  for (const entry of list) {
    if (entry.status !== 'watching') continue;
    report.checked++;
    const stamp = now().toISOString();
    entry.last_checked_at = stamp;

    const registry = await deps.registry(entry.domain);
    if (Array.isArray(registry)) entry.registry_status = registry;
    else if (registry === null) entry.registry_status = [];

    const avail = await deps.availability(entry.domain);
    const d = decideWatchAction(entry, avail);

    if (d.action === 'taken') {
      entry.last_result = `registered elsewhere (registry: ${(entry.registry_status ?? []).join(', ') || 'n/a'})`;
      report.taken.push(entry.domain);
      continue;
    }
    if (d.action === 'unknown') {
      entry.last_result = `could not determine: ${d.reason}`;
      report.unknown.push(entry.domain);
      continue;
    }
    if (d.action === 'over_cap') {
      entry.last_result = `available at $${d.priceUsd}/yr — over the $${entry.max_price_usd} cap, not bought`;
      report.overCap.push(entry.domain);
      await deps.task(
        `${entry.domain} is available at $${d.priceUsd} — over your $${entry.max_price_usd} cap`,
        `The watchlist will not buy above the cap. Raise it via POST /api/admin/domains/watchlist or buy by hand. ${entry.note ?? ''}`.trim(),
      );
      await deps.notify(`${entry.domain} available at $${d.priceUsd} (over cap)`, entry.last_result);
      continue;
    }

    // action === 'buy'
    if (!deps.registerEnabled()) {
      entry.last_result = `available at $${d.priceUsd}/yr but VERCEL_DOMAIN_REGISTER_ENABLED is off — buy by hand today`;
      report.failed.push(entry.domain);
      await deps.task(`${entry.domain} is available at $${d.priceUsd} — register it today`, entry.last_result);
      await deps.notify(`${entry.domain} is available at $${d.priceUsd}`, entry.last_result);
      continue;
    }
    const r = await deps.purchase(entry.domain, entry.max_price_usd);
    if (r.ok && r.purchased) {
      entry.status = 'bought';
      entry.bought_at = stamp;
      entry.price_usd = r.priceUsd;
      entry.last_result = `bought at $${r.priceUsd ?? d.priceUsd}/yr`;
      report.bought.push(entry.domain);
      await deps.task(
        `${entry.domain} was bought at $${r.priceUsd ?? d.priceUsd} — bind it`,
        `Registered through Vercel and attached to the project. Decide what it serves (redirect to the hyphen site, or its own pitch site). ${entry.note ?? ''}`.trim(),
      );
      await deps.notify(`Bought ${entry.domain} at $${r.priceUsd ?? d.priceUsd}`, entry.last_result);
    } else {
      entry.last_result = `purchase failed: ${r.reason ?? 'unknown'} (available at $${d.priceUsd})`;
      report.failed.push(entry.domain);
      await deps.task(`${entry.domain}: purchase failed — ${r.reason ?? 'unknown'}`, `${entry.last_result}. It is available; buy by hand before someone else does.`);
      await deps.notify(`${entry.domain}: purchase failed`, entry.last_result);
    }
  }

  await deps.save(list);
  return report;
}

/** Production deps. */
export function defaultWatchDeps(): WatchRunDeps {
  return {
    list: getWatchlist,
    save: (l) => setWatchlist(l),
    availability: (d) => checkAvailability(d),
    purchase: async (d, cap) => {
      const r = await purchaseDomain(d, { expectedPriceUsd: cap, renew: true, attach: true });
      return { ok: r.ok, purchased: r.purchased, priceUsd: r.priceUsd, reason: r.reason };
    },
    registry: (d) => rdapStatus(d),
    registerEnabled: () => {
      const v = String(process.env.VERCEL_DOMAIN_REGISTER_ENABLED ?? '').toLowerCase();
      return v === '1' || v === 'true';
    },
    notify: async (subject, body) => {
      const { sendEmail } = await import('@/lib/email');
      const admins = String(process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim()).filter(Boolean);
      if (!admins.length) return;
      await sendEmail({ to: admins, subject: `[QuickSites] ${subject}`, html: `<p>${body}</p><p>Watchlist: <code>GET /api/admin/domains/watchlist</code></p>` }).catch(() => {});
    },
    task: async (title, details) => {
      const { supabaseAdmin } = await import('@/lib/supabase/admin');
      await supabaseAdmin.from('admin_tasks').insert({ title, details, status: 'open', priority: 'high', category: 'domains', source: 'cron:domain-watch' });
    },
  };
}
