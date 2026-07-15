'use client';

// components/admin/templates/next-step-button.tsx
//
// The "next step" affordance on the templates list. Two shapes:
//  - action step (e.g. generate a city/service page): a button that runs the
//    endpoint in place, re-scores the row, and refreshes the list.
//  - deep-link step: a link into the editor at the relevant block (?reveal=<type>).
// Shared by the card grid + the table so the action logic lives in one place.

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { ArrowRight, Sparkles, Loader2, Factory } from 'lucide-react';
import type { NextStep } from '@/lib/outreach/readiness';

// action key → endpoint. The endpoint accepts { templateId } and validates that the
// site actually supports it (e.g. is a geo pitch site), so this stays declarative.
const ACTION_ENDPOINT: Record<string, string> = {
  generate_city_page: '/api/admin/prospects/geo-campaign/add-city-page',
  fill_office_address: '/api/admin/templates/fill-park-address',
};

// Per-action button label + icon (falls back to the checklist CTA + Sparkles).
const ACTION_LABEL: Record<string, string> = {
  fill_office_address: 'Use a park address',
};

/** Human toast for an in-place action result (success or no-change reason). */
function resultMessage(action: string, j: any): string {
  if (action === 'fill_office_address') {
    if (j?.changed) return j?.parkName ? `Address filled from ${j.parkName}` : 'Office address filled';
    if (j?.reason === 'no_parks') return `No industrial parks found near ${j?.city ?? 'this city'} — try the editor.`;
    if (j?.reason === 'no_city') return 'No city on this site yet — set one in the editor first.';
    if (j?.reason === 'not_applicable') return 'Industrial-park addresses don’t fit this site type.';
    if (j?.reason === 'disabled') return 'The industrial-park registry is turned off.';
    return 'No change.';
  }
  // generate_city_page (default)
  if (j?.changed === false) {
    return j?.reason === 'already_exists' ? 'A city/service page already exists.' : 'No change.';
  }
  return `Added /${j?.slug ?? 'page'}`;
}

function deriveHref(slug: string | null | undefined, ns: NextStep): string | null {
  if (ns.href) return ns.href;
  if (!slug) return null;
  return ns.blockType
    ? `/admin/templates/${slug}?reveal=${encodeURIComponent(ns.blockType)}`
    : `/admin/templates/${slug}`;
}

type Props = {
  nextStep: NextStep | null | undefined;
  slug: string | null | undefined;
  templateId: string | null | undefined;
  /** Present when the row is a geo pitch site — gates the in-place actions. */
  isGeoSite?: boolean;
  variant?: 'card' | 'table';
};

export default function NextStepButton({ nextStep, slug, templateId, isGeoSite, variant = 'card' }: Props) {
  const [busy, setBusy] = useState(false);

  const readyCls =
    variant === 'card' ? 'text-[11px] font-medium text-emerald-400/80' : 'text-[10px] font-medium text-emerald-400/80';
  if (!nextStep) return <span className={readyCls}>{variant === 'card' ? 'SEO ready ✓' : 'ready ✓'}</span>;

  const btnCls =
    variant === 'card'
      ? 'inline-flex items-center gap-1 rounded-md border border-fuchsia-500/30 bg-fuchsia-500/10 px-2 py-0.5 text-[11px] font-medium text-fuchsia-200 transition hover:bg-fuchsia-500/20 disabled:opacity-50'
      : 'inline-flex items-center gap-1 rounded border border-fuchsia-500/30 bg-fuchsia-500/10 px-1.5 py-0.5 text-[10px] font-medium text-fuchsia-200 hover:bg-fuchsia-500/20 disabled:opacity-50';

  const canAct = !!nextStep.action && !!isGeoSite && !!templateId && !!ACTION_ENDPOINT[nextStep.action];

  if (canAct) {
    const run = async () => {
      if (busy) return;
      setBusy(true);
      try {
        const res = await fetch(ACTION_ENDPOINT[nextStep.action!], {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateId }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error || 'Could not complete that step.');
        // Re-score so the list reflects the change, then reload it.
        await fetch('/api/admin/templates/rescore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: templateId }),
        }).catch(() => {});
        toast[j?.changed === false && j?.reason && j.reason !== 'already_exists' ? 'error' : 'success'](
          resultMessage(nextStep.action!, j)
        );
        window.dispatchEvent(new CustomEvent('qs:templates:refetch'));
      } catch (e: any) {
        toast.error(e?.message || 'Could not complete that step.');
      } finally {
        setBusy(false);
      }
    };
    const ActionIcon = nextStep.action === 'fill_office_address' ? Factory : Sparkles;
    const actionLabel = ACTION_LABEL[nextStep.action!] ?? nextStep.cta;
    const actionTitle =
      nextStep.action === 'fill_office_address'
        ? 'Fill a real industrial-park address (discovers parks automatically) and save — no editor trip'
        : nextStep.hint || nextStep.label;
    return (
      <button type="button" onClick={run} disabled={busy} title={actionTitle} className={btnCls}>
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <ActionIcon className="h-3 w-3" />} {actionLabel}
      </button>
    );
  }

  const href = deriveHref(slug, nextStep);
  if (!href) return null;
  return (
    <Link href={href} prefetch={false} title={nextStep.hint || nextStep.label} className={btnCls}>
      <ArrowRight className="h-3 w-3" /> {variant === 'card' ? `Next: ${nextStep.cta}` : nextStep.cta}
    </Link>
  );
}
