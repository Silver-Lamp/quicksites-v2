'use client';

// components/admin/prospects-client.tsx
//
// Interactive surface for the "businesses near me" fan-out. Discover (sweep a city →
// prospects, no AI), review by lead tier, selectively Build draft sites (AI), Dismiss,
// and launch location-industry domain campaigns from the competition cards.

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { Prospect } from '@/lib/outreach/prospects';
import type { GeoCampaign } from '@/lib/outreach/geoCampaigns';
import { normalizeGscDomain } from '@/lib/gsc/normalizeDomain';
import { effectivePriceCents, formatCents } from '@/lib/outreach/geoPricing';
import { nextActionLabel } from '@/components/admin/templates/campaign-badge';
import { scoreTerritories } from '@/lib/prospects/territoryScore';
import { buildRankedOpportunities } from '@/lib/prospects/rankedOpportunities';
import { computeCoachState, type CoachAction } from '@/lib/prospects/growthCoach';
import GrowthCoach, { actionId } from '@/components/admin/growth-coach';
import {
  addRecentLocation,
  normalizeRecentLocations,
  locationLabel,
  relativeUsed,
  RECENT_LOCATIONS_KEY,
  type RecentLocation,
} from '@/lib/prospects/recentLocations';
import MailPreviewModal, { type MailPreviewData } from '@/components/admin/mail-preview-modal';

const TERRITORY_CELL_DEGREES = 0.02;

type GscStat = { clicks: number; impressions: number; position: number };

/** Rank badge from GSC average position (0/no impressions = not yet indexed). */
function rankBadge(g: GscStat | undefined) {
  if (!g || (!g.impressions && !g.position)) {
    return { label: 'Not ranked', cls: 'bg-neutral-800 text-neutral-500' };
  }
  const p = g.position;
  if (p > 0 && p <= 10) return { label: `Page 1 · #${p}`, cls: 'bg-emerald-500/20 text-emerald-300' };
  if (p > 0 && p <= 20) return { label: `Page 2 · #${p}`, cls: 'bg-amber-500/20 text-amber-300' };
  return { label: g.impressions ? `Ranking · #${p}` : 'Indexed', cls: 'bg-sky-500/15 text-sky-300' };
}

// Leaflet is client-only — load the sweep map without SSR.
const ProspectsMap = dynamic(() => import('@/components/admin/prospects-map'), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-xs text-neutral-500">Loading map…</div>,
});

// Curated categories → Google Places (New). Two kinds:
//   • `types`     → Nearby Search `includedTypes` (well-known valid place types,
//                   so a sweep never 400s on an unknown type).
//   • `textQuery` → Text Search keyword, for high-value trades that have NO Places
//                   type at all (towing, HVAC, landscaping, handyman, …). These
//                   can never be found by a type-only sweep.
// `industry` on keyword categories is the canonical IndustryKey the query represents,
// so a keyword-found prospect (generic Places types) still gets the right scaffold.
const CATEGORIES: { label: string; types?: string[]; textQuery?: string; industry?: string }[] = [
  { label: 'Restaurants', types: ['restaurant', 'cafe', 'bar'] },
  { label: 'Plumbing', types: ['plumber'] },
  { label: 'Electrical', types: ['electrician'] },
  { label: 'HVAC', textQuery: 'HVAC contractor', industry: 'hvac' },
  { label: 'Painting', types: ['painter'] },
  { label: 'Roofing', types: ['roofing_contractor'] },
  { label: 'Contractor', types: ['general_contractor'] },
  { label: 'Handyman', textQuery: 'handyman service', industry: 'general_contractor' },
  { label: 'Landscaping', textQuery: 'landscaping service', industry: 'landscaping' },
  { label: 'Tree service', textQuery: 'tree service', industry: 'landscaping' },
  { label: 'Pest control', textQuery: 'pest control', industry: 'pest_control' },
  { label: 'Cleaning', textQuery: 'house cleaning service', industry: 'other' },
  { label: 'Junk removal', textQuery: 'junk removal', industry: 'junk_removal' },
  { label: 'Garage door', textQuery: 'garage door repair', industry: 'general_contractor' },
  { label: 'Appliance repair', textQuery: 'appliance repair', industry: 'other' },
  { label: 'Locksmith', types: ['locksmith'] },
  { label: 'Moving', types: ['moving_company'] },
  { label: 'Storage', types: ['storage'] },
  { label: 'Towing', textQuery: 'towing service', industry: 'towing' },
  { label: 'Auto repair', types: ['car_repair'] },
  { label: 'Car wash', types: ['car_wash'] },
  { label: 'Auto detailing', textQuery: 'auto detailing', industry: 'auto_repair' },
  { label: 'Dental', types: ['dentist'] },
  { label: 'Veterinary', types: ['veterinary_care'] },
  { label: 'Salon / Spa', types: ['hair_care', 'beauty_salon', 'nail_salon', 'spa'] },
  { label: 'Fitness', types: ['gym'] },
  { label: 'Real estate', types: ['real_estate_agency'] },
  { label: 'Insurance', types: ['insurance_agency'] },
  { label: 'Accounting', types: ['accounting'] },
  { label: 'Legal', types: ['lawyer'] },
];

const TIER_META: Record<string, { label: string; cls: string }> = {
  no_website: { label: 'No website', cls: 'bg-emerald-500/20 text-emerald-300' },
  dated: { label: 'Dated site', cls: 'bg-amber-500/20 text-amber-300' },
  has_site: { label: 'Has a site', cls: 'bg-neutral-800 text-neutral-400' },
};

function prettyIndustry(key: string | null): string {
  if (!key) return 'Business';
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

type Blocker = { id: string; severity: 'hard' | 'soft'; label: string };

/** Read the cached readiness state off a campaign (outreach_blockers + outreach_ready_at). */
function readinessOf(c: GeoCampaign) {
  const blockers: Blocker[] = Array.isArray(c.outreach_blockers) ? c.outreach_blockers : [];
  const hard = blockers.filter((b) => b.severity === 'hard');
  const soft = blockers.filter((b) => b.severity === 'soft');
  return { blockers, hard, soft, ready: !!c.outreach_ready_at };
}

export default function ProspectsClient({
  initialProspects,
  initialCampaigns,
  channels = { mail: false, sms: false, call: false },
  callCounts = {},
  readinessGate = false,
}: {
  initialProspects: Prospect[];
  initialCampaigns: GeoCampaign[];
  /** Which paid outreach channels are enabled server-side (env-gated). */
  channels?: { mail: boolean; sms: boolean; call: boolean };
  /** Tracked-call count per geo-campaign id. */
  callCounts?: Record<string, number>;
  /** When true, Mail/Text are hard-blocked until a campaign is marked refined. */
  readinessGate?: boolean;
}) {
  const router = useRouter();
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [radiusKm, setRadiusKm] = useState(3);
  const [picked, setPicked] = useState<Set<string>>(new Set(['Restaurants']));
  // Recently-swept locations. Persisted per-operator server-side (site_settings) so
  // they follow the admin across devices; a localStorage mirror paints instantly on
  // reload before the fetch resolves. The most recent auto-fills the form.
  const [recent, setRecent] = useState<RecentLocation[]>([]);
  const [showRecent, setShowRecent] = useState(false);

  // Prefill the form from a sweep, but only into fields the operator hasn't touched.
  const prefillFrom = (l: RecentLocation) => {
    setCity((c) => (c ? c : l.city));
    setRegion((r) => (r ? r : l.region));
    setRadiusKm((rk) => (rk !== 3 ? rk : l.radiusKm));
    setPicked((p) => (p.size === 1 && p.has('Restaurants') && l.categories.length ? new Set(l.categories) : p));
  };
  const mirrorLocal = (list: RecentLocation[]) => {
    try {
      localStorage.setItem(RECENT_LOCATIONS_KEY, JSON.stringify(list));
    } catch {
      /* ignore quota/private-mode */
    }
  };

  useEffect(() => {
    // 1) Instant paint from the localStorage mirror (no flash before the fetch).
    let cached: RecentLocation[] = [];
    try {
      cached = normalizeRecentLocations(JSON.parse(localStorage.getItem(RECENT_LOCATIONS_KEY) || '[]'));
    } catch {
      /* ignore malformed storage */
    }
    if (cached.length) {
      setRecent(cached);
      prefillFrom(cached[0]);
    }
    // 2) Server is the source of truth (per-operator, cross-device).
    let alive = true;
    fetch('/api/admin/prospects/recent-locations')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive || !j?.ok) return;
        const list = normalizeRecentLocations(j.locations);
        setRecent(list);
        mirrorLocal(list);
        if (!cached.length && list.length) prefillFrom(list[0]);
      })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Persist a just-swept location to the front of the recents list (server + mirror). */
  function rememberLocation(entry: Omit<RecentLocation, 'usedAt'>) {
    // Optimistic local update so the dropdown reflects the sweep immediately.
    setRecent((prev) => {
      const next = addRecentLocation(prev, { ...entry, usedAt: Date.now() });
      mirrorLocal(next);
      return next;
    });
    post('/api/admin/prospects/recent-locations', entry)
      .then((j) => {
        if (j?.ok) {
          const list = normalizeRecentLocations(j.locations);
          setRecent(list);
          mirrorLocal(list);
        }
      })
      .catch(() => {});
  }

  /** Restore a recent location's full sweep params into the form. */
  function applyRecent(l: RecentLocation) {
    setCity(l.city);
    setRegion(l.region);
    setRadiusKm(l.radiusKm);
    if (l.categories.length) setPicked(new Set(l.categories));
    setShowRecent(false);
  }

  function clearRecent() {
    setRecent([]);
    setShowRecent(false);
    mirrorLocal([]);
    post('/api/admin/prospects/recent-locations', { clear: true }).catch(() => {});
  }

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showTerritories, setShowTerritories] = useState(false);
  const [territoryBrief, setTerritoryBrief] = useState<{ label: string; why: string }[] | null>(null);
  const [briefMsg, setBriefMsg] = useState<string | null>(null);
  const [mailPreview, setMailPreview] = useState<{ campaign: GeoCampaign; data: MailPreviewData } | null>(null);
  const [testAddr, setTestAddr] = useState<{ name: string; line: string } | null>(null);
  const [webhookEvent, setWebhookEvent] = useState('postcard.delivered');
  useEffect(() => {
    let alive = true;
    fetch('/api/admin/prospects/test-recipient')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j?.recipient) {
          const t = j.recipient;
          setTestAddr({ name: t.name, line: `${t.line1}, ${t.city}, ${t.state} ${t.zip}` });
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  // Per-campaign inline result for the Mail/Text actions (so feedback shows on the
  // row, not just a banner at the top of the page that scrolls out of view).
  const [rowMsg, setRowMsg] = useState<Record<string, { ok: boolean; text: string }>>({});
  // GSC rank/traffic per domain (28-day), best-effort + lazy — proves "which have we ranked".
  const [gscByDomain, setGscByDomain] = useState<Record<string, GscStat> | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    fetch('/api/gsc/summary')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j?.ok && j.byDomain) setGscByDomain(j.byDomain); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Postcard delivery + per-prospect scan roll-up per campaign (lazy, best-effort).
  type MailSummary = { total: number; delivered: number; inTransit: number; returned: number; scanned: number };
  const [mailByCampaign, setMailByCampaign] = useState<Record<string, MailSummary>>({});
  useEffect(() => {
    let alive = true;
    const ids = initialCampaigns.map((c) => c.id).join(',');
    if (!ids) return;
    fetch(`/api/admin/prospects/mailings?ids=${encodeURIComponent(ids)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j?.ok && j.byCampaign) setMailByCampaign(j.byCampaign); })
      .catch(() => {});
    return () => { alive = false; };
  }, [initialCampaigns]);

  const prospects = initialProspects;

  const toggleCat = (label: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });

  const toggleSel = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  async function post(url: string, body: unknown): Promise<any> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || `Request failed (${res.status}).`);
    return json;
  }

  async function discover() {
    setMsg(null);
    if (!city.trim()) return setMsg('Enter a city to sweep.');
    const pickedCats = [...picked].map((l) => CATEGORIES.find((c) => c.label === l)).filter(Boolean) as typeof CATEGORIES;
    const includedTypes = pickedCats.flatMap((c) => c.types ?? []);
    const textCategories = pickedCats
      .filter((c) => c.textQuery)
      .map((c) => ({ query: c.textQuery as string, industry: c.industry }));
    if (!includedTypes.length && !textCategories.length) return setMsg('Pick at least one category.');
    setBusy('discover');
    try {
      const r = await post('/api/admin/prospects/discover', {
        city: city.trim(),
        region: region.trim(),
        radiusMeters: Math.round(radiusKm * 1000),
        includedTypes,
        textCategories,
      });
      setMsg(
        `Swept ${r.found} businesses — ${r.tallies.no_website} no website, ${r.tallies.dated} dated, ${r.tallies.has_site} with a site. (${r.inserted} new)`,
      );
      rememberLocation({ city: city.trim(), region: region.trim(), radiusKm, categories: [...picked] });
      router.refresh();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function buildSelected() {
    const ids = [...selected];
    if (!ids.length) return setMsg('Select prospects to build.');
    setBusy('build');
    setMsg(null);
    try {
      const r = await post('/api/admin/prospects/build', { prospectIds: ids.slice(0, 10) });
      setMsg(`Built ${r.built} draft site(s). They're now in the Outreach pipeline.`);
      setSelected(new Set());
      router.refresh();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function dismiss(id: string) {
    setBusy(id);
    try {
      await post('/api/admin/prospects/dismiss', { id });
      router.refresh();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(null);
    }
  }

  const campaignCount = (campaignId: string) =>
    prospects.filter((p) => p.geo_campaign_id === campaignId).length;

  async function setTestAddress() {
    const current = testAddr?.line ?? '';
    const formatted = window.prompt(
      'Live-test mailing address (Street, City, ST ZIP).\nA test send mails one real card here instead of the prospects. Leave blank to clear.',
      current,
    );
    if (formatted === null) return; // cancelled
    try {
      const r = await post('/api/admin/prospects/test-recipient', formatted.trim() ? { formatted: formatted.trim() } : { clear: true });
      if (r.recipient) {
        const t = r.recipient;
        setTestAddr({ name: t.name, line: `${t.line1}, ${t.city}, ${t.state} ${t.zip}` });
        setMsg(`Test address set: ${t.line1}, ${t.city}, ${t.state} ${t.zip}`);
      } else {
        setTestAddr(null);
        setMsg('Test address cleared.');
      }
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  async function selfTestWebhook() {
    setBusy('webhook-selftest');
    setMsg(null);
    try {
      const r = await post('/api/admin/prospects/webhook-selftest', { event: webhookEvent });
      const w = r.webhook;
      if (r.ok && r.mailing.advanced) {
        setMsg(`✅ Webhook OK (${r.signed ? 'signed' : 'unsigned'}) — ${r.lobId} advanced ${r.mailing.statusBefore ?? '—'} → ${r.mailing.statusAfter}.`);
      } else if (r.ok) {
        setMsg(`Webhook returned 200 but status didn't change (already ${r.mailing.statusAfter ?? 'unknown'}). Try a later event or check the row.`);
      } else {
        setMsg(`⚠️ Webhook responded ${w.status}: ${w.body}${r.note ? ` — ${r.note}` : ''}`);
      }
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(null);
    }
  }

  // Open the pre-send preview (dry-run: no spend) — shows the real personalized card,
  // the deliverability breakdown, and the estimated cost before the operator commits.
  async function openMailPreview(c: GeoCampaign) {
    if (!channels.mail) return;
    setBusy(`mail:${c.id}`);
    setRowMsg((m) => { const { [c.id]: _drop, ...rest } = m; return rest; });
    try {
      const data = await post('/api/admin/prospects/mail-postcards/preview', { campaignId: c.id });
      setMailPreview({ campaign: c, data });
    } catch (e: any) {
      setRowMsg((m) => ({ ...m, [c.id]: { ok: false, text: e.message } }));
    } finally {
      setBusy(null);
    }
  }

  // Confirmed from the preview modal → the real, paid Lob send (or a single test card).
  async function confirmMail(test: boolean) {
    if (!mailPreview) return;
    const c = mailPreview.campaign;
    setBusy(`mail:${c.id}`);
    try {
      const r = await post('/api/admin/prospects/mail-postcards', { campaignId: c.id, test });
      setRowMsg((m) => ({
        ...m,
        [c.id]: { ok: true, text: r.test ? `Test card mailed to your test address` : `Mailed ${r.mailed} postcard(s)` },
      }));
      setMailPreview(null);
      router.refresh();
    } catch (e: any) {
      setRowMsg((m) => ({ ...m, [c.id]: { ok: false, text: e.message } }));
      setMailPreview(null);
    } finally {
      setBusy(null);
    }
  }

  async function textProspects(c: GeoCampaign) {
    if (!channels.sms) return;
    const n = campaignCount(c.id);
    if (!window.confirm(`Text the claim link for ${c.domain} to ${n} competing business${n === 1 ? '' : 'es'}?\n\nThis sends real SMS (Twilio) and may incur cost.`)) return;
    setBusy(`sms:${c.id}`);
    setRowMsg((m) => { const { [c.id]: _drop, ...rest } = m; return rest; });
    try {
      const r = await post('/api/admin/prospects/text-prospects', { campaignId: c.id });
      setRowMsg((m) => ({ ...m, [c.id]: { ok: true, text: `Sent ${r.sent} text(s)` } }));
      router.refresh();
    } catch (e: any) {
      setRowMsg((m) => ({ ...m, [c.id]: { ok: false, text: e.message } }));
    } finally {
      setBusy(null);
    }
  }

  async function provisionNumber(c: GeoCampaign) {
    if (!channels.call) return;
    const forwardTo = window.prompt(
      `Buy a tracking number for ${c.domain} and forward calls to which phone?\n\nThis provisions a real Twilio number (~$1/mo). Leave blank to use the platform fallback.`,
      '',
    );
    if (forwardTo === null) return; // cancelled
    setBusy(`call:${c.id}`);
    setRowMsg((m) => { const { [c.id]: _drop, ...rest } = m; return rest; });
    try {
      const r = await post('/api/admin/prospects/geo-campaign/provision-number', {
        campaignId: c.id,
        forwardTo: forwardTo.trim() || undefined,
      });
      setRowMsg((m) => ({ ...m, [c.id]: { ok: true, text: `Tracking number: ${r.number}` } }));
      router.refresh();
    } catch (e: any) {
      setRowMsg((m) => ({ ...m, [c.id]: { ok: false, text: e.message } }));
    } finally {
      setBusy(null);
    }
  }

  async function setPrice(c: GeoCampaign) {
    setBusy(`price:${c.id}`);
    setRowMsg((m) => { const { [c.id]: _drop, ...rest } = m; return rest; });
    try {
      const r = await post('/api/admin/prospects/geo-campaign/set-pricing', { campaignId: c.id });
      setRowMsg((m) => ({ ...m, [c.id]: { ok: true, text: `Plan set: ${formatCents(r.pricing.locked_rate_cents)} → ${formatCents(r.pricing.price_cents)}/mo` } }));
      router.refresh();
    } catch (e: any) {
      setRowMsg((m) => ({ ...m, [c.id]: { ok: false, text: e.message } }));
    } finally {
      setBusy(null);
    }
  }

  async function rent(c: GeoCampaign) {
    const email = window.prompt(`Create a rental checkout link for ${c.domain}.\n\nRenter email (optional):`, c.renter_email || '');
    if (email === null) return; // cancelled
    setBusy(`rent:${c.id}`);
    setRowMsg((m) => { const { [c.id]: _drop, ...rest } = m; return rest; });
    try {
      const r = await post('/api/admin/prospects/geo-campaign/rent', { campaignId: c.id, renterEmail: email.trim() || undefined });
      if (r.url) window.open(r.url, '_blank', 'noopener,noreferrer');
      setRowMsg((m) => ({ ...m, [c.id]: { ok: true, text: 'Checkout link opened — send it to the renter' } }));
      router.refresh();
    } catch (e: any) {
      setRowMsg((m) => ({ ...m, [c.id]: { ok: false, text: e.message } }));
    } finally {
      setBusy(null);
    }
  }

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  async function setOrg(c: GeoCampaign) {
    const slug = window.prompt(
      `Brand ${c.domain} to which org? Enter an org slug (e.g. "cedarsites") so prospects see that brand on the postcard, claim page, and links.\n\nLeave blank to reset to the QuickSites default.`,
      c.org_id ? '' : '',
    );
    if (slug === null) return; // cancelled
    setBusy(`org:${c.id}`);
    setRowMsg((m) => { const { [c.id]: _drop, ...rest } = m; return rest; });
    try {
      const body = slug.trim() ? { campaignId: c.id, orgSlug: slug.trim() } : { campaignId: c.id, clear: true };
      const r = await post('/api/admin/prospects/geo-campaign/set-org', body);
      setRowMsg((m) => ({ ...m, [c.id]: { ok: true, text: `Branded as ${r.brand.name}` } }));
      router.refresh();
    } catch (e: any) {
      setRowMsg((m) => ({ ...m, [c.id]: { ok: false, text: e.message } }));
    } finally {
      setBusy(null);
    }
  }

  async function recomputeRecs(c: GeoCampaign) {
    setBusy(`recs:${c.id}`);
    setRowMsg((m) => { const { [c.id]: _drop, ...rest } = m; return rest; });
    try {
      await post('/api/admin/prospects/geo-campaign/recompute-recs', { campaignId: c.id });
      setRowMsg((m) => ({ ...m, [c.id]: { ok: true, text: 'Recommendations recomputed' } }));
      router.refresh();
    } catch (e: any) {
      setRowMsg((m) => ({ ...m, [c.id]: { ok: false, text: e.message } }));
    } finally {
      setBusy(null);
    }
  }

  async function recomputeAllRecs() {
    setBusy('recs:all');
    setMsg(null);
    try {
      const r = await post('/api/admin/prospects/geo-campaign/recompute-recs', {});
      setMsg(`Recomputed recommendations for ${r.recced} campaign${r.recced === 1 ? '' : 's'}${r.failed ? ` (${r.failed} failed)` : ''}.`);
      router.refresh();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(null);
    }
  }

  // Mark a pitch site refined (or clear it). Does its own fetch so a 409 hard-blocked
  // response can surface the specific blockers instead of a generic error.
  async function markRefined(c: GeoCampaign, ready: boolean) {
    setBusy(`refine:${c.id}`);
    setRowMsg((m) => { const { [c.id]: _drop, ...rest } = m; return rest; });
    try {
      const res = await fetch('/api/admin/prospects/geo-campaign/mark-refined', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: c.id, ready }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const hard = Array.isArray(json.blockers) ? json.blockers.filter((b: any) => b.severity === 'hard').map((b: any) => b.label) : [];
        setRowMsg((m) => ({ ...m, [c.id]: { ok: false, text: hard.length ? `Refine first: ${hard.join(' · ')}` : (json.error || 'Failed to update.') } }));
        return;
      }
      setRowMsg((m) => ({ ...m, [c.id]: { ok: true, text: ready ? 'Marked ready for outreach ✓' : 'Marked not ready' } }));
      router.refresh();
    } catch (e: any) {
      setRowMsg((m) => ({ ...m, [c.id]: { ok: false, text: e.message } }));
    } finally {
      setBusy(null);
    }
  }

  async function setWinner(c: GeoCampaign, prospectId: string | null) {
    setBusy(`winner:${prospectId ?? c.id}`);
    try {
      await post('/api/admin/prospects/geo-campaign/set-winner', { campaignId: c.id, prospectId });
      router.refresh();
    } catch (e: any) {
      setRowMsg((m) => ({ ...m, [c.id]: { ok: false, text: e.message } }));
    } finally {
      setBusy(null);
    }
  }

  async function explainAreas() {
    setBusy('territory-brief');
    setBriefMsg(null);
    try {
      const r = await post('/api/admin/prospects/territory-score', { narrate: true });
      if (r.brief?.length) {
        setTerritoryBrief(r.brief);
      } else {
        setTerritoryBrief(null);
        setBriefMsg('LLM narration is off (set GEO_RECS_LLM_ENABLED=1 + OPENAI_API_KEY) — the map heat still ranks areas by score.');
      }
    } catch (e: any) {
      setBriefMsg(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function passProspect(p: Prospect, undo = false) {
    setBusy(`pass:${p.id}`);
    try {
      await post('/api/admin/prospects/pass', { id: p.id, undo });
      router.refresh();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function launchGeo(group: CompetitionGroup) {
    setBusy(`geo:${group.key}`);
    setMsg(null);
    try {
      const r = await post('/api/admin/prospects/geo-campaign', {
        city: group.city,
        region: group.region,
        industryKey: group.industryKey,
        prospectIds: group.prospects.map((p) => p.id),
      });
      setMsg(`Campaign launched: ${r.domain} (${r.domainStatus}) — pitch site ready, ${r.pitchedProspects} businesses tagged.`);
      router.refresh();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(null);
    }
  }

  // Group no-website prospects by city + industry → competition cards.
  const competition = useMemo(() => buildCompetitionGroups(prospects), [prospects]);

  // "Ranked & ready" worklist: campaigns whose pitch page already ranks, prioritized by
  // rank × unlockable rent × local demand. Reuses the already-fetched gscByDomain map.
  const rankedOpportunities = useMemo(
    () => buildRankedOpportunities(initialCampaigns, prospects, gscByDomain),
    [initialCampaigns, prospects, gscByDomain],
  );
  const anyConnectedRank = rankedOpportunities.some((o) => o.connected);
  const campaignById = useMemo(
    () => new Map(initialCampaigns.map((c) => [c.id, c])),
    [initialCampaigns],
  );
  // Match a competition group (city × industry) to an already-launched campaign, so the
  // cards know they've already spawned a campaign instead of offering a duplicate launch.
  const campaignByGeoKey = useMemo(() => {
    const m = new Map<string, GeoCampaign>();
    for (const c of initialCampaigns) {
      if (!c.city || !c.industry_key || c.status === 'archived') continue;
      m.set(`${c.city.trim().toLowerCase()}::${c.industry_key}`, c);
    }
    return m;
  }, [initialCampaigns]);

  // Competition cards annotated with their launched campaign (if any); open (grabbable)
  // cards sort ahead of already-live ones so the real CTAs lead.
  const orderedCompetition = useMemo(() => {
    return competition
      .map((g) => ({ g, existing: campaignByGeoKey.get(`${g.city.trim().toLowerCase()}::${g.industryKey}`) }))
      .sort((a, b) => Number(!!a.existing) - Number(!!b.existing));
  }, [competition, campaignByGeoKey]);

  /** Scroll to (and briefly highlight) a campaign's row in the Ranked & ready worklist. */
  function scrollToOpp(campaignId: string) {
    const el = document.getElementById(`opp-${campaignId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('ring-2', 'ring-fuchsia-400/70');
    setTimeout(() => el.classList.remove('ring-2', 'ring-fuchsia-400/70'), 1600);
  }

  // ── Growth Coach — next-best-action over the whole funnel, from data already on the page.
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const coachState = useMemo(() => {
    const noWebsiteCount = prospects.filter((p) => p.lead_tier === 'no_website').length;
    const openCompetitionGroups = orderedCompetition.filter((x) => !x.existing).length;
    const o = rankedOpportunities[0];
    const c = o ? campaignById.get(o.campaignId) : undefined;
    const rd = c ? readinessOf(c) : null;
    const top = o && c
      ? {
          campaignId: o.campaignId,
          domain: o.domain,
          templateId: o.templateId,
          orgId: c.org_id ?? null,
          ready: !!c.outreach_ready_at,
          hardBlockers: rd?.hard.length ?? 0,
          competitors: o.competitors,
          hasAddressBlocker: !!rd?.hard.some((b) => b.id === 'no-nap' || b.id === 'no-click-to-call'),
        }
      : null;
    return computeCoachState({
      prospectCount: prospects.length,
      noWebsiteCount,
      openCompetitionGroups,
      campaignCount: initialCampaigns.length,
      connectedRankCount: rankedOpportunities.filter((r) => r.connected).length,
      rankedCount: rankedOpportunities.filter((r) => r.rankStatus !== 'unranked').length,
      top,
      channels: { mail: channels.mail, sms: channels.sms },
      readinessGate,
    });
  }, [prospects, orderedCompetition, rankedOpportunities, campaignById, initialCampaigns.length, channels.mail, channels.sms, readinessGate]);

  async function coachAct(a: CoachAction) {
    const id = actionId(a);
    const c = a.campaignId ? campaignById.get(a.campaignId) : undefined;
    switch (a.kind) {
      case 'discover':
        document.getElementById('discover-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        document.getElementById('discover-city')?.focus();
        break;
      case 'launch-geo':
        document.getElementById('competition-cards')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      case 'connect-gsc':
        setMsg('Connect each geo-domain in Google Search Console (left nav → Google Search Console) so we can read live rank.');
        break;
      case 'refine':
        if (c?.template_id) router.push(`/admin/templates/${c.template_id}`);
        break;
      case 'mark-refined':
        if (c) { setBusyAction(id); try { await markRefined(c, true); } finally { setBusyAction(null); } }
        break;
      case 'mail':
        if (c) openMailPreview(c);
        break;
      case 'point-address':
        if (!c) break;
        setBusyAction(id);
        setMsg(null);
        try {
          const r = await post('/api/admin/prospects/geo-campaign/point-address', { campaignId: c.id });
          const parts = [r.addressSet && r.label ? `address (“${r.label}”)` : null, r.emailSet ? 'contact email' : null].filter(Boolean);
          setMsg(
            r.changed
              ? `Pointed ${c.domain} at your org’s ${parts.join(' + ')}. Recompute recommendations (↻ Recs) to refresh.`
              : `${c.domain}: ${r.reason === 'already_has_address' ? 'already has its own address/email — left it as-is.' : 'no change.'}`,
          );
          router.refresh();
        } catch (e: any) {
          setMsg(e.message);
        } finally {
          setBusyAction(null);
        }
        break;
    }
  }

  // Rank signal for the territory heat: campaigns whose pitch page already ranks →
  // boost the cells they sit in ("double down where we already rank").
  const rankByCampaign = useMemo(() => {
    const m: Record<string, number> = {};
    for (const o of rankedOpportunities) {
      if (o.connected && o.rankStatus !== 'unranked') m[o.campaignId] = o.rankQuality;
    }
    return m;
  }, [rankedOpportunities]);

  // "Where to target next" — score the swept prospects into ranked map cells (pure, client-side).
  const territories = useMemo(
    () => scoreTerritories(prospects, { cellDegrees: TERRITORY_CELL_DEGREES, rankByCampaign }),
    [prospects, rankByCampaign],
  );
  const topTerritory = territories.find((t) => t.viableCards > 0) ?? territories[0];

  // Businesses linked to each launched campaign (the contest roster / waitlist).
  const rosterByCampaign = useMemo(() => {
    const m: Record<string, Prospect[]> = {};
    for (const p of prospects) {
      if (!p.geo_campaign_id || p.status === 'dismissed') continue;
      (m[p.geo_campaign_id] ??= []).push(p);
    }
    return m;
  }, [prospects]);

  const byTier = useMemo(() => {
    const g: Record<string, Prospect[]> = { no_website: [], dated: [], has_site: [] };
    for (const p of prospects) (g[p.lead_tier] ?? g.has_site).push(p);
    return g;
  }, [prospects]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 text-white">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Businesses near me</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Sweep a city for businesses with no website (or a dated one), build claimable sites, and grab the
            exact-match geo domains.
          </p>
        </div>
        <a href="/admin/outreach" className="text-sm text-amber-300 underline underline-offset-4 hover:text-amber-200">
          Outreach pipeline →
        </a>
      </div>

      {/* Growth Coach — the expandable next-best-action panel, pinned at the top. */}
      <div className="mt-6">
        <GrowthCoach state={coachState} onAction={coachAct} busyAction={busyAction} />
      </div>

      {/* Discover panel */}
      <div id="discover-panel" className="mt-6 scroll-mt-24 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-xs text-neutral-400">
            City
            <input
              id="discover-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && discover()}
              placeholder="Boston"
              className="mt-1 w-44 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="flex flex-col text-xs text-neutral-400">
            State
            <input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && discover()}
              placeholder="MA"
              className="mt-1 w-24 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="flex flex-col text-xs text-neutral-400">
            Radius: {radiusKm} km
            <input
              type="range"
              min={1}
              max={25}
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="mt-3 w-40"
            />
          </label>
          <button
            onClick={discover}
            disabled={busy === 'discover'}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {busy === 'discover' ? 'Sweeping…' : 'Discover'}
          </button>

          {recent.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowRecent((v) => !v)}
                title="Re-run a recent sweep — restores its city, radius, and categories"
                className="flex items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-300 hover:text-white"
              >
                🕘 Recent
                <span className={`text-[10px] transition-transform ${showRecent ? 'rotate-180' : ''}`}>▾</span>
              </button>
              {showRecent && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowRecent(false)} />
                  <div className="absolute left-0 top-full z-20 mt-1 w-72 overflow-hidden rounded-lg border border-neutral-700 bg-neutral-900 shadow-xl">
                    <div className="flex items-center justify-between px-3 py-1.5 text-[11px] uppercase tracking-wide text-neutral-500">
                      <span>Recent sweeps</span>
                      <button onClick={clearRecent} className="text-neutral-500 hover:text-red-400">Clear</button>
                    </div>
                    <ul className="max-h-72 overflow-y-auto">
                      {recent.map((l) => (
                        <li key={`${l.city}|${l.region}`}>
                          <button
                            onClick={() => applyRecent(l)}
                            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-800"
                          >
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{locationLabel(l)}</span>
                              <span className="block truncate text-[11px] text-neutral-500">
                                {l.radiusKm} km · {l.categories.length ? l.categories.join(', ') : 'all'}
                              </span>
                            </span>
                            <span className="shrink-0 text-[10px] text-neutral-600">{relativeUsed(l.usedAt, Date.now())}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.label}
              onClick={() => toggleCat(c.label)}
              className={`rounded-full px-3 py-1 text-xs ${
                picked.has(c.label)
                  ? 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40'
                  : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {msg && <div className="mt-4 rounded-lg border border-neutral-800 bg-neutral-900/60 px-4 py-2 text-sm text-neutral-200">{msg}</div>}

      {/* Ranked & ready — the prioritized worklist. Campaigns whose pitch page already
          ranks float to the top; refine each site before mailing (none have clients yet). */}
      {rankedOpportunities.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Ranked &amp; ready — work the warmest assets first</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Geo-sites prioritized by rank × unlockable rent × local demand. Refine each site before mailing — none have clients yet.
          </p>
          {!anyConnectedRank && (
            <div className="mt-2 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-xs text-neutral-400">
              None of these domains are connected to Search Console yet — connect them to see live rank. Ordered by unlockable rent for now.
            </div>
          )}
          <div className="mt-3 space-y-2">
            {rankedOpportunities.map((o) => {
              const c = campaignById.get(o.campaignId);
              if (!c) return null;
              const badge = rankBadge(o.gsc ?? undefined);
              const trend = c.rank_trend;
              const rd = readinessOf(c);
              const outreachBlocked = readinessGate && !rd.ready;
              return (
                <div key={o.campaignId} id={`opp-${o.campaignId}`} className="scroll-mt-24 rounded-xl border border-neutral-800 bg-neutral-900/40 p-3 transition-shadow">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${badge.cls}`}>{badge.label}</span>
                      {trend?.positionDelta ? (
                        <span
                          className={`shrink-0 text-xs ${trend.direction === 'up' ? 'text-emerald-400' : trend.direction === 'down' ? 'text-red-400' : 'text-neutral-500'}`}
                          title="Change in position since the last sync"
                        >
                          {trend.direction === 'up' ? '▲' : trend.direction === 'down' ? '▼' : '→'} {Math.abs(trend.positionDelta).toFixed(0)}
                        </span>
                      ) : null}
                      <div className="min-w-0">
                        <div className="truncate font-mono text-sm text-sky-300">{o.domain}</div>
                        <div className="truncate text-xs text-neutral-500">
                          {o.city} · {prettyIndustry(o.industryKey)} · {formatCents(o.monthlyRentCents)}/mo · {o.competitors} competitor{o.competitors === 1 ? '' : 's'}
                          {o.gsc && (o.gsc.clicks || o.gsc.impressions) ? <span> · {o.gsc.clicks} clk · {o.gsc.impressions} impr</span> : null}
                        </div>
                        {/* Readiness: refine before mailing (none of these have clients yet). */}
                        {rd.ready ? (
                          <div className="mt-0.5 text-xs text-emerald-400">Ready ✓{rd.soft.length ? ` · ${rd.soft.length} optional polish` : ''}</div>
                        ) : rd.hard.length ? (
                          <div className="mt-0.5 truncate text-xs text-amber-400" title={rd.hard.map((b) => b.label).join(' · ')}>
                            Refine — {rd.hard.length} blocker{rd.hard.length === 1 ? '' : 's'}: {rd.hard.slice(0, 2).map((b) => b.label).join(' · ')}{rd.hard.length > 2 ? '…' : ''}
                          </div>
                        ) : (
                          <div className="mt-0.5 text-xs text-neutral-500">Not yet marked ready for outreach</div>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-xs">
                      {o.templateId && (
                        <a
                          href={`/admin/templates/${o.templateId}`}
                          className="rounded-lg bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-500"
                        >
                          Refine →
                        </a>
                      )}
                      <button
                        onClick={() => markRefined(c, !rd.ready)}
                        disabled={busy === `refine:${c.id}` || (!rd.ready && rd.hard.length > 0)}
                        title={rd.ready ? 'Marked ready — click to un-mark' : rd.hard.length ? `Clear ${rd.hard.length} hard blocker(s) first` : 'Mark this site refined and ready to mail'}
                        className={`rounded-lg border px-3 py-1.5 font-medium ${rd.ready ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20' : rd.hard.length ? 'cursor-not-allowed border-neutral-800 text-neutral-600' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'}`}
                      >
                        {busy === `refine:${c.id}` ? '…' : rd.ready ? 'Refined ✓' : 'Mark refined'}
                      </button>
                      <button
                        onClick={() => openMailPreview(c)}
                        disabled={!channels.mail || outreachBlocked || busy === `mail:${c.id}`}
                        title={!channels.mail ? 'Postcard mail is off — set LOB_API_KEY + LOB_FROM_* + POSTCARD_MAIL_ENABLED=1' : outreachBlocked ? 'Mark the site refined first' : 'Preview the postcard + cost, then confirm the send'}
                        className={`rounded-lg border px-3 py-1.5 font-medium ${channels.mail && !outreachBlocked ? 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20' : 'cursor-not-allowed border-neutral-800 text-neutral-600'}`}
                      >
                        {busy === `mail:${c.id}` ? '…' : 'Mail'}
                      </button>
                      <button
                        onClick={() => textProspects(c)}
                        disabled={!channels.sms || outreachBlocked || busy === `sms:${c.id}`}
                        title={!channels.sms ? 'SMS is off — set PROSPECT_SMS_ENABLED=1 (requires A2P 10DLC)' : outreachBlocked ? 'Mark the site refined first' : 'Text the claim link to each business'}
                        className={`rounded-lg border px-3 py-1.5 font-medium ${channels.sms && !outreachBlocked ? 'border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20' : 'cursor-not-allowed border-neutral-800 text-neutral-600'}`}
                      >
                        {busy === `sms:${c.id}` ? '…' : 'Text'}
                      </button>
                    </div>
                  </div>
                  {rowMsg[o.campaignId] && (
                    <div className={`mt-2 text-xs ${rowMsg[o.campaignId].ok ? 'text-emerald-400' : 'text-red-400'}`}>{rowMsg[o.campaignId].text}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Competition cards — city × industry clusters, in a horizontal scroll row above the
          map. A card that already spawned a campaign shows it (domain + rank + readiness) and
          links into "Ranked & ready" instead of offering a duplicate launch. */}
      {orderedCompetition.length > 0 && (
        <div id="competition-cards" className="mt-8 scroll-mt-24">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Competition cards — grab the domain</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Each is a cluster of no-website businesses competing for one exact-match geo-domain.
            <span className="text-emerald-400"> Green</span> = open to grab ·<span className="text-sky-300"> sky</span> = campaign already live.
          </p>
          <div className="mt-3 flex snap-x gap-3 overflow-x-auto pb-2">
            {orderedCompetition.map(({ g, existing }) => {
              if (existing) {
                const gsc = gscByDomain?.[normalizeGscDomain(existing.domain)];
                const badge = rankBadge(gsc);
                const rd = readinessOf(existing);
                return (
                  <div key={g.key} className="flex w-72 shrink-0 snap-start flex-col rounded-xl border border-sky-900/60 bg-sky-950/20 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-sm font-semibold text-white">{g.city} · {prettyIndustry(g.industryKey)}</div>
                      <span className="shrink-0 rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-medium text-sky-200">✓ Live</span>
                    </div>
                    <div className="mt-1 truncate font-mono text-xs text-sky-300">{existing.domain}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={`rounded px-1.5 py-0.5 text-[11px] ${badge.cls}`}>{badge.label}</span>
                      <span className="text-xs text-neutral-500">{g.prospects.length} competitor{g.prospects.length === 1 ? '' : 's'}</span>
                    </div>
                    <div className="mt-1 flex-1 text-xs">
                      {rd.ready ? (
                        <span className="text-emerald-400">Ready ✓</span>
                      ) : rd.hard.length ? (
                        <span className="text-amber-400">Refine — {rd.hard.length} blocker{rd.hard.length === 1 ? '' : 's'}</span>
                      ) : (
                        <span className="text-neutral-500">Not yet marked ready</span>
                      )}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => scrollToOpp(existing.id)}
                        title="Jump to this campaign in Ranked & ready"
                        className="flex-1 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs font-medium text-sky-200 hover:bg-sky-500/20"
                      >
                        Open ↑
                      </button>
                      {existing.template_id && (
                        <a
                          href={`/admin/templates/${existing.template_id}`}
                          className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-center text-xs font-medium text-white hover:bg-indigo-500"
                        >
                          Refine →
                        </a>
                      )}
                    </div>
                  </div>
                );
              }
              return (
                <div key={g.key} className="flex w-72 shrink-0 snap-start flex-col rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-4">
                  <div className="truncate text-sm font-semibold text-white">{g.city} · {prettyIndustry(g.industryKey)}</div>
                  <div className="mt-1 text-xs text-neutral-400">{g.prospects.length} businesses with no website</div>
                  <ul className="mt-2 flex-1 space-y-0.5 text-xs text-neutral-300">
                    {g.prospects.slice(0, 4).map((p) => (
                      <li key={p.id} className="truncate">• {p.business_name}</li>
                    ))}
                    {g.prospects.length > 4 && <li className="text-neutral-500">+{g.prospects.length - 4} more</li>}
                  </ul>
                  <button
                    onClick={() => launchGeo(g)}
                    disabled={busy === `geo:${g.key}`}
                    className="mt-3 w-full rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {busy === `geo:${g.key}` ? 'Launching…' : 'Launch geo-domain campaign'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Map of swept prospects — click a marker to select it for building. */}
      {prospects.some((p) => p.address_lat != null && p.address_lon != null) && (
        <div className="mt-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowTerritories((v) => !v)}
                title="Overlay a heat grid scoring which areas to target next — by unlockable rent (competition cards × industry value), minus saturation"
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                  showTerritories
                    ? 'border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-200'
                    : 'border-neutral-700 bg-neutral-900 text-neutral-300 hover:text-white'
                }`}
              >
                {showTerritories ? '◼ Hide territory heat' : '◻ Where to target next'}
              </button>
              {showTerritories && (
                <button
                  onClick={explainAreas}
                  disabled={busy === 'territory-brief'}
                  title="Ask the LLM to narrate the top-scored areas as a plain-language brief (grounded in the scores; metered + flag-gated)"
                  className="rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1.5 text-xs font-medium text-fuchsia-200 hover:bg-fuchsia-500/20 disabled:opacity-50"
                >
                  {busy === 'territory-brief' ? 'Thinking…' : '✨ Explain top areas'}
                </button>
              )}
            </div>
            {showTerritories && topTerritory && topTerritory.viableCards > 0 && (
              <span className="text-xs text-fuchsia-200/90">
                Best cell: <strong>{formatCents(topTerritory.estMonthlyRentCents)}/mo</strong> across{' '}
                {topTerritory.viableCards} card{topTerritory.viableCards === 1 ? '' : 's'}
                {topTerritory.rationale.topIndustry ? ` · ${prettyIndustry(topTerritory.rationale.topIndustry)}` : ''}
                {topTerritory.rationale.rankedHere ? <span className="text-emerald-300"> · ★ already ranking</span> : null}
              </span>
            )}
          </div>
          {showTerritories && territoryBrief && territoryBrief.length > 0 && (
            <div className="mb-2 rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/[0.06] p-3">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-fuchsia-300/80">Target next ✨</div>
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {territoryBrief.map((a, idx) => (
                  <li key={idx}>
                    <span className="font-medium">{a.label}</span>
                    <span className="text-neutral-500"> — {a.why}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {showTerritories && briefMsg && (
            <div className="mb-2 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-xs text-neutral-400">{briefMsg}</div>
          )}
          <div className="h-[420px] overflow-hidden rounded-xl border border-neutral-800">
            <ProspectsMap
              prospects={prospects}
              selected={selected}
              onToggle={toggleSel}
              territories={showTerritories ? territories : undefined}
              cellDegrees={TERRITORY_CELL_DEGREES}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-neutral-400">
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-emerald-400" /> No website</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-amber-400" /> Dated site</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-neutral-500" /> Has a site</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-indigo-400" /> Selected</span>
            {showTerritories && (
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-fuchsia-500/60" /> Target-score cell (darker = better)</span>
            )}
            {showTerritories && territories.some((t) => t.rationale.rankedHere) && (
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm border-2 border-dashed border-emerald-400" /> Already ranking here (boosted)</span>
            )}
          </div>
        </div>
      )}

      {/* Existing campaigns */}
      {initialCampaigns.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Geo-domain campaigns</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={setTestAddress}
                title={testAddr ? `Live-test postcards mail here: ${testAddr.line}` : 'Set a live-test mailing address — test sends go here instead of the prospects'}
                className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-200 hover:bg-sky-500/20"
              >
                🧪 {testAddr ? `Test → ${testAddr.line}` : 'Set test address'}
              </button>
              <div className="flex items-center overflow-hidden rounded-lg border border-emerald-500/30 bg-emerald-500/10">
                <select
                  value={webhookEvent}
                  onChange={(e) => setWebhookEvent(e.target.value)}
                  title="Which Lob event to simulate against the latest mailing"
                  className="border-r border-emerald-500/20 bg-transparent px-2 py-1.5 text-xs font-medium text-emerald-200 focus:outline-none [&>option]:bg-neutral-900 [&>option]:text-white"
                >
                  <option value="postcard.in_transit">in_transit</option>
                  <option value="postcard.in_local_area">in_local_area</option>
                  <option value="postcard.processed_for_delivery">processed_for_delivery</option>
                  <option value="postcard.delivered">delivered</option>
                  <option value="postcard.re_routed">re_routed</option>
                  <option value="postcard.returned_to_sender">returned_to_sender</option>
                  <option value="postcard.failed">failed</option>
                </select>
                <button
                  onClick={selfTestWebhook}
                  disabled={busy === 'webhook-selftest'}
                  title="Fire this signed synthetic event at our own Lob webhook (latest mailing) to verify signature + status update — no Lob dashboard needed"
                  className="px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
                >
                  {busy === 'webhook-selftest' ? 'Testing…' : '🔔 Test webhook'}
                </button>
              </div>
              <button
                onClick={recomputeAllRecs}
                disabled={busy === 'recs:all'}
                title="Recompute the next-steps recommendations for every campaign now, without waiting for the daily rank-sync cron"
                className="rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1.5 text-xs font-medium text-fuchsia-200 hover:bg-fuchsia-500/20 disabled:opacity-50"
              >
                {busy === 'recs:all' ? 'Recomputing…' : '↻ Recompute recommendations'}
              </button>
            </div>
          </div>
          <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-800">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-900">
                <tr className="text-left [&>th]:px-4 [&>th]:py-2 [&>th]:font-medium [&>th]:text-neutral-400">
                  <th>Domain</th><th>City</th><th>Industry</th><th>Domain status</th><th>Status</th><th>Ranking</th><th>Calls</th><th>Plan</th><th>Outreach</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {initialCampaigns.map((c) => {
                  const roster = rosterByCampaign[c.id] ?? [];
                  const isOpen = expanded.has(c.id);
                  const recs =
                    c.recommendations && (c.recommendations.nextAction || (Array.isArray(c.recommendations.ranking) && c.recommendations.ranking.length))
                      ? c.recommendations
                      : null;
                  const nextCount = recs ? (recs.ranking?.length ?? 0) + (recs.nextAction ? 1 : 0) : 0;
                  const expandable = roster.length > 0 || !!recs;
                  const tierRank: Record<string, number> = { no_website: 0, dated: 1, has_site: 2 };
                  const sortedRoster = roster.slice().sort((a, b) => {
                    const aw = c.claimed_by_prospect_id === a.id ? 0 : 1;
                    const bw = c.claimed_by_prospect_id === b.id ? 0 : 1;
                    if (aw !== bw) return aw - bw;
                    const ap = a.waitlist_status === 'passed' ? 1 : 0;
                    const bp = b.waitlist_status === 'passed' ? 1 : 0;
                    if (ap !== bp) return ap - bp;
                    return (tierRank[a.lead_tier] ?? 3) - (tierRank[b.lead_tier] ?? 3);
                  });
                  return (
                  <Fragment key={c.id}>
                  <tr className="[&>td]:px-4 [&>td]:py-2">
                    <td className="font-mono text-xs text-sky-300">
                      {expandable && (
                        <button onClick={() => toggleExpand(c.id)} className="mr-1 text-neutral-400 hover:text-white" title="Show next steps + the competition waitlist">
                          {isOpen ? '▾' : '▸'}
                        </button>
                      )}
                      {c.domain}
                      {nextCount > 0 && (
                        <span className="ml-1 rounded-full bg-fuchsia-500/20 px-1.5 py-0.5 text-[10px] font-medium text-fuchsia-200">{nextCount} next</span>
                      )}
                    </td>
                    <td>{c.city}</td>
                    <td>{prettyIndustry(c.industry_key)}</td>
                    <td className="text-xs text-neutral-400">{c.domain_status}</td>
                    <td className="text-xs text-neutral-400">{c.status}</td>
                    <td className="text-xs">
                      {(() => {
                        const g = gscByDomain?.[normalizeGscDomain(c.domain)];
                        const b = rankBadge(g);
                        return (
                          <div className="flex flex-col gap-0.5">
                            <span className={`inline-block w-fit rounded px-1.5 py-0.5 ${b.cls}`}>{b.label}</span>
                            {g && (g.clicks || g.impressions) ? (
                              <span className="text-neutral-500">{g.clicks} clk · {g.impressions} impr</span>
                            ) : null}
                            {c.rank_trend?.positionDelta ? (
                              <span
                                className={c.rank_trend.direction === 'up' ? 'text-emerald-400' : c.rank_trend.direction === 'down' ? 'text-red-400' : 'text-neutral-500'}
                                title="Change in position since the last sync"
                              >
                                {c.rank_trend.direction === 'up' ? '▲' : c.rank_trend.direction === 'down' ? '▼' : '→'} {Math.abs(c.rank_trend.positionDelta).toFixed(0)} spot{Math.abs(c.rank_trend.positionDelta) === 1 ? '' : 's'}
                              </span>
                            ) : null}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="text-xs">
                      {c.tracking_number ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-sky-300">{c.tracking_number}</span>
                          <span className="text-neutral-500">{callCounts[c.id] ?? 0} call{(callCounts[c.id] ?? 0) === 1 ? '' : 's'}</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => provisionNumber(c)}
                          disabled={!channels.call || busy === `call:${c.id}`}
                          title={channels.call ? 'Buy a tracking number that forwards to the business' : 'Call tracking is off — set CALL_TRACKING_ENABLED=1 (+ Twilio creds)'}
                          className={channels.call ? 'text-sky-400 hover:text-sky-300' : 'cursor-not-allowed text-neutral-600'}
                        >
                          {busy === `call:${c.id}` ? '…' : 'Get number'}
                        </button>
                      )}
                    </td>
                    <td className="text-xs">
                      {c.pricing_model === 'flat' ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-neutral-200">{formatCents(effectivePriceCents(c))}/mo</span>
                          {c.rank_status !== 'page1' && c.price_cents && c.locked_rate_cents && c.price_cents !== c.locked_rate_cents ? (
                            <span className="text-amber-400/80">founder → {formatCents(c.price_cents)} on page 1</span>
                          ) : null}
                          {c.subscription_status === 'active' ? (
                            <span className="text-emerald-400">Rented</span>
                          ) : (
                            <button onClick={() => rent(c)} disabled={busy === `rent:${c.id}`} className="w-fit text-sky-400 hover:text-sky-300">
                              {busy === `rent:${c.id}` ? '…' : 'Create rental link'}
                            </button>
                          )}
                        </div>
                      ) : (
                        <button onClick={() => setPrice(c)} disabled={busy === `price:${c.id}`} className="text-sky-400 hover:text-sky-300">
                          {busy === `price:${c.id}` ? '…' : 'Set price'}
                        </button>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex justify-end gap-3 text-xs">
                          <a href={`/admin/prospects/poster/${c.id}`} target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline">Poster</a>
                          <button
                            onClick={() => openMailPreview(c)}
                            disabled={!channels.mail || (readinessGate && !c.outreach_ready_at) || busy === `mail:${c.id}`}
                            title={!channels.mail ? 'Postcard mail is off — set LOB_API_KEY + LOB_FROM_* + POSTCARD_MAIL_ENABLED=1' : readinessGate && !c.outreach_ready_at ? 'Mark the site refined first (Ranked & ready above)' : 'Preview the postcard + cost, then confirm the send'}
                            className={channels.mail && !(readinessGate && !c.outreach_ready_at) ? 'text-amber-400 hover:text-amber-300' : 'cursor-not-allowed text-neutral-600'}
                          >
                            {busy === `mail:${c.id}` ? '…' : 'Mail'}
                          </button>
                          <button
                            onClick={() => textProspects(c)}
                            disabled={!channels.sms || (readinessGate && !c.outreach_ready_at) || busy === `sms:${c.id}`}
                            title={!channels.sms ? 'SMS is off — set PROSPECT_SMS_ENABLED=1 (requires A2P 10DLC)' : readinessGate && !c.outreach_ready_at ? 'Mark the site refined first (Ranked & ready above)' : 'Text the claim link to each business'}
                            className={channels.sms && !(readinessGate && !c.outreach_ready_at) ? 'text-sky-400 hover:text-sky-300' : 'cursor-not-allowed text-neutral-600'}
                          >
                            {busy === `sms:${c.id}` ? '…' : 'Text'}
                          </button>
                          {c.template_id && (
                            <a href={`/admin/templates/${c.template_id}`} className="text-neutral-400 underline">Edit</a>
                          )}
                          <button
                            onClick={() => recomputeRecs(c)}
                            disabled={busy === `recs:${c.id}`}
                            title="Recompute this campaign's next-steps recommendations from current signals"
                            className="text-fuchsia-300 hover:text-fuchsia-200"
                          >
                            {busy === `recs:${c.id}` ? '…' : '↻ Recs'}
                          </button>
                          <button
                            onClick={() => setOrg(c)}
                            disabled={busy === `org:${c.id}`}
                            title={c.org_id ? 'This campaign is branded to an org — click to change or reset' : 'Brand this campaign to an org (e.g. CedarSites) so prospects see that brand'}
                            className={c.org_id ? 'text-teal-300 hover:text-teal-200' : 'text-neutral-500 hover:text-neutral-300'}
                          >
                            {busy === `org:${c.id}` ? '…' : c.org_id ? '🏷 Branded' : '🏷 Brand'}
                          </button>
                        </div>
                        {rowMsg[c.id] && (
                          <div className={rowMsg[c.id].ok ? 'text-xs text-emerald-400' : 'text-xs text-red-400'}>
                            {rowMsg[c.id].text}
                          </div>
                        )}
                        {mailByCampaign[c.id]?.total > 0 && (() => {
                          const m = mailByCampaign[c.id];
                          return (
                            <div className="text-[11px] text-neutral-400" title="Postcard delivery + per-business QR scans">
                              📮 {m.total} mailed
                              {m.delivered > 0 && <span className="text-emerald-400"> · {m.delivered} delivered</span>}
                              {m.inTransit > 0 && <span className="text-sky-300"> · {m.inTransit} in transit</span>}
                              {m.returned > 0 && <span className="text-red-400"> · {m.returned} returned</span>}
                              {m.scanned > 0 && <span className="text-fuchsia-300"> · {m.scanned} scanned</span>}
                            </div>
                          );
                        })()}
                      </div>
                    </td>
                  </tr>
                  {isOpen && expandable && (
                    <tr className="bg-neutral-950/60">
                      <td colSpan={9} className="px-4 py-3">
                        {recs && (
                          <div className="mb-4">
                            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Next steps</div>
                            {Array.isArray(recs.summary?.steps) && recs.summary.steps.length > 0 && (
                              <div className="mb-3 rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/[0.06] p-2">
                                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-fuchsia-300/80">Suggested plan ✨</div>
                                <ol className="list-decimal space-y-1 pl-5 text-sm">
                                  {recs.summary.steps.map((s: any, idx: number) => (
                                    <li key={idx}>
                                      <span className="font-medium">{s.title}</span>
                                      {s.why ? <span className="text-neutral-500"> — {s.why}</span> : null}
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            )}
                            {recs.nextAction && (
                              <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                                <span className="rounded bg-fuchsia-500/20 px-2 py-0.5 text-xs text-fuchsia-200">Work the lead</span>
                                <span className="font-medium">{nextActionLabel(recs.nextAction.action)}</span>
                                <span className="text-neutral-500">— {recs.nextAction.reason}</span>
                              </div>
                            )}
                            {Array.isArray(recs.ranking) && recs.ranking.length > 0 && (
                              <ul className="space-y-1">
                                {recs.ranking.slice(0, 5).map((r: any) => (
                                  <li key={r.id} className="flex items-start gap-2 text-sm">
                                    <span className="mt-0.5 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] uppercase text-emerald-300">{r.category}</span>
                                    <span>
                                      <span className="font-medium">{r.title}</span> <span className="text-neutral-500">— {r.detail}</span>
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                        {roster.length > 0 && (
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          Competition waitlist — one exclusive slot; the rest are churn backfill
                        </div>
                        )}
                        <ul className="space-y-1">
                          {sortedRoster.map((p) => {
                            const isWinner = c.claimed_by_prospect_id === p.id;
                            const passed = p.waitlist_status === 'passed';
                            return (
                              <li key={p.id} className="flex items-center gap-3 text-sm">
                                <span className={`inline-block w-fit rounded px-1.5 py-0.5 text-xs ${TIER_META[p.lead_tier].cls}`}>{TIER_META[p.lead_tier].label}</span>
                                <span className={`min-w-0 flex-1 truncate ${passed ? 'text-neutral-600 line-through' : ''}`}>
                                  {isWinner && <span className="mr-1 text-amber-300" title="Winner">★</span>}
                                  {p.business_name}
                                </span>
                                {isWinner ? (
                                  <button onClick={() => setWinner(c, null)} disabled={busy === `winner:${c.id}`} className="text-xs text-amber-300 hover:text-amber-200">Winner ✓ — clear</button>
                                ) : (
                                  <>
                                    <button onClick={() => setWinner(c, p.id)} disabled={busy === `winner:${p.id}`} className="text-xs text-emerald-400 hover:text-emerald-300">Make winner</button>
                                    {passed ? (
                                      <button onClick={() => passProspect(p, true)} disabled={busy === `pass:${p.id}`} className="text-xs text-neutral-500 hover:text-white">restore</button>
                                    ) : (
                                      <button onClick={() => passProspect(p, false)} disabled={busy === `pass:${p.id}`} className="text-xs text-neutral-500 hover:text-red-400">pass</button>
                                    )}
                                  </>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Prospect list by tier */}
      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Prospects</h2>
        <button
          onClick={buildSelected}
          disabled={!selected.size || busy === 'build'}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
        >
          {busy === 'build' ? 'Building…' : `Build ${selected.size || ''} draft${selected.size === 1 ? '' : 's'}`}
        </button>
      </div>

      {(['no_website', 'dated', 'has_site'] as const).map((tier) =>
        byTier[tier].length ? (
          <div key={tier} className="mt-4">
            <div className="mb-1 text-xs font-medium text-neutral-500">
              {TIER_META[tier].label} · {byTier[tier].length}
            </div>
            <div className="overflow-x-auto rounded-xl border border-neutral-800">
              <table className="min-w-full text-sm">
                <tbody className="divide-y divide-neutral-800">
                  {byTier[tier].map((p) => (
                    <tr key={p.id} className="[&>td]:px-4 [&>td]:py-2.5 align-middle">
                      <td className="w-8">
                        {p.status === 'discovered' && (
                          <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSel(p.id)} />
                        )}
                      </td>
                      <td className="font-medium">
                        {p.business_name}
                        {p.lead_tier === 'dated' && p.freshness_signals?.length ? (
                          <div className="mt-0.5 text-xs font-normal text-amber-400/80">{p.freshness_signals.join(' · ')}</div>
                        ) : null}
                      </td>
                      <td className="max-w-[16rem] truncate text-xs text-neutral-500">{p.address}</td>
                      <td>
                        <span className={`rounded px-2 py-0.5 text-xs ${TIER_META[p.lead_tier].cls}`}>
                          {TIER_META[p.lead_tier].label}
                          {p.lead_tier === 'dated' && p.freshness_score != null ? ` · ${p.freshness_score}` : ''}
                        </span>
                      </td>
                      <td className="text-xs text-neutral-500">{prettyIndustry(p.industry_key)}</td>
                      <td>
                        {p.status === 'draft_built' ? (
                          <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-300">Built</span>
                        ) : p.website ? (
                          <a href={p.website} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-400 underline">
                            site ↗
                          </a>
                        ) : (
                          <span className="text-xs text-neutral-600">—</span>
                        )}
                      </td>
                      <td className="text-right">
                        {p.status === 'draft_built' && p.template_id ? (
                          <a href={`/admin/templates/${p.template_id}`} className="text-xs text-sky-400 underline">Edit →</a>
                        ) : (
                          <button onClick={() => dismiss(p.id)} disabled={busy === p.id} className="text-xs text-neutral-500 hover:text-red-400">
                            dismiss
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null,
      )}

      {prospects.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-neutral-800 px-4 py-10 text-center text-sm text-neutral-500">
          No prospects yet — sweep a city above to find businesses without sites.
        </div>
      )}

      {/* Pre-send preview + cost confirm — the operator sees the real card, who mails,
          who's dropped, and the estimated spend before any paid Lob call. */}
      {mailPreview && (
        <MailPreviewModal
          data={mailPreview.data}
          sending={busy === `mail:${mailPreview.campaign.id}`}
          onCancel={() => setMailPreview(null)}
          onConfirm={confirmMail}
        />
      )}
    </div>
  );
}

type CompetitionGroup = {
  key: string;
  city: string;
  region: string | null;
  industryKey: string;
  prospects: Prospect[];
};

/** Group open no-website prospects by city + industry into competition cards (≥2). */
function buildCompetitionGroups(prospects: Prospect[]): CompetitionGroup[] {
  const map = new Map<string, CompetitionGroup>();
  for (const p of prospects) {
    if (p.lead_tier !== 'no_website' || p.status !== 'discovered') continue;
    if (!p.city || !p.industry_key || p.industry_key === 'other') continue;
    const key = `${p.city.toLowerCase()}::${p.industry_key}`;
    if (!map.has(key)) {
      map.set(key, { key, city: p.city, region: p.region, industryKey: p.industry_key, prospects: [] });
    }
    map.get(key)!.prospects.push(p);
  }
  return [...map.values()].filter((g) => g.prospects.length >= 2).sort((a, b) => b.prospects.length - a.prospects.length);
}
