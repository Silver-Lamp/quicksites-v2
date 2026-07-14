// components/admin/templates/template-editor-toolbar.tsx
'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import {
  Pencil,
  ArrowLeft,
  Save as SaveIcon,
  Rocket,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

type Props = {
  templateName: string;
  autosaveStatus?: string; // 'saved' | 'saving' | 'error' | etc.
  isRenaming: boolean;
  setIsRenaming: (v: boolean) => void;
  inputValue: string;
  setInputValue: (v: string) => void;
  slugPreview?: string;
  handleRename: () => void;
  nameExists?: boolean;
  handleSaveDraft?: () => void;
  onBack?: () => void;
  setShowNameError?: (v: boolean) => void;
  onSaveAndPublish?: () => void;
  /** Live URL of the published site, if any — renders a persistent "View live site" link. */
  liveUrl?: string | null;
  busy?: boolean;
};

function extractTemplateIdFromPath(pathname: string | null): string | null {
  if (!pathname) return null;
  const parts = pathname.split('/').filter(Boolean);
  const i = parts.indexOf('template');
  if (i >= 0 && parts[i + 1]) return parts[i + 1];
  return null;
}

export function TemplateEditorToolbar({
  templateName, // known name from the server row; used as an instant placeholder while we reconcile
  autosaveStatus = '',
  isRenaming,
  setIsRenaming,
  inputValue,
  setInputValue,
  slugPreview = '',
  handleRename,
  nameExists = false,
  handleSaveDraft,
  onBack,
  setShowNameError,
  onSaveAndPublish,
  liveUrl,
  busy = false,
}: Props) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  // Current template id
  const currentId = React.useMemo(() => extractTemplateIdFromPath(pathname ?? null), [pathname]);
  const idRef = React.useRef<string | null>(currentId);
  React.useEffect(() => { idRef.current = currentId; }, [currentId]);

  // Title state — seed from the server-provided name so we never paint a bare "Loading…".
  const [displayName, setDisplayName] = React.useState<string>(() => (templateName || '').trim());
  const [nameLoading, setNameLoading] = React.useState<boolean>(true);
  const nameLoadingRef = React.useRef<boolean>(true);
  React.useEffect(() => { nameLoadingRef.current = nameLoading; }, [nameLoading]);

  // Archive state
  const [archiving, setArchiving] = React.useState(false);

  const emitTitle = (name: string) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('qs:template:title', { detail: { name, id: idRef.current } })
    );
  };

  // Reset title on id change — re-seed from the (fresh) server name instead of blanking to "Loading…"
  React.useEffect(() => {
    setDisplayName((templateName || '').trim());
    setNameLoading(true);
    nameLoadingRef.current = true;
  }, [currentId, templateName]);

  // Resolve name (base display -> template state)
  React.useEffect(() => {
    const id = currentId;
    if (!id) return;
    let cancelled = false;

    (async () => {
      try {
        const r = await fetch(`/api/templates/base-name?template_id=${encodeURIComponent(id)}`, { cache: 'no-store' });
        if (r.ok) {
          const j = await r.json().catch(() => ({} as any));
          const apiName = (j?.display_name || '').toString().trim();
          if (!cancelled && idRef.current === id && apiName) {
            setDisplayName(apiName);
            setNameLoading(false);
            nameLoadingRef.current = false;
            emitTitle(apiName);
            return;
          }
        }
      } catch { /* ignore */ }

      try {
        const s = await fetch(`/api/templates/state?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
        if (!s.ok) { if (!cancelled && idRef.current === id) { setNameLoading(false); nameLoadingRef.current = false; } return; }
        const j2 = await s.json().catch(() => ({} as any));
        const t = (j2?.template ?? j2?.item ?? j2?.row ?? j2) as any;
        const data = (t?.data ?? {}) as any;
        const siteTitle = (data?.meta?.siteTitle || '').toString().trim();
        const derived =
          siteTitle ||
          (t?.template_name || '').toString().trim() ||
          (t?.slug || '').toString().trim() ||
          '';

        if (!cancelled && idRef.current === id) {
          if (derived) {
            setDisplayName(derived);
            emitTitle(derived);
          }
          setNameLoading(false);
          nameLoadingRef.current = false;
        }
      } catch {
        if (!cancelled && idRef.current === id) { setNameLoading(false); nameLoadingRef.current = false; }
      }
    })();

    return () => { cancelled = true; };
  }, [currentId]);

  // STRICT + DEFERRED: ignore title events while loading, and require id match
  React.useEffect(() => {
    const handler = (e: Event) => {
      try {
        const ce = e as CustomEvent<{ name?: string; id?: string }>;
        const evId = ce.detail?.id;
        if (!evId || evId !== idRef.current) return;          // wrong template → ignore
        if (nameLoadingRef.current) return;                   // still loading → ignore
        const name = (ce.detail?.name || '').trim();
        if (name) setDisplayName(name);
      } catch { /* no-op */ }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('qs:template:title', handler as EventListener);
      return () => window.removeEventListener('qs:template:title', handler as EventListener);
    }
  }, []);

  React.useEffect(() => {
    if (isRenaming && inputRef.current && document.activeElement !== inputRef.current) {
      const t = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
      return () => clearTimeout(t);
    }
  }, [isRenaming]);

  const safeSetNameError = (v: boolean) => {
    try { setShowNameError?.(v); } catch {}
  };

  const trimmed = inputValue.trim();
  const canRename = Boolean(trimmed) && trimmed !== displayName && !nameExists;

  const onSubmitRename = (e?: React.SyntheticEvent) => {
    e?.preventDefault(); e?.stopPropagation();
    if (!canRename) { safeSetNameError(!trimmed || nameExists); return; }
    setDisplayName(trimmed);
    setNameLoading(false);
    nameLoadingRef.current = false;
    emitTitle(trimmed); // includes id
    handleRename();
  };

  const renderAutosaveBadge = () => {
    if (autosaveStatus === 'saved') {
      return <span className="inline-flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> Saved</span>;
    }
    if (autosaveStatus === 'error') {
      return <span className="inline-flex items-center gap-1 text-xs text-red-400"><AlertTriangle className="h-3.5 w-3.5" /> Error</span>;
    }
    if (autosaveStatus === 'saving' || autosaveStatus === 'pending') {
      return <span className="inline-flex items-center gap-1 text-xs text-white/80"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</span>;
    }
    return null;
  };

  // Archive handler
  const handleArchive = React.useCallback(async () => {
    const id = idRef.current;
    if (!id) { toast.error('Missing template id'); return; }
    const ok = window.confirm(`Archive “${displayName || 'this template'}”? You can restore it later from the Archived tab.`);
    if (!ok) return;

    try {
      setArchiving(true);
      const res = await fetch('/api/templates/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id], archived: true }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error('Failed to archive template');
        if (j?.failures) console.warn('Archive failures:', j.failures);
        return;
      }
      toast.success('Template archived');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('qs:templates:refresh', { detail: { reason: 'toolbar-archive' } }));
      }
      router.push('/admin/templates/list');
    } catch {
      toast.error('Network error archiving template');
    } finally {
      setArchiving(false);
    }
  }, [displayName, router]);

  return (
    <>
      {/* Top bar — hidden for guests (see globals.css [data-guest]); they have the
          "building as a guest" banner + the bottom editor toolbar instead. */}
      <div className="qs-editor-actionbar mb-4 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Back + Title/Rename */}
        <div className="flex min-w-0 items-center gap-2">
          {onBack && (
            <Button type="button" size="icon" variant="ghost" onClick={onBack} title="Back" className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}

          <div className="min-w-0">
            {isRenaming ? (
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => { setInputValue(e.target.value); safeSetNameError(false); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onSubmitRename(); }
                    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setIsRenaming(false); }
                  }}
                  className="text-xl font-bold bg-background border border-muted rounded px-3 py-2 focus:outline-none focus:ring w-full max-w-md"
                />
                <Button type="button" onClick={onSubmitRename} size="sm" variant="default" disabled={!canRename}
                        title={nameExists ? 'Name already exists' : 'Apply new name'}>
                  Rename
                </Button>
                {nameExists && <span className="text-xs text-red-500">That name already exists</span>}
                <Button type="button" onClick={() => setIsRenaming(false)} size="sm" variant="ghost">Cancel</Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="truncate text-xl font-bold text-white">
                  {displayName
                    ? displayName
                    : nameLoading
                      ? <span className="text-white/60 italic">Loading…</span>
                      : 'Untitled'}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="w-7 h-7"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsRenaming(true); }}
                  title="Rename template"
                  disabled={nameLoading && !displayName}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {renderAutosaveBadge()}

          {handleSaveDraft && (
            <Button type="button" size="sm" onClick={handleSaveDraft} disabled={busy || archiving} title="Save current draft" className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <SaveIcon className="h-4 w-4" />}
              {busy ? 'Saving…' : 'Save'}
            </Button>
          )}

          {onSaveAndPublish && (
            <Button type="button" size="sm" onClick={onSaveAndPublish} disabled={busy || archiving} title="Save and publish snapshot" className="gap-2">
              <Rocket className="h-4 w-4" />
              {busy ? 'Working…' : 'Save & Publish'}
            </Button>
          )}

          {liveUrl && (
            <a
              href={liveUrl}
              target="_blank"
              rel="noreferrer"
              title={`Open the live site (${liveUrl})`}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-200"
            >
              <ExternalLink className="h-4 w-4" />
              View live site
            </a>
          )}

          {/* Divider keeps the destructive action from sitting flush against the primary CTA */}
          <div className="mx-1 h-6 w-px self-center bg-white/10" aria-hidden />

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => void handleArchive()}
            disabled={archiving || busy}
            title="Archive this template"
            className="gap-2 text-red-400 hover:bg-red-500/10 hover:text-red-300"
          >
            {archiving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {archiving ? 'Archiving…' : 'Archive'}
          </Button>
        </div>
      </div>

      {isRenaming && (
        <div className="mb-2">
          <p className="text-xs text-muted-foreground">
            Preview URL:{' '}
            <code className="bg-muted px-2 py-1 rounded">/templates/{slugPreview}</code>
          </p>
        </div>
      )}
    </>
  );
}
