// components/admin/dev/reset-storage-panel.tsx
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader, AlertTriangle, Settings2 } from 'lucide-react';
import CollapsiblePanel from '@/components/ui/collapsible-panel';

type PurgeMode = 'prefix' | 'targeted' | 'orphans';
type PatternMode = 'regex' | 'glob';
type MatchScope = 'basename' | 'path';

type ApiResult = {
  ok?: boolean;
  mode?: 'preview' | 'deleted';
  aborted?: boolean;
  error?: string;
  storage?: any;
  config?: {
    purgeMode: PurgeMode;
    buckets: string[];
    prefixes: string[];
    safeMode: boolean;
    filenamePattern: string | null;
    patternMode: PatternMode;
    matchScope: MatchScope;
    caseInsensitive: boolean;
    maxDeletes: number | null;
  };
};

type ResetPayload = {
  dryRun: boolean;
  purgeStorage: boolean;
  purgeMode: PurgeMode;
  keepMeals: boolean;
  keepProfile: boolean;
  includeDefaults: boolean;
  safeMode: boolean;
  filenamePattern: string | null;
  patternMode: PatternMode;
  matchScope: MatchScope;
  caseInsensitive: boolean;
  buckets?: string[];
  extraPrefixes?: string[];
  maxDeletes?: number;
};

function csvToList(s: string): string[] {
  return s
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
}

export default function ResetStoragePanel() {
  // Danger defaults (safe-by-default)
  const [purgeStorage, setPurgeStorage] = React.useState(true);
  const [purgeMode, setPurgeMode] = React.useState<PurgeMode>('orphans');

  const [keepMeals, setKeepMeals] = React.useState(true);     // KEEP by default
  const [keepProfile, setKeepProfile] = React.useState(true); // KEEP by default

  // Buckets & prefixes
  const [bucketsCsv, setBucketsCsv] = React.useState(''); // empty = use server defaults
  const [extraPrefixesCsv, setExtraPrefixesCsv] = React.useState('');
  const [includeDefaults, setIncludeDefaults] = React.useState(true);

  // Safe mode pattern
  const [safeMode, setSafeMode] = React.useState(true);
  const [filenamePattern, setFilenamePattern] = React.useState('*-ai.png');
  const [patternMode, setPatternMode] = React.useState<PatternMode>('glob');
  const [matchScope, setMatchScope] = React.useState<MatchScope>('basename');
  const [caseInsensitive, setCaseInsensitive] = React.useState(false);

  // Max deletes guard
  const [maxDeletes, setMaxDeletes] = React.useState<number | ''>('');

  // Controls
  const [pending, setPending] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [res, setRes] = React.useState<ApiResult | null>(null);

  async function callReset(dryRun: boolean, override?: Partial<ResetPayload>) {
    setPending(true);
    setErr(null);
    setRes(null);
    try {
      const payload: ResetPayload = {
        dryRun,
        purgeStorage,
        purgeMode,
        keepMeals,
        keepProfile,
        includeDefaults,
        safeMode,
        filenamePattern: (filenamePattern?.trim() || null),
        patternMode,
        matchScope,
        caseInsensitive,
      };

      // optional state overrides (for presets)
      const merged: ResetPayload = { ...payload, ...override };

      const buckets = csvToList(bucketsCsv);
      if (buckets.length) merged.buckets = buckets;
      const extraPrefixes = csvToList(extraPrefixesCsv);
      if (extraPrefixes.length) merged.extraPrefixes = extraPrefixes;
      if (maxDeletes !== '' && Number.isFinite(Number(maxDeletes))) merged.maxDeletes = Number(maxDeletes);

      const r = await fetch('/api/dev/seed/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Request failed');
      setRes(d);
    } catch (e: any) {
      setErr(e.message || 'Request failed');
    } finally {
      setPending(false);
    }
  }

  // ---- PRESETS -----------------------------------------------------------
  // 1) Clean Demo Data (safe): delete meals + only their generated images
  const CLEAN_DEMO_PRESET: Partial<ResetPayload> = {
    purgeMode: 'targeted',
    keepMeals: false,           // delete meals
    keepProfile: true,          // keep profile
    purgeStorage: true,         // purge related files
    safeMode: true,
    // path-based filter so we only target our generated meal images folder
    matchScope: 'path',
    patternMode: 'regex',
    filenamePattern: '^meals/generated/.*\\.(png|jpe?g|webp)$',
    caseInsensitive: true,
    includeDefaults: true,
    maxDeletes: 200,
  };

  // 2) Nuke Orphans (safe): keep DB rows, remove only unreferenced files
  const NUKE_ORPHANS_PRESET: Partial<ResetPayload> = {
    purgeMode: 'orphans',
    keepMeals: true,            // keep DB rows
    keepProfile: true,
    purgeStorage: true,
    safeMode: true,
    matchScope: 'basename',     // filename-only is fine for orphans
    patternMode: 'regex',
    filenamePattern: '\\.(png|jpe?g|webp)$', // images only
    caseInsensitive: true,
    includeDefaults: true,      // covers profiles/ai-avatars + meals/generated
    maxDeletes: 500,
  };

  function applyPresetToForm(preset: Partial<ResetPayload>) {
    if (preset.purgeMode) setPurgeMode(preset.purgeMode);
    if (typeof preset.keepMeals === 'boolean') setKeepMeals(preset.keepMeals);
    if (typeof preset.keepProfile === 'boolean') setKeepProfile(preset.keepProfile);
    if (typeof preset.purgeStorage === 'boolean') setPurgeStorage(preset.purgeStorage);
    if (typeof preset.safeMode === 'boolean') setSafeMode(preset.safeMode);
    if (preset.filenamePattern !== undefined && preset.filenamePattern !== null) setFilenamePattern(preset.filenamePattern);
    if (preset.patternMode) setPatternMode(preset.patternMode);
    if (preset.matchScope) setMatchScope(preset.matchScope);
    if (typeof preset.caseInsensitive === 'boolean') setCaseInsensitive(preset.caseInsensitive);
    if (typeof preset.includeDefaults === 'boolean') setIncludeDefaults(preset.includeDefaults);
    if (typeof preset.maxDeletes === 'number') setMaxDeletes(preset.maxDeletes);
  }

  const wouldDeleteLabel = purgeMode === 'prefix'
    ? 'Everything under selected prefixes'
    : purgeMode === 'orphans'
      ? 'Only unreferenced files under selected prefixes (orphans)'
      : 'Only files referenced by the rows being deleted (targeted)';

  return (
    <CollapsiblePanel id="reset-storage-panel" title="Reset / Purge Utilities" defaultOpen={false}>
      <div className="rounded-xl border p-4 space-y-4">
        <div className="flex items-center gap-2">
        <span className="text-xs rounded bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5">
          Danger zone — actions are destructive
        </span>
      </div>
      </div>

      {/* PRESET ROW */}
      <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4" />
          <div className="text-sm font-medium">Presets</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Clean demo data */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyPresetToForm(CLEAN_DEMO_PRESET)}
            title="Apply the clean-demo preset settings to the form"
          >
            Apply “Clean demo data”
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => callReset(true, CLEAN_DEMO_PRESET)}
            title="Preview preset (dry-run)"
          >
            {pending ? <><Loader className="mr-2 h-3 w-3 animate-spin" />Preview…</> : 'Preview clean-demo'}
          </Button>
          <Button
            size="sm"
            disabled={pending}
            onClick={() => callReset(false, CLEAN_DEMO_PRESET)}
            title="Run preset now"
          >
            {pending ? <><Loader className="mr-2 h-3 w-3 animate-spin" />Running…</> : 'Run clean-demo'}
          </Button>
          <div className="text-xs text-muted-foreground">
            Deletes <b>meals</b>, keeps <b>profile</b>, and purges <code>meals/generated/</code> images (safe filter, cap=200).
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {/* Nuke orphans (safe) */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyPresetToForm(NUKE_ORPHANS_PRESET)}
            title="Apply the orphans preset settings to the form"
          >
            Apply “Nuke orphans (safe)”
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => callReset(true, NUKE_ORPHANS_PRESET)}
            title="Preview preset (dry-run)"
          >
            {pending ? <><Loader className="mr-2 h-3 w-3 animate-spin" />Preview…</> : 'Preview orphans'}
          </Button>
          <Button
            size="sm"
            disabled={pending}
            onClick={() => callReset(false, NUKE_ORPHANS_PRESET)}
            title="Run preset now"
          >
            {pending ? <><Loader className="mr-2 h-3 w-3 animate-spin" />Running…</> : 'Run orphans'}
          </Button>
          <div className="text-xs text-muted-foreground">
            Keeps all DB rows; removes only <b>unreferenced</b> images under defaults (safe filter, cap=500).
          </div>
        </div>
      </div>

      {err && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {err}
        </div>
      )}

      {/* MAIN CONTROLS */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* High-level controls */}
        <div className="space-y-2">
          <Label>Mode</Label>
          <select
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            value={purgeMode}
            onChange={(e) => setPurgeMode(e.target.value as PurgeMode)}
          >
            <option value="orphans">orphans (recommended)</option>
            <option value="targeted">targeted (only for rows being deleted)</option>
            <option value="prefix">prefix (bulk)</option>
          </select>
          <p className="text-xs text-muted-foreground">{wouldDeleteLabel}.</p>
        </div>

        <div className="space-y-2">
          <Label>Keep data (DB)</Label>
          <div className="flex flex-col gap-2 mt-1">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={keepMeals} onChange={e=>setKeepMeals(e.target.checked)} />
              Keep meals
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={keepProfile} onChange={e=>setKeepProfile(e.target.checked)} />
              Keep chef profile
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={purgeStorage} onChange={e=>setPurgeStorage(e.target.checked)} />
              Purge storage files
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Max Deletes (cap)</Label>
          <Input
            type="number"
            placeholder="e.g. 100"
            value={maxDeletes}
            onChange={(e) => {
              const v = e.target.value;
              if (v === '') setMaxDeletes('');
              else setMaxDeletes(Math.max(1, Math.floor(Number(v))) || '');
            }}
          />
          <p className="text-xs text-muted-foreground">
            Hard cap; purge aborts if candidates &gt; this value. Leave blank to use server default or no cap.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Buckets & prefixes */}
        <div>
          <Label>Buckets (optional)</Label>
          <Input
            placeholder="public,assets"
            value={bucketsCsv}
            onChange={(e) => setBucketsCsv(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Comma-separated. Empty = server defaults/env.
          </p>
        </div>
        <div>
          <Label>Extra Prefixes (optional)</Label>
          <Input
            placeholder="thumbnails/,receipts/"
            value={extraPrefixesCsv}
            onChange={(e) => setExtraPrefixesCsv(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Folders (add trailing <code>/</code>). Sanitized on server.
          </p>
        </div>
        <div className="flex items-end">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeDefaults}
              onChange={(e) => setIncludeDefaults(e.target.checked)}
            />
            Include default prefixes (<code>profiles/ai-avatars/</code>, <code>meals/generated/</code>)
          </label>
        </div>
      </div>

      {/* Safe mode / filename filter */}
      <div className="rounded-lg border p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Label className="m-0">Safe Mode (filename filter)</Label>
          <span className="text-xs text-muted-foreground">(only delete matches)</span>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="flex items-end gap-2">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={safeMode} onChange={e=>setSafeMode(e.target.checked)} />
              Enable safe mode
            </label>
          </div>

          <div>
            <Label>Pattern Mode</Label>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-white dark:bg-neutral-900"
              value={patternMode}
              onChange={(e) => setPatternMode(e.target.value as PatternMode)}
            >
              <option value="glob">glob</option>
              <option value="regex">regex</option>
            </select>
          </div>

          <div>
            <Label>Match Scope</Label>
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-white dark:bg-neutral-900"
              value={matchScope}
              onChange={(e) => setMatchScope(e.target.value as MatchScope)}
            >
              <option value="basename">basename</option>
              <option value="path">path</option>
            </select>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <Label>Filename Pattern</Label>
            <Input
              placeholder={patternMode === 'glob' ? '*-ai.png' : '.*\\.png$'}
              value={filenamePattern}
              onChange={(e) => setFilenamePattern(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={caseInsensitive} onChange={e=>setCaseInsensitive(e.target.checked)} />
              Case-insensitive
            </label>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => callReset(true)}
          title="Preview only — does not delete"
        >
          {pending ? <><Loader className="mr-2 h-4 w-4 animate-spin" />Preview…</> : 'Preview (dry-run)'}
        </Button>

        <Button
          disabled={pending}
          onClick={() => callReset(false)}
          title="Execute purge/reset"
        >
          {pending ? <><Loader className="mr-2 h-4 w-4 animate-spin" />Running…</> : 'Run Purge'}
        </Button>

        <div className="flex items-center gap-2 text-amber-700 text-xs">
          <AlertTriangle className="h-4 w-4" />
          <span>Tip: keep “Keep meals/profile” ON unless you intend to delete DB rows.</span>
        </div>
      </div>

      {/* Results */}
      {res && (
        <div className="rounded-lg border p-3 space-y-2">
          <div className="text-sm">
            Status:{' '}
            <span className={`font-medium ${res.aborted ? 'text-amber-700' : res.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
              {res.mode === 'preview' ? 'preview' : res.aborted ? 'aborted' : res.ok ? 'deleted' : 'error'}
            </span>
          </div>

          {res.storage?.reason && (
            <div className="text-xs text-muted-foreground">Reason: {res.storage.reason}</div>
          )}

          {res.storage?.limit != null && (
            <div className="text-xs">Max deletes limit: <code>{res.storage.limit}</code></div>
          )}

          <ResultViewer storage={res.storage} />
        </div>
      )}
    </CollapsiblePanel>
  );
}

function ResultViewer({ storage }: { storage: any }) {
  if (!storage) return null;

  const mode: PurgeMode | undefined = storage.mode;
  if (storage.aborted) {
    return (
      <div className="text-sm">
        <span className="font-medium text-amber-700">Aborted</span> — candidates <code>{storage.tried}</code>{' '}
        exceeded maxDeletes <code>{storage.limit}</code>. Showing a small sample below.
        <SampleList storage={storage} />
      </div>
    );
  }

  if (mode === 'targeted') {
    const buckets = storage.buckets || {};
    const totalTried = storage.tried ?? Object.values(buckets).reduce((a: number, b: any) => a + (b?.tried || 0), 0);
    const totalRemoved = storage.removed ?? Object.values(buckets).reduce((a: number, b: any) => a + (b?.removed || 0), 0);
    return (
      <div className="text-sm space-y-2">
        <div>Files: tried <b>{totalTried}</b>, removed <b>{totalRemoved}</b></div>
        <div className="space-y-1">
          {Object.entries(buckets).map(([bucket, stats]: any) => (
            <div key={bucket} className="rounded-md border p-2">
              <div className="text-xs font-medium">{bucket}</div>
              <div className="text-xs text-muted-foreground">tried {stats?.tried ?? 0}, removed {stats?.removed ?? 0}</div>
              {Array.isArray(stats?.sample) && stats.sample.length > 0 && (
                <ul className="mt-1 text-xs list-disc pl-5">
                  {stats.sample.slice(0, 10).map((p: string, i: number) => <li key={i}><code>{p}</code></li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // prefix / orphans: { results: [{ bucket, tried, removed, sample[] }] }
  const results = Array.isArray(storage.results) ? storage.results : storage.buckets;
  if (!results) {
    return <SampleList storage={storage} />;
  }
  const list = Array.isArray(results) ? results : [];

  return (
    <div className="text-sm space-y-2">
      <div className="grid gap-2 md:grid-cols-2">
        {list.map((row: any, idx: number) => (
          <div key={idx} className="rounded-md border p-2">
            <div className="text-xs font-medium">{row.bucket || '(bucket)'}</div>
            <div className="text-xs text-muted-foreground">
              tried {row.tried ?? 0}{' '}
              {row.removed != null && <>• removed {row.removed}</>}
            </div>
            {Array.isArray(row.sample) && row.sample.length > 0 && (
              <ul className="mt-1 text-xs list-disc pl-5">
                {row.sample.slice(0, 10).map((p: string, i: number) => <li key={i}><code>{p}</code></li>)}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SampleList({ storage }: { storage: any }) {
  const sample = storage?.sample || storage?.buckets?.sample || [];
  if (!Array.isArray(sample) || sample.length === 0) return null;
  return (
    <div className="mt-2">
      <div className="text-xs font-medium">Sample</div>
      <ul className="mt-1 text-xs list-disc pl-5">
        {sample.slice(0, 10).map((p: string, i: number) => <li key={i}><code>{p}</code></li>)}
      </ul>
    </div>
  );
}
