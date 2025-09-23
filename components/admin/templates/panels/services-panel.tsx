// components/admin/templates/panels/services-panel.tsx
'use client';

import * as React from 'react';
import Collapsible from '@/components/ui/collapsible-panel';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Template } from '@/types/template';
import { Sparkles, CalendarPlus, HelpCircle, RefreshCcw, Plus } from 'lucide-react';
import { resolveIndustry } from '@/lib/industries';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

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

function getCustomIndustry(template: any): string | null {
  const t = template ?? {};
  // try the canonical places first
  const v =
    t?.data?.identity?.industry_other ??
    t?.data?.identity?.industry_label ??               // sometimes your UI writes the same string here
    t?.data?.meta?.identity?.industry_other ??
    t?.data?.meta?.identity?.industry_label ??
    t?.identity?.industry_other ??
    t?.identity?.industry_label ??
    t?.data?.meta?.industry_other ??
    t?.data?.meta?.industry_label ??
    null;

  const s = typeof v === 'string' ? v.trim() : '';
  return s || null;
}

type CompanyOption = { id: string; name?: string | null };
const RECENT_KEY = 'qs_company_recent_ids';

export default function ServicesPanel({
  template,
  onChange,
  companyId,
}: {
  template: Template | any;
  onChange: (patch: Partial<Template>) => void; // parent triggers a single commit
  /** Optional override; falls back to template.company_id */
  companyId?: string;
}) {
  // ---- Template-derived state ----
  const meta = (template?.data as any)?.meta ?? {};
  const contact = meta?.contact ?? {};
  const persisted = (template?.data as any)?.services ?? template.services ?? [];

  // Initial company source of truth
  const templateCompanyId: string | undefined =
    companyId ??
    (template?.company_id as string | undefined) ??
    (template?.data?.company_id as string | undefined);

  // ---- Local UI state ----
  const [draft, setDraft] = React.useState<Row[]>(rowsFrom(persisted));
  const [touched, setTouched] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // AI suggestion state
  const [aiBusy, setAiBusy] = React.useState(false);
  const [aiError, setAiError] = React.useState<string | null>(null);
  const [serverUsed, setServerUsed] = React.useState<string | null>(null);

  // Company selector state
  const [companyField, setCompanyField] = React.useState<string>(templateCompanyId ?? '');
  const [companies, setCompanies] = React.useState<CompanyOption[]>([]);
  const [companiesLoading, setCompaniesLoading] = React.useState(false);
  const [creatingCompany, setCreatingCompany] = React.useState(false);
  const [companyMsg, setCompanyMsg] = React.useState<string | null>(null);
  const [companyErr, setCompanyErr] = React.useState<string | null>(null);

  // Import-to-scheduler state
  const [importing, setImporting] = React.useState(false);
  const [importMsg, setImportMsg] = React.useState<string | null>(null);
  const [importErr, setImportErr] = React.useState<string | null>(null);

  // ---- Industry / Site-type basis (for badges and AI) ----
  const rawIndustry: any = meta?.industry ?? template?.industry ?? null;
  const r: any = resolveIndustry ? resolveIndustry(rawIndustry) : rawIndustry;
  let industryKey = '', industryLabel = '';
  if (typeof r === 'string') {
    industryKey = r.toLowerCase().trim();
    industryLabel = r.trim();
  } else if (r && typeof r === 'object') {
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

  // ---- Sync when template changes ----
  React.useEffect(() => {
    setDraft(rowsFrom(persisted as string[]));
    setTouched(false);
  }, [JSON.stringify(persisted)]);

  React.useEffect(() => {
    setCompanyField(templateCompanyId ?? '');
  }, [templateCompanyId]);

  const isDirty =
    touched &&
    JSON.stringify(clean(draft.map((r) => r.value))) !==
      JSON.stringify(clean(persisted as string[]));

  // ---- Save services list ----
  const save = async () => {
    const cleaned = clean(draft.map((r) => r.value));
    setSaving(true);
    try {
      onChange({
        data: {
          ...(template.data as any),
          services: cleaned,
          meta: { ...((template.data as any)?.meta ?? {}), services: cleaned },
        },
        services: cleaned,
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

  // ---- AI Suggest ----
  const canSuggest = Boolean(effectiveKey);
  const suggest = async (mode: 'append' | 'replace' = 'append', count = 6) => {
    if (!canSuggest || aiBusy) return;
    setAiBusy(true);
    setAiError(null);
    const custom = getCustomIndustry(template);
    try {
      const res = await fetch('/api/services/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: template.id,
      
          // keep keys for backwards-compat
          industry: effectiveKey,            // e.g., "small_business" when 'other' selected
          industry_key: effectiveKey,
      
          // ⬇️ Prefer the human-typed string for the model
          industry_other: custom || undefined,
          industry_label:  custom || industryLabel,   // "Furniture Assembly" instead of "Other"
      
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

  // ---- Companies (dropdown) ----
  const loadCompanies = React.useCallback(async () => {
    setCompaniesLoading(true);
    setCompanyErr(null);
    setCompanyMsg(null);
    try {
      const res = await fetch('/api/company/list', { cache: 'no-store' }).catch(() => null);
      let rows: CompanyOption[] = [];
      if (res?.ok) {
        const data = await res.json();
        rows = Array.isArray(data?.companies) ? data.companies : [];
      }
      // merge recents + current field into the list
      let recents: string[] = [];
      try { recents = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch {}
      const merged = [
        ...rows,
        ...recents
          .filter((id) => !rows.some((r) => r.id === id))
          .map((id) => ({ id })),
        ...(companyField && !rows.some((r) => r.id === companyField) ? [{ id: companyField }] : []),
      ];
      const map = new Map<string, CompanyOption>();
      merged.forEach((o) => o.id && map.set(o.id, o));
      setCompanies(Array.from(map.values()));
    } finally {
      setCompaniesLoading(false);
    }
  }, [companyField]);

  React.useEffect(() => { loadCompanies(); }, [loadCompanies]);

  function applyCompany() {
    const id = (companyField || '').trim();
    if (!id) { setCompanyErr('Please choose a Company'); return; }
    setCompanyErr(null);
    setCompanyMsg(null);

    // Store on both top-level and in data (so other panels can read it)
    onChange({
      company_id: id,
      data: { ...(template.data as any), company_id: id },
    });

    // remember in recents
    try {
      const prev = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') as string[];
      const next = Array.from(new Set([id, ...prev])).slice(0, 10);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {}

    // Optional: request an immediate save so Import button lights up
    requestAnimationFrame(() => {
      try {
        window.dispatchEvent(new CustomEvent('qs:toolbar:save-now', { detail: { source: 'services-panel:company' } }));
      } catch {}
    });

    setCompanyMsg('Company saved to this template.');
  }

  async function handleCreateCompany() {
    setCompanyErr(null);
    setCompanyMsg(null);
    setCreatingCompany(true);
    try {
      // try to suggest a good default name
      const suggested =
        (template?.data?.meta?.business as string) ||
        (template?.business_name as string) ||
        'New Company';
      const name = (prompt('Company name?', suggested) || suggested).trim();
      if (!name) return;

      const res = await fetch('/api/company/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { company_id } = await res.json();

      setCompanyField(company_id);
      await loadCompanies();   // refresh dropdown list
      applyCompany();          // persist to template

      setCompanyMsg('Company created and saved to this template.');
    } catch (e: any) {
      setCompanyErr(e?.message || 'Create company failed.');
    } finally {
      setCreatingCompany(false);
    }
  }

  // ---- Import services → booking tables (company-scoped) ----
  const importToScheduler = async () => {
    setImportMsg(null);
    setImportErr(null);
    const id = (companyField || '').trim();
    if (!id) {
      setImportErr('Need a company_id to import services.');
      return;
    }
    const names = clean(draft.map((r) => r.value));
    if (names.length === 0) {
      setImportErr('No services to import. Add some services first.');
      return;
    }
    setImporting(true);
    try {
      const res = await fetch('/api/scheduler/import-from-template', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          company_id: id,
          services: names,
          default_duration_minutes: 60,
          link_all_services_to_default_resource: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data || `Import failed (${res.status})`);
      setImportMsg(
        `Imported ${data.imported_count} — total ${data.total_count}${data.resource_id ? ' (linked to a default resource).' : '.'}`
      );
    } catch (e: any) {
      setImportErr(e?.message || 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Collapsible title="Available Services" id="template-services">
      <div className="space-y-3">
        {/* ---------- Company selector ---------- */}
        <div className="rounded-md border border-neutral-700/60 p-3">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 opacity-70" />
            <div className="text-xs opacity-80">
              Bookings are scoped to a <b>Company</b> (merchant/business).
            </div>
          </div>

          <div className="mt-2 grid gap-2 md:grid-cols-[minmax(240px,1fr)_auto_auto_auto]">
            <Select
              label="Company"
              value={companyField || ''}
              onValueChange={(v) => { setCompanyField(v); setCompanyMsg(null); setCompanyErr(null); }}
              helperText={!companyField ? 'Select a company or paste an ID below.' : undefined}
            >
              <SelectTrigger>
                <SelectValue placeholder={companiesLoading ? 'Loading…' : 'Select a company'} />
              </SelectTrigger>
              <SelectContent>
                {companies.length === 0 && (
                  <div className="px-2 py-1 text-xs text-muted-foreground">No companies</div>
                )}
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name ? `${c.name} (${c.id.slice(0, 8)})` : c.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="ghost"
              onClick={loadCompanies}
              disabled={companiesLoading}
              className="md:ml-2"
              title="Refresh companies"
            >
              <RefreshCcw className="h-4 w-4 mr-1" />
              {companiesLoading ? 'Refreshing…' : 'Refresh'}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleCreateCompany}
              disabled={creatingCompany}
              title="Create a new company"
            >
              <Plus className="h-4 w-4 mr-1" />
              {creatingCompany ? 'Creating…' : 'New company'}
            </Button>

            <Button type="button" onClick={applyCompany}>Use this</Button>
          </div>

          {/* Manual entry fallback */}
          <div className="mt-2 grid gap-2 md:grid-cols-[minmax(240px,1fr)_auto]">
            <Input
              label="Or enter Company ID"
              placeholder="Paste a UUID"
              value={companyField}
              onChange={(e) => { setCompanyField(e.target.value); setCompanyMsg(null); setCompanyErr(null); }}
            />
            <Button type="button" variant="ghost" onClick={applyCompany}>Apply</Button>
          </div>

          {companyErr && <div className="mt-1 text-xs text-red-400">{companyErr}</div>}
          {companyMsg && <div className="mt-1 text-xs text-emerald-300">{companyMsg}</div>}
        </div>

        {/* ---------- AI Suggest header & badges ---------- */}
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
          {Boolean(effectiveKey) && (
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

        {/* ---------- Sync to booking ---------- */}
        <div className="flex items-center gap-2">
          <div className="text-xs text-white/60">
            Sync to Booking (Scheduler)
            {!companyField && (
              <span className="ml-2 rounded bg-red-500/20 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                company_id required
              </span>
            )}
          </div>
          <div className="ml-auto">
            <Button
              type="button"
              size="sm"
              onClick={importToScheduler}
              disabled={importing || !companyField}
              className="h-8"
              title={companyField ? 'Create app.services and link to a default resource' : 'Set a company first'}
            >
              <CalendarPlus className="h-3.5 w-3.5 mr-1" />
              {importing ? 'Importing…' : 'Import to Scheduler'}
            </Button>
          </div>
        </div>
        {importErr && <div className="text-xs text-red-300">{importErr}</div>}
        {importMsg && <div className="text-xs text-emerald-300">{importMsg}</div>}

        {/* ---------- Services editor ---------- */}
        {aiError && <div className="text-xs text-red-300">AI error: {aiError}</div>}

        {draft.map((row) => (
          <div key={row.id} className="flex gap-2 items-center">
            <Input
              value={row.value}
              placeholder={
                effectiveKey === 'portfolio'
                  ? 'e.g., Web Design'
                  : effectiveKey === 'blog'
                  ? 'e.g., Editorial Consulting'
                  : effectiveKey === 'about_me'
                  ? 'e.g., Speaking'
                  : 'e.g., Roadside Assistance'
              }
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
