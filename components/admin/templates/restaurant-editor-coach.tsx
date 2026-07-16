'use client';

// components/admin/templates/restaurant-editor-coach.tsx
//
// In-editor coach banner for the restaurant vertical — mounted (beside ReadinessCoach)
// when the open template is a restaurant draft or a restaurant_apex portal. Deterministic
// v1 (the "AI" is the brain pattern, not an LLM call — same philosophy as
// lib/prospects/growthCoach.ts): a collapsed one-line headline with the next best action,
// expanding into a short step checklist where the fixes run real endpoints.
//
//  - apex variant:       contest state (public directory feed) + apex-standards status
//                        (server dry-run) + one-click "Refresh apex" (commits + republishes).
//  - restaurant variant: claim status, menu-fill state (live from the editor context),
//                        and pending scaffold upgrades with one-click "Refresh UX".

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTemplateEditor } from '@/context/template-editor-context';

const EXPANDED_KEY = 'qs:restaurant-coach:expanded';

type StepStatus = 'done' | 'active' | 'todo' | 'info';

type CoachStep = {
  key: string;
  status: StepStatus;
  title: string;
  detail: string;
  action?: { label: string; run: () => void; busy: boolean } | null;
};

const STATUS_DOT: Record<StepStatus, string> = {
  done: 'bg-emerald-400',
  active: 'bg-fuchsia-400',
  todo: 'bg-neutral-600',
  info: 'bg-sky-400/70',
};

type ApexStatus = {
  campaignId: string;
  domain: string;
  applied: string[];
  version: number | null;
  currentVersion: number;
};

type DirectoryState = { count: number; hasWinner: boolean; winnerName: string | null };

/** Default scaffold menu items — a menu made only of these still needs real copy. */
const MENU_PLACEHOLDERS = new Set(['Soup of the Day', 'House Salad', 'Signature Dish']);

function menuState(data: any): { hasMenu: boolean; items: number; placeholder: boolean } {
  const pages = Array.isArray(data?.pages) ? data.pages : [];
  for (const p of pages) {
    const blocks = Array.isArray(p?.content_blocks) ? p.content_blocks : Array.isArray(p?.blocks) ? p.blocks : [];
    const m = blocks.find((b: any) => b?.type === 'menu');
    if (m) {
      const sections = Array.isArray(m.content?.sections) ? m.content.sections : [];
      const names = sections
        .flatMap((s: any) => (Array.isArray(s?.items) ? s.items : []))
        .map((i: any) => String(i?.name ?? '').trim())
        .filter(Boolean);
      return {
        hasMenu: true,
        items: names.length,
        placeholder: names.length > 0 && names.every((n: string) => MENU_PLACEHOLDERS.has(n)),
      };
    }
  }
  return { hasMenu: false, items: 0, placeholder: false };
}

export default function RestaurantEditorCoach({
  templateId,
  variant,
  published,
  claimSource,
}: {
  templateId: string;
  variant: 'apex' | 'restaurant';
  published: boolean;
  claimSource: string | null;
}) {
  const ctx = useTemplateEditor();
  const data = (ctx as any)?.template?.data ?? {};

  const [expanded, setExpanded] = useState(false); // collapsed by default, like GrowthCoach
  useEffect(() => {
    try {
      setExpanded(localStorage.getItem(EXPANDED_KEY) === '1');
    } catch { /* ignore */ }
  }, []);
  const toggle = () =>
    setExpanded((v) => {
      const n = !v;
      try { localStorage.setItem(EXPANDED_KEY, n ? '1' : '0'); } catch { /* ignore */ }
      return n;
    });

  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // ---- apex awareness: standards dry-run + the live contest state ------------------
  const [apex, setApex] = useState<ApexStatus | null>(null);
  const [dir, setDir] = useState<DirectoryState | null>(null);
  const loadApex = useCallback(async () => {
    if (variant !== 'apex') return;
    try {
      const res = await fetch(`/api/admin/restaurant-domains/apex-status?templateId=${encodeURIComponent(templateId)}`, { cache: 'no-store' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) return; // no campaign / not admin — banner stays quiet
      setApex({ campaignId: j.campaignId, domain: j.domain, applied: j.applied ?? [], version: j.version, currentVersion: j.currentVersion });
      const dres = await fetch(`/api/public/restaurant-directory?campaign=${encodeURIComponent(j.campaignId)}`, { cache: 'no-store' });
      const dj = await dres.json().catch(() => ({}));
      if (dres.ok && Array.isArray(dj.entries)) {
        const winner = dj.entries.find((e: any) => e.is_winner);
        setDir({ count: dj.entries.length, hasWinner: !!dj.hasWinner, winnerName: winner?.business_name ?? null });
      }
    } catch { /* quiet */ }
  }, [variant, templateId]);
  useEffect(() => { void loadApex(); }, [loadApex]);

  // ---- restaurant awareness: pending scaffold upgrades (server dry-run) ------------
  const [uxPending, setUxPending] = useState<string[] | null>(null);
  const loadUx = useCallback(async () => {
    if (variant !== 'restaurant' || published) return; // refresh-ux refuses live sites
    try {
      const res = await fetch('/api/admin/restaurant-domains/refresh-ux', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, dryRun: true }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(j.applied)) setUxPending(j.applied);
    } catch { /* quiet */ }
  }, [variant, templateId, published]);
  useEffect(() => { void loadUx(); }, [loadUx]);

  // ---- actions ---------------------------------------------------------------------
  const refreshApex = useCallback(async () => {
    if (!apex) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/restaurant-domains/refresh-apex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: apex.campaignId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'Refresh failed.');
      setMsg({
        ok: true,
        text: j.changed
          ? `Applied ${j.applied.length} standard(s): ${j.applied.join(', ').replace(/_/g, ' ')}.${j.republished ? ' Live site republished.' : ''}${j.warning ? ` ⚠ ${j.warning}` : ''}`
          : 'Apex already meets the current standards.',
      });
      await loadApex();
      void (ctx as any)?.refreshFromServer?.();
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  }, [apex, loadApex, ctx]);

  const refreshUx = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/restaurant-domains/refresh-ux', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'Refresh failed.');
      setMsg({
        ok: true,
        text: j.changed
          ? `Applied ${j.applied.length} UX upgrade(s): ${j.applied.join(', ').replace(/_/g, ' ')}.`
          : 'Already up to date.',
      });
      setUxPending([]);
      void (ctx as any)?.refreshFromServer?.();
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  }, [templateId, ctx]);

  // ---- the step checklist (deterministic brain) --------------------------------------
  const menu = useMemo(() => menuState(data), [data]);

  const steps: CoachStep[] = useMemo(() => {
    if (variant === 'apex') {
      const s: CoachStep[] = [];
      s.push(
        dir
          ? dir.hasWinner
            ? { key: 'contest', status: 'done', title: 'Contest decided', detail: `${dir.winnerName ?? 'The winner'} is featured first — ${dir.count} restaurant(s) in the directory.` }
            : { key: 'contest', status: dir.count >= 2 ? 'active' : 'todo', title: 'Contest live — first claim wins', detail: `${dir.count} restaurant(s) racing. The directory renders the eventual winner at the top.` }
          : { key: 'contest', status: 'info', title: 'Contest state', detail: apex ? 'Loading the live directory…' : 'No claim contest found for this apex.' },
      );
      if (apex) {
        s.push(
          apex.applied.length > 0
            ? {
                key: 'standards',
                status: 'active',
                title: `Behind the apex standards (${apex.applied.length})`,
                detail: `Pending: ${apex.applied.join(', ').replace(/_/g, ' ')}. Refreshing commits + republishes the live site.`,
                action: { label: `Refresh apex (${apex.applied.length})`, run: refreshApex, busy },
              }
            : { key: 'standards', status: 'done', title: `Apex standards v${apex.currentVersion} ✓`, detail: 'Directory, chrome, SEO defaults and stamps all current.' },
        );
      }
      s.push({ key: 'yours', status: 'info', title: 'The rest is yours', detail: 'Hero copy, theme and images are never touched by a standards refresh — make this portal local.' });
      return s;
    }

    // restaurant draft / site
    const s: CoachStep[] = [];
    s.push(
      published
        ? { key: 'claim', status: 'done', title: 'Site is live', detail: 'Published and serving diners.' }
        : claimSource === 'listing_import'
          ? { key: 'claim', status: 'active', title: 'Unclaimed outreach draft', detail: 'Share the claim link (Location Domains → copy contest/claim link) to hand it to the owner.' }
          : { key: 'claim', status: 'todo', title: 'Draft — not published yet', detail: 'Publish when the menu and contact details are ready.' },
    );
    s.push(
      !menu.hasMenu
        ? { key: 'menu', status: 'todo', title: 'No menu block', detail: 'A restaurant site sells with its menu — add the menu block.' }
        : menu.items === 0 || menu.placeholder
          ? { key: 'menu', status: 'active', title: 'Fill in the menu copy', detail: menu.placeholder ? 'The menu still shows the scaffold placeholders — replace them with the real items.' : 'The menu block has no items yet.' }
          : { key: 'menu', status: 'done', title: `Menu filled in (${menu.items} item${menu.items === 1 ? '' : 's'})`, detail: 'Review prices before publishing the catalog.' },
    );
    if (!published) {
      s.push(
        uxPending === null
          ? { key: 'ux', status: 'info', title: 'Scaffold upgrades', detail: 'Checking for pending UX upgrades…' }
          : uxPending.length > 0
            ? {
                key: 'ux',
                status: 'active',
                title: `Scaffold upgrades pending (${uxPending.length})`,
                detail: `Pending: ${uxPending.join(', ').replace(/_/g, ' ')}. Idempotent — your edits are respected.`,
                action: { label: `Refresh UX (${uxPending.length})`, run: refreshUx, busy },
              }
            : { key: 'ux', status: 'done', title: 'Scaffold up to date', detail: 'This draft already has every UX upgrade.' },
      );
    }
    return s;
  }, [variant, dir, apex, published, claimSource, menu, uxPending, refreshApex, refreshUx, busy]);

  const primary = steps.find((s) => s.status === 'active') ?? steps.find((s) => s.status === 'todo') ?? null;
  const headline = primary?.title ?? (variant === 'apex' ? 'Apex portal looking good' : 'Restaurant site looking good');
  const primaryAction = primary?.action ?? null;

  return (
    <div className="border-b border-amber-500/30 bg-amber-950/60 px-4 py-2 text-white">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={toggle} className="flex items-center gap-2 text-left" title={expanded ? 'Collapse' : 'Expand the checklist'}>
          <span className="text-sm">{variant === 'apex' ? '🏆' : '🍽'}</span>
          <span className="text-sm font-semibold text-amber-100">
            {variant === 'apex' ? 'Apex coach' : 'Restaurant coach'}
          </span>
          <span className={`text-[10px] text-amber-300/70 transition-transform ${expanded ? 'rotate-180' : ''}`}>▾</span>
        </button>
        <div className="min-w-0 flex-1 truncate text-sm text-neutral-300">
          <span className="text-neutral-500">Next: </span>
          {headline}
        </div>
        {primaryAction && (
          <button
            onClick={primaryAction.run}
            disabled={primaryAction.busy}
            className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
          >
            {primaryAction.busy ? 'Working…' : primaryAction.label}
          </button>
        )}
      </div>

      {msg && <div className={`mt-1 text-xs ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</div>}

      {expanded && (
        <ol className="mt-2 space-y-1.5 border-t border-amber-500/15 pt-2">
          {steps.map((s) => (
            <li key={s.key} className="flex items-start gap-3">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[s.status]}`} title={s.status} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-sm font-medium ${s.status === 'done' ? 'text-neutral-500' : 'text-neutral-100'}`}>{s.title}</span>
                  {s.status === 'done' && <span className="text-[11px] text-emerald-400">✓</span>}
                </div>
                <div className="text-xs text-neutral-400">{s.detail}</div>
              </div>
              {s.action && (
                <button
                  onClick={s.action.run}
                  disabled={s.action.busy}
                  className="shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
                >
                  {s.action.busy ? '…' : s.action.label}
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
