'use client';

// components/profile/seo-coach-card.tsx
//
// Inner content for the "AI SEO Coaching" profile section. Members: two toggles (daily
// next-step + weekly summary) persisted via /api/me/seo-coach-prefs. Free users: a locked
// state + upgrade CTA. Emails are queued by the seo-coach-* crons. See docs/AI_SEO_COACHING.md.

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Loader, Crown } from 'lucide-react';

type Prefs = { daily: boolean; weekly: boolean };

function Toggle({
  label, desc, checked, disabled, onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-zinc-800/50 px-3 py-2.5">
      <div>
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="text-xs text-zinc-400">{desc}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40 ${checked ? 'bg-emerald-500' : 'bg-zinc-600'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

export default function SeoCoachCard({ isMember, onUpgrade }: { isMember: boolean; onUpgrade?: () => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>({ daily: true, weekly: true });

  useEffect(() => {
    let alive = true;
    fetch('/api/me/seo-coach-prefs')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j?.ok) setPrefs({ daily: !!j.prefs.daily, weekly: !!j.prefs.weekly }); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  async function update(next: Partial<Prefs>) {
    const optimistic = { ...prefs, ...next };
    setPrefs(optimistic);
    setSaving(true);
    try {
      const r = await fetch('/api/me/seo-coach-prefs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || 'Could not save');
    } catch (e: any) {
      setPrefs((p) => ({ ...p, ...Object.fromEntries(Object.keys(next).map((k) => [k, !(optimistic as any)[k]])) }));
      toast.error(e?.message || 'Could not save preferences');
    } finally {
      setSaving(false);
    }
  }

  if (!isMember) {
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-300">
          Get a <span className="font-medium text-white">daily next-best-step</span> and a{' '}
          <span className="font-medium text-white">weekly summary</span> for your site&apos;s SEO — grounded in your
          real on-page + Search Console signals. Available on paid plans.
        </p>
        {onUpgrade && (
          <Button onClick={onUpgrade} className="shrink-0 bg-purple-600 hover:bg-purple-500">
            <Crown className="mr-1.5 h-4 w-4" /> Upgrade
          </Button>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-zinc-300">
        <Loader className="h-4 w-4 animate-spin" /> <span className="text-sm">Loading…</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Toggle
        label="Daily next-best-step"
        desc="A short email each morning with the single highest-impact SEO fix."
        checked={prefs.daily}
        disabled={saving}
        onChange={(v) => update({ daily: v })}
      />
      <Toggle
        label="Weekly summary"
        desc="Monday recap: your SEO score, the week's trend, and the top 3 to tackle."
        checked={prefs.weekly}
        disabled={saving}
        onChange={(v) => update({ weekly: v })}
      />
    </div>
  );
}
