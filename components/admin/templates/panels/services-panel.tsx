// components/admin/templates/panels/services-panel.tsx
'use client';

import * as React from 'react';
import Collapsible from '@/components/ui/collapsible-panel';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Template } from '@/types/template';
import { Sparkles } from 'lucide-react';
import { resolveIndustry } from '@/lib/industries';

type Row = { id: string; value: string };
const makeId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `row_${Math.random().toString(36).slice(2)}`;

function rowsFrom(vals: string[]): Row[] {
  return (vals || []).map((v) => ({ id: makeId(), value: String(v || '') }));
}
function clean(vals: string[]) {
  return Array.from(new Set(vals.map((s) => s.trim()).filter(Boolean)));
}

export default function ServicesPanel({
  template,
  onChange,
}: {
  template: Template | any;
  onChange: (patch: Partial<Template>) => void; // parent triggers a single commit
}) {
  const meta = (template?.data as any)?.meta ?? {};
  const contact = meta?.contact ?? {};
  const persisted = (template?.data as any)?.services ?? template.services ?? [];

  const [draft, setDraft] = React.useState<Row[]>(rowsFrom(persisted));
  const [touched, setTouched] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [aiBusy, setAiBusy] = React.useState(false);
  const [aiError, setAiError] = React.useState<string | null>(null);
  const [serverUsed, setServerUsed] = React.useState<string | null>(null);

  // ---- Industry / Site-type basis (for badges and AI) -----------------------
  const rawIndustry: any = meta?.industry ?? template?.industry ?? null;
  const r: any = resolveIndustry ? resolveIndustry(rawIndustry) : rawIndustry;
  let industryKey = '', industryLabel = '';
  if (typeof r === 'string') { industryKey = r.toLowerCase().trim(); industryLabel = r.trim(); }
  else if (r && typeof r === 'object') {
    industryKey = String(r.key ?? r.value ?? '').toLowerCase().trim();
    industryLabel = String(r.label ?? r.name ?? r.value ?? industryKey).trim();
  }
  if (!industryKey && typeof rawIndustry === 'string') {
    industryKey = rawIndustry.toLowerCase().trim();
    industryLabel = rawIndustry.trim();
  }
  const siteType: string | null = (meta?.site_type as string) || null;
  const effectiveKey = (!industryKey || industryKey === 'other') ? (siteType || '') : industryKey;

  // Region context for better suggestions
  const city = String(contact?.city || '');
  const state = String(contact?.state || '');

  // Sync UI when template changes on the outside
  React.useEffect(() => {
    setDraft(rowsFrom(persisted as string[]));
    setTouched(false);
  }, [JSON.stringify(persisted)]);

  const isDirty =
    touched &&
    JSON.stringify(clean(draft.map((r) => r.value))) !==
      JSON.stringify(clean(persisted as string[]));

  // ---- Save (single-path write: onChange only, then one save-now nudge) -----
  const save = async () => {
    const cleaned = clean(draft.map((r) => r.value));
    setSaving(true);
    try {
      // Single in-memory update → parent will build the commit
      onChange({
        data: {
          ...(template.data as any),
          services: cleaned,
          meta: { ...((template.data as any)?.meta ?? {}), services: cleaned },
        },
        services: cleaned, // if you keep a top-level mirror
      });

      // Nudge exactly one commit after React state settles
      requestAnimationFrame(() => {
        try {
          window.dispatchEvent(
            new CustomEvent('qs:toolbar:save-now', { detail: { source: 'services-panel' } })
          );
        } catch {}
      });

      setDraft(rowsFrom(cleaned));
      setTouched(false);
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setDraft(rowsFrom(persisted as string[]));
    setTouched(false);
    setAiError(null);
  };

  // ---- AI Suggest (reads site_type+industry; no local autosaves here) -------
  const canSuggest = Boolean(effectiveKey);
  const suggest = async (mode: 'append' | 'replace' = 'append', count = 6) => {
    if (!canSuggest || aiBusy) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const res = await fetch('/api/services/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: template.id,
          // legacy fields
          industry: effectiveKey,
          industry_key: effectiveKey,
          industry_label: industryLabel,
          // new
          site_type: siteType || null,
          city, state, count, debug: true,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Suggest failed (${res.status})`);
      const suggested: string[] = Array.isArray(json?.services) ? json.services : [];
      setServerUsed(json?.debug?.industry_used ?? json?.debug?.site_type_used ?? null);

      const current = draft.map((r) => r.value);
      const merged = new Set(mode === 'replace' ? suggested : [...current, ...suggested]);
      setDraft(rowsFrom(Array.from(merged)));
      setTouched(true);
    } catch (e: any) {
      setAiError(e?.message || 'AI suggestion failed');
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <Collapsible title="Available Services" id="template-services">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="text-xs text-white/60">
            Used by Services blocks and forms
            {effectiveKey && (
              <span className="ml-2 rounded bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                {(!industryKey || industryKey === 'other') ? `TYPE: ${effectiveKey}` : `INDUSTRY: ${effectiveKey}`}
              </span>
            )}
            {serverUsed && (
              <span className="ml-2 rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                API: {serverUsed}
              </span>
            )}
          </div>
          {canSuggest && (
            <div className="ml-auto flex items-center gap-2">
              <Button type="button" size="sm" onClick={() => suggest('append', 6)} disabled={aiBusy} className="h-8">
                <Sparkles className="h-3.5 w-3.5 mr-1" />
                {aiBusy ? 'Suggesting…' : '✨ Suggest'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => suggest('replace', 8)}
                disabled={aiBusy}
                className="h-8"
                title="Replace with AI suggestions"
              >
                Replace w/ AI
              </Button>
            </div>
          )}
        </div>

        {aiError && <div className="text-xs text-red-300">AI error: {aiError}</div>}

        {draft.map((row) => (
          <div key={row.id} className="flex gap-2 items-center">
            <Input
              value={row.value}
              placeholder={effectiveKey === 'portfolio'
                ? 'e.g., Web Design'
                : effectiveKey === 'blog'
                ? 'e.g., Editorial Consulting'
                : effectiveKey === 'about_me'
                ? 'e.g., Speaking'
                : 'e.g., Roadside Assistance'}
              onChange={(e) => {
                const v = e.target.value;
                setDraft((prev) => prev.map((r) => (r.id === row.id ? { ...r, value: v } : r)));
                setTouched(true);
              }}
              onKeyDown={(e) => e.stopPropagation()}
              className="w-full bg-gray-800 text-white border border-gray-700 rounded px-2 py-1"
            />
            <button
              type="button"
              onClick={() => {
                setDraft((prev) => prev.filter((r) => r.id !== row.id));
                setTouched(true);
              }}
              className="text-red-400 text-sm"
            >
              Remove
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => {
            setDraft((p) => [...p, { id: makeId(), value: '' }]);
            setTouched(true);
          }}
          className="text-sm text-green-400 underline"
        >
          + Add Service
        </button>

        <div className="flex items-center justify-end gap-2 pt-2">
          {isDirty && <span className="text-xs text-amber-300 mr-auto">Unsaved changes</span>}
          <Button type="button" variant="ghost" onClick={cancel} disabled={!isDirty || saving} className="text-sm">
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={!isDirty || saving} className="text-sm">
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </Collapsible>
  );
}
