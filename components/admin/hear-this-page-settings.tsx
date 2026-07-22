'use client';

// components/admin/hear-this-page-settings.tsx
//
// Super-admin config for the platform "Hear this page" launcher (Phase 2). Per public
// surface (home / tenant sites / marketing): enable it + choose which registers it offers.
// `summary` (the short version) is the always-on baseline; extra kinds only ever WIDEN a
// surface (data-kinds narrows the house embed, backend still gates). The master ON switch
// (and the billing gate) is the NEXT_PUBLIC_HEAR_THIS_PAGE_ENABLED env flag — shown here
// read-only, since flipping it is a deploy-time spend decision.

import * as React from 'react';
import type {
  HearThisPageKind,
  HearThisPageSettings,
  HearThisPageSurface,
} from '@/lib/hearThisPage/config';

const SURFACE_LABEL: Record<HearThisPageSurface, string> = {
  home: 'Homepage (/)',
  sites: 'Published sites (/sites/*, delivered.menu)',
  marketing: 'Marketing pages (everything else public)',
};
const KIND_LABEL: Record<HearThisPageKind, string> = {
  summary: 'The short version',
  eli10: "Explain it like I'm 10",
  pitch_panel: 'The Pitch Panel',
  whats_new: "What's new",
};

export default function HearThisPageSettingsClient() {
  const [settings, setSettings] = React.useState<HearThisPageSettings | null>(null);
  const [enabled, setEnabled] = React.useState(false);
  const [allKinds, setAllKinds] = React.useState<HearThisPageKind[]>([]);
  const [allSurfaces, setAllSurfaces] = React.useState<HearThisPageSurface[]>([]);
  const [status, setStatus] = React.useState<string>('');
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [forbidden, setForbidden] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      const res = await fetch('/api/admin/hear-this-page');
      if (res.status === 403) { setForbidden(true); setLoading(false); return; }
      const data = await res.json();
      setSettings(data.settings);
      setEnabled(!!data.enabled);
      setAllKinds(data.allKinds ?? []);
      setAllSurfaces(data.allSurfaces ?? []);
      setLoading(false);
    })().catch(() => setLoading(false));
  }, []);

  function toggleSurface(surface: HearThisPageSurface, on: boolean) {
    setSettings((s) => (s ? { ...s, surfaces: { ...s.surfaces, [surface]: { ...s.surfaces[surface], enabled: on } } } : s));
  }
  function toggleKind(surface: HearThisPageSurface, kind: HearThisPageKind, on: boolean) {
    if (kind === 'summary') return; // baseline, always on
    setSettings((s) => {
      if (!s) return s;
      const cur = new Set(s.surfaces[surface].kinds);
      if (on) cur.add(kind); else cur.delete(kind);
      cur.add('summary');
      return { ...s, surfaces: { ...s.surfaces, [surface]: { ...s.surfaces[surface], kinds: Array.from(cur) } } };
    });
  }

  async function save() {
    if (!settings) return;
    setSaving(true); setStatus('');
    try {
      const res = await fetch('/api/admin/hear-this-page', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setSettings(data.settings);
      setStatus('Saved.');
    } catch (e: any) {
      setStatus(e?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (forbidden) return <p className="text-sm text-red-500">Forbidden — platform admin only.</p>;
  if (!settings) return <p className="text-sm text-red-500">Could not load settings.</p>;

  return (
    <div className="space-y-6">
      <div className={`rounded-lg border p-3 text-sm ${enabled ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-amber-500/40 bg-amber-500/5'}`}>
        <b>Master switch:</b> {enabled ? 'ON' : 'OFF'} —{' '}
        <code>NEXT_PUBLIC_HEAR_THIS_PAGE_ENABLED</code>. {enabled
          ? 'Live renders are billed (QS-billed on the house embed). The per-surface config below narrows what shows.'
          : 'The launcher renders nothing until this env flag is set at deploy time. Flipping it on = billed renders — a deliberate spend decision.'}
      </div>

      {allSurfaces.map((surface) => {
        const cfg = settings.surfaces[surface];
        return (
          <div key={surface} className="rounded-xl border border-border p-4">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={cfg.enabled} onChange={(e) => toggleSurface(surface, e.target.checked)} />
              {SURFACE_LABEL[surface]}
            </label>
            <div className={`mt-3 flex flex-wrap gap-3 ${cfg.enabled ? '' : 'opacity-40 pointer-events-none'}`}>
              {allKinds.map((kind) => (
                <label key={kind} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={cfg.kinds.includes(kind)}
                    disabled={kind === 'summary'}
                    onChange={(e) => toggleKind(surface, kind, e.target.checked)}
                  />
                  {KIND_LABEL[kind]}
                  {kind === 'summary' ? <span className="text-xs text-muted-foreground">(default)</span> : null}
                </label>
              ))}
            </div>
          </div>
        );
      })}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {status ? <span className="text-sm text-muted-foreground">{status}</span> : null}
      </div>

      <p className="text-xs text-muted-foreground">
        House narrator, always labeled as such — never presented as anyone&apos;s own voice.
        Adding registers here only widens a surface; the house embed still gates what&apos;s
        available, and <code>whats_new</code> keeps its commerce guardrail (guest-negative
        diffs omitted).
      </p>
    </div>
  );
}
