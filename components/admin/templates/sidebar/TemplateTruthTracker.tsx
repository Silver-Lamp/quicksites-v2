// components/admin/templates/sidebar/TemplateTruthTracker.tsx
// * TemplateTruthTracker — a visual Single Source of Truth tracker for the sidebar.
//  *
//  * Draft (templates.data) → Save → Snapshot → Version tag → Publish (sites.published_snapshot_id)
//  *
//  * Info dropdown includes TL;DR, terms, relevant filenames, hide-deprecated toggle,
//  * and bulk actions. Also generates a shell script to prune deprecated files.
//  **/

"use client";

import React, { useMemo, useState, useEffect } from "react"; // NEW: add useEffect
import clsx from "clsx";
import { motion } from "framer-motion";

import {
  GitCommit,
  GitBranch,
  Save,
  Rocket,
  PlusCircle,
  HardDriveDownload,
  History,
  RefreshCw,
  Eye,
  Database,
  Box,
  Share,
  Link as LinkIcon,
  BookOpen,
  FileText,
  ListTree,
  Clipboard,
  Info as InfoIcon,
  CheckSquare2,
  SquareDashed,
  ShieldAlert,
  Trash2,
  Info,
  FileDown,
  Pencil,        // ⬅️ added
  MinusCircle,   // ⬅️ added
  RotateCcw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { diffBlocks, type BlockDiff } from "@/lib/diff/blocks"; // ⬅️ modular diff
import CollapsiblePanel from "@/components/ui/collapsible-panel";

/* ====================== NEW: de-dupe helpers ====================== */
function eventKey(e: TemplateEvent) {
    // ignore time; collapse identical actions at same rev with same diff/fields
    const rev = e.revAfter ?? e.revBefore ?? "";
    return JSON.stringify([e.type, rev, e.fieldsTouched ?? [], e.diff ?? {}, (e.meta as any)?.k ?? ""]);
  }
function dedupeEvents(list: TemplateEvent[]) {
    const seen = new Set<string>();
    const out: TemplateEvent[] = [];
    for (const e of list ?? []) {
      const k = eventKey(e);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(e);
    }
    return out;
  }
/* ====================== END: de-dupe helpers ====================== */

function getSnapshotIdFromEvent(evt: TemplateEvent): string | undefined {
  const m = (evt.meta as any) || {};
  return (
    m?.snapshot?.id ||
    m?.snapshotId ||
    m?.snapshot_id ||
    m?.id || // some backfills
    undefined
  );
}

function getVersionIdFromEvent(evt: TemplateEvent): string | undefined {
  const m = (evt.meta as any) || {};
  return m?.version?.id || m?.versionId || m?.version_id || undefined;
}

function safeTruthRefresh() {
  try {
    window.dispatchEvent(new CustomEvent("qs:truth:refresh"));
  } catch {
    /* no-op */
  }
}


  /** Types **/

export type SnapshotInfo = {
    id: string;
    rev: number;
    hash?: string;
    createdAt: string; // ISO
    note?: string;
};
  
export type VersionTagInfo = {
tag: string; // e.g., v2025.09
snapshotId: string;
notes?: string;
createdAt?: string; // ISO
};

export type TemplateEvent = {
id: string;
type: "open" | "autosave" | "save" | "snapshot" | "publish";
at: string; // ISO
revBefore?: number;
revAfter?: number;
actor?: { id?: string; name?: string; email?: string };
fieldsTouched?: string[]; // dot-paths
diff?: { added?: number; changed?: number; removed?: number };
meta?: Record<string, unknown>; // may include blockDiff OR before/after data
};

export type InfraState = {
template: { id: string; rev: number; hash?: string };
site?: { id: string; slug: string; publishedSnapshotId?: string };
lastSnapshot?: { id?: string; rev?: number; hash?: string; createdAt?: string };
cache?: { tags?: string[]; lastRevalidatedAt?: string };
};

export type TemplateTruthTrackerProps = {
templateId: string;
infra: InfraState;
snapshots: SnapshotInfo[];
versions?: VersionTagInfo[];
events: TemplateEvent[];
selectedSnapshotId?: string;
onCreateSnapshot?: () => void;
onPublish?: (snapshotId: string) => void;
onRestore?: (id: string) => void;
onRefresh?: () => void;
onViewDiff?: (eventIdOrSnapshotId: string) => void;
fileRefs?: string[];
terms?: { term: string; def: string }[];
readmeSummary?: string;
adminMeta?: { deprecated_files?: string[] };
className?: string;
};

/** Subcomponents **/
function StateHeader({
rev,
hash,
isPublishedFromDraft,
onRefresh,
info,
templateId,
infoOpen,
setInfoOpen,
}: {
rev: number;
hash?: string;
isPublishedFromDraft?: boolean;
onRefresh?: () => void;
info: {
    fileRefs: string[];
    terms: { term: string; def: string }[];
    readmeSummary: string;
};
templateId: string;
infoOpen: boolean;
setInfoOpen: (v: boolean) => void;
}) {
return (
    <div className="flex items-center justify-between gap-2">
    <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[11px]">DRAFT · rev {rev}</Badge>
        {hash && <Badge variant="secondary" className="text-[11px]">{shortHash(hash)}</Badge>}
    </div>
    <div className="flex items-center gap-1">
        <InfoDropdown {...info} templateId={templateId} open={infoOpen} setOpen={setInfoOpen} />
        {isPublishedFromDraft && (
        <Tooltip>
            <TooltipTrigger asChild>
            <Badge variant="destructive" className="text-[11px]">Warning: draft live</Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-[240px] text-xs">
            Live site should point to a snapshot. Check publish settings.
            </TooltipContent>
        </Tooltip>
        )}
        <Button size="icon" variant="ghost" onClick={onRefresh} aria-label="Refresh">
        <RefreshCw className="h-4 w-4" />
        </Button>
    </div>
    </div>
);
}


function InfoDropdown({
  fileRefs,
  terms,
  readmeSummary,
  templateId,
  open,
  setOpen,
}: {
  fileRefs: string[];
  terms: { term: string; def: string }[];
  readmeSummary: string;
  templateId: string;
  open?: boolean;
  setOpen?: (v: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deprecated, setDeprecated] = useState<string[]>([]);
  const [hideDeprecated, setHideDeprecated] = useState(true);
  const [mode, setMode] = useState<"git" | "fs">("git");

  const isOpen = typeof open === "boolean" ? open : internalOpen;
  const handleOpenChange = (v: boolean) => {
    if (typeof setOpen === "function") setOpen(v);
    setInternalOpen(v);
    if (v) void loadDeprecated();
  };

  const loadDeprecated = async () => {
    try {
      const res = await fetch(`/api/templates/deprecations?id=${templateId}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (res.ok) setDeprecated(json?.deprecated_files ?? []);
    } catch {
      /* no-op */
    }
  };

  const saveDeprecated = async (list: string[]) => {
    setSaving(true);
    try {
      await fetch(`/api/templates/deprecations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: templateId, deprecated_files: list }),
      });
    } catch {
      /* no-op */
    } finally {
      setSaving(false);
    }
  };

  const visibleFiles = useMemo(
    () => (hideDeprecated ? fileRefs.filter((f) => !deprecated.includes(f)) : fileRefs),
    [fileRefs, deprecated, hideDeprecated]
  );

  const toggle = (f: string) => {
    const next = deprecated.includes(f)
      ? deprecated.filter((x) => x !== f)
      : [...deprecated, f];
    setDeprecated(next);
    void saveDeprecated(next);
  };

  const markAllShown = () => {
    const s = new Set([...deprecated, ...visibleFiles]);
    const next = Array.from(s);
    setDeprecated(next);
    void saveDeprecated(next);
  };
  const unmarkAllShown = () => {
    const next = deprecated.filter((f) => !visibleFiles.includes(f));
    setDeprecated(next);
    void saveDeprecated(next);
  };

  const buildScript = (files: string[], m: "git" | "fs") => {
    const header = [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      `# QuickSites cleanup for template ${templateId}`,
      m === "git"
        ? 'git rev-parse --is-inside-work-tree >/\\dev\\null 2>&1 || { echo "Not a git repo"; exit 1; }'
        : "",
      "",
      "files=(",
      ...files.map((f) => `  "${f}"`),
      ")",
      "",
      'for f in "${files[@]}"; do',
      '  if [ -e "$f" ]; then',
    ];
    const action = m === "git" ? '    git rm -v "$f"' : '    rm -v "$f"';
    const footer = ["  else", '    echo "skip $f (missing)"', "  fi", "done", ""];
    return [...header, action, ...footer].join("\n");
  };

  const script = useMemo(() => buildScript(deprecated, mode), [deprecated, mode]);

  const copyFiles = async () => {
    try {
      await navigator.clipboard.writeText(fileRefs.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* no-op */
    }
  };

  const copyScript = async () => {
    try {
      await navigator.clipboard.writeText(script);
    } catch {
      /* no-op */
    }
  };

  const downloadScript = () => {
    try {
      const blob = new Blob([script], { type: "text/x-sh" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `delete_deprecated_${templateId}.sh`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      /* no-op */
    }
  };

  const total = fileRefs.length;
  const deprecatedCount = deprecated.length;
  const activeCount = total - deprecatedCount;

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Guide & terms">
          <BookOpen className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[380px] p-2">
        <DropdownMenuLabel className="flex items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-2">
            <InfoIcon className="h-3.5 w-3.5" /> Quick guide
          </span>
          <span className="text-[10px] text-muted-foreground">
            {activeCount}/{total} active • {deprecatedCount} deprecated
          </span>
        </DropdownMenuLabel>
        <div className="px-2 pb-2 text-xs text-muted-foreground whitespace-pre-wrap">
          {readmeSummary}
        </div>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-2 text-xs">
          <ListTree className="h-3.5 w-3.5" /> Terms
        </DropdownMenuLabel>
        <ul className="px-2 pb-2 space-y-1">
          {terms.map((t) => (
            <li key={t.term} className="text-xs leading-snug">
              <span className="font-medium">{t.term}:</span> {t.def}
            </li>
          ))}
        </ul>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5" /> Relevant files
          </span>
          {saving && (
            <span className="text-[10px] text-muted-foreground">saving…</span>
          )}
        </DropdownMenuLabel>

        <div className="flex items-center justify-between px-2 pb-2 text-[11px]">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={hideDeprecated}
              onChange={(e) => setHideDeprecated(e.target.checked)}
            />
            <span>Hide deprecated</span>
          </label>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 gap-1"
              onClick={markAllShown}
            >
              <CheckSquare2 className="h-3.5 w-3.5" /> Mark all shown deprecated
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 gap-1"
              onClick={unmarkAllShown}
            >
              <SquareDashed className="h-3.5 w-3.5" /> Unmark all shown
            </Button>
          </div>
        </div>

        <div className="max-h-40 overflow-auto px-2 pb-2">
          <ul className="space-y-1">
            {visibleFiles.map((f) => (
              <li
                key={f}
                className="flex items-center justify-between gap-2 text-[11px] font-mono leading-snug break-all"
              >
                <span
                  className={clsx(
                    deprecated.includes(f) && "line-through text-muted-foreground"
                  )}
                >
                  {f}
                </span>
                <label className="ml-2 inline-flex items-center gap-1 text-[11px]">
                  <input
                    type="checkbox"
                    checked={deprecated.includes(f)}
                    onChange={() => toggle(f)}
                  />
                  <span>deprecated</span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-between gap-2 px-2 pb-1">
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={copyFiles}
          >
            <Clipboard className="h-3.5 w-3.5" /> {copied ? "Copied" : "Copy file list"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setDeprecated([]);
              void saveDeprecated([]);
            }}
          >
            Clear deprecations
          </Button>
        </div>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-2 text-xs text-red-600">
          <ShieldAlert className="h-3.5 w-3.5" /> Danger zone (generate script to prune)
        </DropdownMenuLabel>
        <div className="px-2 pb-2 text-[11px] text-muted-foreground">
          These actions are intentionally non-destructive in-app. Generate a script and run it locally in the repo.
        </div>
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <label className="text-[11px]">Mode</label>
          <select
            className="ml-auto rounded border px-2 py-1 text-[11px]"
            value={mode}
            onChange={(e) => setMode(e.target.value as "git" | "fs")}
          >
            <option value="git">git rm (tracked files)</option>
            <option value="fs">rm -v (filesystem)</option>
          </select>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 gap-1"
              onClick={copyScript}
              disabled={deprecated.length === 0}
            >
              <Clipboard className="h-3.5 w-3.5" /> Copy script
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 gap-1"
              onClick={downloadScript}
              disabled={deprecated.length === 0}
            >
              <FileDown className="h-3.5 w-3.5" /> Download .sh
            </Button>
            <Button size="sm" variant="destructive" className="h-7 px-2" disabled>
              <Trash2 className="h-3.5 w-3.5" /> Delete now
            </Button>
          </div>
        </div>

        <div className="max-h-36 overflow-auto rounded border bg-muted/50 px-2 py-2 text-[11px]">
          <pre className="whitespace-pre-wrap">{script}</pre>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function InfraMap({
  draft,
  latestSnapshot,
  publishedSnapshotId,
  siteSlug,
  cacheInfo,
}: {
  draft: { rev: number; hash?: string };
  latestSnapshot?: { id?: string; rev?: number; hash?: string; createdAt?: string };
  publishedSnapshotId?: string;
  siteSlug?: string;
  cacheInfo?: { tags?: string[]; lastRevalidatedAt?: string };
}) {
  return (
    <Card className="border-neutral-200">
      <CardHeader className="py-3">
        <CardTitle className="text-sm">Single Source of Truth Map</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-3 items-stretch gap-2">
        <Node title="Draft" icon={<Save className="h-4 w-4" />}>
          <div className="text-xs text-muted-foreground">rev {draft.rev}</div>
          {draft.hash && <div className="text-[11px]">{shortHash(draft.hash)}</div>}
        </Node>

        <Arrow />

        <Node
          title="Snapshot"
          icon={<HardDriveDownload className="h-4 w-4" />}
          state={latestSnapshot?.id ? "ok" : "empty"}
        >
          {!latestSnapshot?.id && (
            <div className="text-xs text-muted-foreground">none yet</div>
          )}
          {latestSnapshot?.id && (
            <div className="text-xs">
              <div>rev {latestSnapshot.rev}</div>
              <div className="text-[11px] text-muted-foreground">
                {shortHash(latestSnapshot.hash)}
              </div>
            </div>
          )}
        </Node>

        <Arrow />

        <Node
          title="Publish"
          icon={<Rocket className="h-4 w-4" />}
          state={publishedSnapshotId ? "ok" : "warn"}
        >
          {publishedSnapshotId ? (
            <div className="text-xs">
              <div className="flex items-center gap-1">
                <LinkIcon className="h-3 w-3" /> snapshot
              </div>
              <div className="text-[11px] break-all">{publishedSnapshotId}</div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">not published</div>
          )}
        </Node>

        <Separator className="col-span-3 my-1" />

        <Node title="Renderer" icon={<Eye className="h-4 w-4" />}>
          <div className="text-xs text-muted-foreground">reads snapshot only</div>
          {siteSlug && <div className="text-[11px]">/{siteSlug}</div>}
        </Node>
        <Arrow thin />
        <Node title="Cache" icon={<Box className="h-4 w-4" />}>
          <div className="text-xs">{cacheInfo?.tags?.length ?? 0} tags</div>
          {cacheInfo?.lastRevalidatedAt && (
            <div className="text-[11px] text-muted-foreground">
              {shortTime(cacheInfo.lastRevalidatedAt)}
            </div>
          )}
        </Node>
        <Arrow thin />
        <Node title="DB" icon={<Database className="h-4 w-4" />}>
          <div className="text-xs text-muted-foreground">templates • snapshots</div>
        </Node>
      </CardContent>
    </Card>
  );
}

function Node({
  title,
  icon,
  children,
  state,
}: {
  title: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
  state?: "ok" | "warn" | "empty";
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={clsx(
        "relative rounded-2xl border p-3 shadow-sm",
        state === "ok" && "border-emerald-300/60",
        state === "warn" && "border-amber-300/60",
        state === "empty" && "border-border"
      )}
    >
      <div className="mb-1 flex items-center gap-2">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-md border bg-muted/40">
          {icon}
        </span>
        <div className="text-sm font-medium leading-none">{title}</div>
      </div>
      <div className="text-sm">{children}</div>
    </motion.div>
  );
}

function Arrow({ thin = false }: { thin?: boolean }) {
  return (
    <div className="flex items-center justify-center">
      <div className={clsx("h-0.5 w-6 bg-border", thin && "opacity-60")} />
    </div>
  );
}

/** Helpers to extract/normalize industry + services from event meta */
function extractIndustry(evt: TemplateEvent): string | undefined {
  const m = evt.meta as any;
  if (!m || typeof m !== "object") return undefined;
  // common shapes
  return (
    (typeof m.industry === "string" && m.industry) ||
    (typeof m?.data?.meta?.industry === "string" && m.data.meta.industry) ||
    undefined
  );
}

function normalizeServicesList(v: unknown): string[] | undefined {
  if (!v) return undefined;
  const asArr: any[] = Array.isArray(v) ? v : [];
  const out = asArr
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        const o = item as Record<string, any>;
        const base = String(o.name ?? o.title ?? "").trim();
        const price =
          o.price != null && String(o.price).trim() !== ""
            ? ` — ${
                typeof o.price === "number" ? `$${o.price.toFixed(2)}` : String(o.price)
              }`
            : "";
        return base ? `${base}${price}` : "";
      }
      return "";
    })
    .filter(Boolean);
  return out.length ? Array.from(new Set(out)) : undefined;
}

function extractServices(evt: TemplateEvent): string[] | undefined {
  const m = evt.meta as any;
  if (!m || typeof m !== "object") return undefined;
  // Try several places
  return (
    normalizeServicesList(m.services) ||
    normalizeServicesList(m?.data?.services) ||
    undefined
  );
}

function TimelineItem({
    evt,
    prevEvt,
    isFirst,
    onViewDiff,
    onPublish,              // ⬅️ NEW
    onRestore,              // ⬅️ NEW
    publishedSnapshotId,    // ⬅️ NEW
  }: {
    evt: TemplateEvent;
    prevEvt?: TemplateEvent;
    isFirst?: boolean;
    onViewDiff?: (id: string) => void;
    onPublish?: (snapshotId: string) => void;       // ⬅️ NEW
    onRestore?: (id: string) => void;               // ⬅️ NEW
    publishedSnapshotId?: string;                   // ⬅️ NEW
  }) {
    const { icon, tone, label } = iconForEvent(evt.type);
    const rev = evt.revAfter ?? evt.revBefore;
    const diff = evt.diff || {};
  
    // Industry/services snapshot
    const industry = extractIndustry(evt) ?? "unknown";
    const services = extractServices(evt) ?? [];
    const servicesPreview = services.slice(0, 3);
    const more = Math.max(0, services.length - servicesPreview.length);
  
    // 🔎 Block diffs:
    // Priority 1: server-provided evt.meta.blockDiff
    // Priority 2: compute from available before/after data on events (best-effort)
    const blockDiff: BlockDiff | undefined = useMemo(() => {
      const m = (evt.meta as any) || {};
      if (m.blockDiff) return m.blockDiff as BlockDiff;
  
      // Try to compute when data is present in meta
      const before =
        (m.before?.data ?? m.dataBefore) ??
        ((prevEvt?.meta as any)?.data ?? (prevEvt?.meta as any)?.snapshot?.data);
      const after =
        (m.after?.data ?? m.dataAfter ?? m.data) ??
        (m.snapshot?.data);
  
      if (before && after) {
        try { return diffBlocks(before, after); } catch { /* no-op */ }
      }
      return undefined;
    }, [evt.meta, prevEvt?.meta]);
  
  // NEW: snapshot+version ids for actions
  const snapId = useMemo(() => getSnapshotIdFromEvent(evt), [evt.meta]);
  const verId  = useMemo(() => getVersionIdFromEvent(evt), [evt.meta]);
  const isLive = !!(publishedSnapshotId && snapId && publishedSnapshotId === snapId);

  const [busy, setBusy] = React.useState(false);
  const doPublish = async () => {
    if (!snapId || !onPublish || busy) return;
    setBusy(true);
    try {
      await Promise.resolve(onPublish(snapId));
      safeTruthRefresh();
    } finally {
      setBusy(false);
    }
  };
  const doRestore = async () => {
    const id = verId || snapId;
    if (!id || !onRestore || busy) return;
    setBusy(true);
    try {
      await Promise.resolve(onRestore(id));
      safeTruthRefresh();
    } finally {
      setBusy(false);
    }
  };


    return (
      <li className="relative flex gap-3 pl-8 pr-2 py-2">
        {/* dot */}
        <span
          className={clsx(
            "absolute left-3 top-2.5 inline-flex h-2.5 w-2.5 -translate-x-1/2 rounded-full border",
            tone === "green" && "bg-emerald-500 border-emerald-600",
            tone === "blue" && "bg-blue-500 border-blue-600",
            tone === "orange" && "bg-amber-500 border-amber-600",
            tone === "gray" && "bg-muted border-border"
          )}
        />
  
        <div className="flex w-full items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-1">
                {icon}
                <span className="font-medium capitalize">{label}</span>
              </span>
              {typeof rev === "number" && (
                <Badge variant="outline" className="text-[11px]">rev {rev}</Badge>
              )}
              <span className="text-xs text-muted-foreground">{shortTime(evt.at)}</span>
            </div>
  
            {/* industry/services snapshot */}
            <div className="mt-1 text-[11px] text-muted-foreground">
              <span className="mr-2">
                <span className="font-medium">industry:</span> {industry}
              </span>
              <span>
                <span className="font-medium">services:</span>{" "}
                {servicesPreview.length > 0 ? servicesPreview.join(", ") : "none"}
                {more > 0 ? ` … +${more} more` : ""}
              </span>
            </div>
  
            {/* NEW: block change chips */}
            <BlockChangeChips diff={blockDiff} />
  
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {evt.actor?.name && <span>{evt.actor.name}</span>}
              {evt.fieldsTouched && evt.fieldsTouched.length > 0 && (
                <span className="truncate">
                  {evt.fieldsTouched.slice(0, 3).join(", ")}
                  {evt.fieldsTouched.length > 3 ? "…" : ""}
                </span>
              )}
            </div>
          </div>
  
          <div className="flex items-center gap-2">
            <DiffBadge added={diff.added} changed={diff.changed} removed={diff.removed} />
            {onViewDiff && (
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onViewDiff(evt.id)}>
                <GitBranch className="h-4 w-4" />
              </Button>
            )}

            {/* ⬇️ NEW: only show when this row corresponds to a snapshot */}
            {snapId && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 gap-1"
                  disabled={busy}
                  onClick={doRestore}
                  title="Restore draft to this point"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restore
                </Button>
                <Button
                  size="sm"
                  variant={isLive ? "secondary" : "default"}
                  className="h-7 px-2 gap-1"
                  disabled={busy}
                  onClick={doPublish}
                  title="Publish this snapshot"
                >
                  <Rocket className="h-3.5 w-3.5" />
                  {isLive ? "Published" : "Publish"}
                </Button>
              </>
            )}

          </div>
        </div>
      </li>
    );
}
  
function BlockChangeChips({ diff }: { diff?: BlockDiff }) {
if (!diff) {
    return <div className="mt-1 text-[11px] text-muted-foreground/70">No block changes</div>;
}

const top = (obj: Record<string, number>, max = 4) =>
    Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max);

const addedTop = top(diff.addedByType);
const modTop = top(diff.modifiedByType);
const remTop = top(diff.removedByType);

const none =
    addedTop.length === 0 && modTop.length === 0 && remTop.length === 0;

if (none) {
    return <div className="mt-1 text-[11px] text-muted-foreground/70">No block changes</div>;
}

return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
    {addedTop.map(([type, cnt]) => (
        <span
        key={`a-${type}`}
        className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/12 px-2 py-0.5 text-emerald-300"
        title={`Added: ${type} ×${cnt}`}
        >
        <PlusCircle className="h-3 w-3" /> {type} ×{cnt}
        </span>
    ))}
    {modTop.map(([type, cnt]) => (
        <span
        key={`m-${type}`}
        className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/12 px-2 py-0.5 text-amber-300"
        title={`Modified: ${type} ×${cnt}`}
        >
        <Pencil className="h-3 w-3" /> {type} ×{cnt}
        </span>
    ))}
    {remTop.map(([type, cnt]) => (
        <span
        key={`r-${type}`}
        className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/12 px-2 py-0.5 text-rose-300"
        title={`Removed: ${type} ×${cnt}`}
        >
        <MinusCircle className="h-3 w-3" /> {type} ×{cnt}
        </span>
    ))}
    </div>
);
}

function DiffBadge({
added = 0,
changed = 0,
removed = 0,
}: {
added?: number;
changed?: number;
removed?: number;
}) {
const hasAny = (added ?? 0) + (changed ?? 0) + (removed ?? 0) > 0;
return (
    <div
    className={clsx(
        "flex items-center gap-1 rounded-md border px-2 py-1 text-[11px]",
        !hasAny && "opacity-60"
    )}
    >
    <span className="inline-flex items-center gap-0.5">
        <span>+</span>
        {added ?? 0}
    </span>
    <span className="inline-flex items-center gap-0.5">
        <span>~</span>
        {changed ?? 0}
    </span>
    <span className="inline-flex items-center gap-0.5">
        <span>-</span>
        {removed ?? 0}
    </span>
    </div>
);
}

function DeprecatedBanner({
  count,
  onReview,
}: {
  count: number;
  onReview: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-amber-300/50 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <div>
        <span className="font-medium">
          {count} file{count === 1 ? "" : "s"} marked deprecated.
        </span>
        <span className="ml-2 text-amber-800">
          Consider pruning once the new flow is stable.
        </span>
      </div>
      <Button size="sm" variant="outline" className="h-7 px-2" onClick={onReview}>
        Review
      </Button>
    </div>
  );
}

/** Helpers **/
function shortHash(h?: string) {
  if (!h) return "";
  if (h.length <= 7) return h;
  return h.slice(0, 7);
}

function shortTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString();
}

function iconForEvent(t: TemplateEvent["type"]) {
  switch (t) {
    case "save":
      return {
        icon: <Save className="h-4 w-4" />,
        tone: "blue",
        label: "save",
      } as const;
    case "autosave":
      return {
        icon: <History className="h-4 w-4" />,
        tone: "gray",
        label: "autosave",
      } as const;
    case "snapshot":
      return {
        icon: <HardDriveDownload className="h-4 w-4" />,
        tone: "green",
        label: "snapshot",
      } as const;
    case "publish":
      return {
        icon: <Rocket className="h-4 w-4" />,
        tone: "orange",
        label: "publish",
      } as const;
    case "open":
    default:
      return {
        icon: <GitCommit className="h-4 w-4" />,
        tone: "gray",
        label: t,
      } as const;
  }
}


export default function TemplateTruthTracker({
  templateId,
  infra,
  snapshots,
  versions = [],
  events,
  selectedSnapshotId,
  onCreateSnapshot,
  onPublish,
  onRestore,
  onRefresh,
  onViewDiff,
  fileRefs,
  terms,
  readmeSummary,
  adminMeta,
  className,
}: TemplateTruthTrackerProps) {
  const [selectedSnap, setSelectedSnap] = useState<string | undefined>(
    selectedSnapshotId
  );

  /* ---------- NEW: fallback load if parent didn't pass state yet ---------- */
  const [fallbackState, setFallbackState] = useState<{
    infra?: InfraState;
    snapshots?: SnapshotInfo[];
  } | null>(null);

  useEffect(() => {
    if (infra) return; // parent provided it, nothing to do
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/templates/state?id=${templateId}`, { cache: 'no-store' });
        const json = await res.json();
        if (!alive) return;
        setFallbackState({
          infra: json?.infra,
          snapshots: Array.isArray(json?.snapshots) ? json.snapshots : undefined,
        });
      } catch {
        if (!alive) setFallbackState(null);
      }
    })();
    return () => { alive = false; };
  }, [templateId, infra]);
  /* ----------------------------------------------------------------------- */

  // Safe wrappers so we never crash when props are momentarily undefined
  const safeInfra: InfraState = useMemo(() => {
    return (
      infra ??
      fallbackState?.infra ?? {
        template: { id: templateId, rev: 0 },
        site: undefined,
        lastSnapshot: undefined,
        cache: undefined,
      }
    );
  }, [infra, fallbackState, templateId]);

  const snaps: SnapshotInfo[] = useMemo(() => {
    if (Array.isArray(snapshots) && snapshots.length) return snapshots;
    return fallbackState?.snapshots ?? [];
  }, [snapshots, fallbackState]);

  const publishedId = safeInfra.site?.publishedSnapshotId;
  const latestSnapshot = useMemo(() => snaps[0], [snaps]);

  const selectedSnapshot = useMemo(
    () =>
      snaps.find((s) => s.id === (selectedSnap || selectedSnapshotId)) ??
      latestSnapshot,
    [snaps, selectedSnap, selectedSnapshotId, latestSnapshot]
  );

  const selectedVersionTag = useMemo(
    () => versions.find((v) => v.snapshotId === selectedSnapshot?.id),
    [versions, selectedSnapshot]
  );

  const [infoOpen, setInfoOpen] = useState(false);

  /* ---------------- timeline: keep your lazy loader as-is ----------------- */
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [lazyEvents, setLazyEvents] = useState<TemplateEvent[] | null>(null);
  useEffect(() => {
    if (!timelineOpen) return;
    if ((events && events.length > 0) || lazyEvents) return;
    (async () => {
      try {
        const res = await fetch(`/api/templates/${templateId}/history`, { cache: "no-store" });
        const data: TemplateEvent[] = await res.json();
        setLazyEvents(Array.isArray(data) ? data : []);
      } catch {
        setLazyEvents([]);
      }
    })();
  }, [timelineOpen, events, lazyEvents, templateId]);
  const effectiveEvents = useMemo(
    () => dedupeEvents((lazyEvents ?? events) ?? []),
    [lazyEvents, events]
  );
  /* ----------------------------------------------------------------------- */

  const deprecatedFiles = adminMeta?.deprecated_files ?? [];
  const deprecatedCount = deprecatedFiles.length;

  const defaultTerms: { term: string; def: string }[] = [
    { term: "Draft (Template)", def: "Editable source of truth at templates.data (with rev)." },
    { term: "Save", def: "Server action that deep-merges patch, validates, bumps rev." },
    { term: "Snapshot", def: "Immutable capture of a draft at a given rev; used for preview/publish." },
    { term: "Version", def: "Human tag (vX.Y) that points to a snapshot for cataloging." },
    { term: "Publish", def: "Sites read from sites.published_snapshot_id → snapshot; never draft." },
  ];

  const defaultFiles: string[] = [
    "components/admin/templates/TemplateTruthTracker.tsx",
    "components/admin/templates/TemplateDiffModal.tsx",
    "components/admin/templates/hooks/useTruthTrackerState.ts",
    "app/api/templates/state/route.ts",
    "app/api/templates/diff/route.ts",
    "app/api/templates/commit/route.ts",
    "app/api/admin/snapshots/create/route.ts",
    "app/api/admin/sites/publish/route.ts",
    "app/api/templates/deprecations/route.ts",
    "lib/server/supabaseAdmin.ts",
    "lib/server/logTemplateEvent.ts",
    "lib/server/templateUtils.ts",
    "(SQL) template_admin_meta table",
  ];

  const defaultSummary =
    readmeSummary ||
    "Draft = templates.data; Save = deep-merge + validate + rev++; Snapshot = immutable capture; Version = tag → snapshot; Publish = site reads snapshot only.";

  const info = {
    fileRefs: fileRefs && fileRefs.length ? fileRefs : defaultFiles,
    terms: terms && terms.length ? terms : defaultTerms,
    readmeSummary: defaultSummary,
  };

  const diagnostics = useMemo(
    () => ({
      templateId,
      draft: safeInfra.template,
      site: safeInfra.site,
      publishedSnapshotId: publishedId,
      selectedSnapshot,
      versions,
      lastSnapshot: safeInfra.lastSnapshot,
      cache: safeInfra.cache,
    }),
    [templateId, safeInfra, publishedId, selectedSnapshot, versions]
  );

  const copyDiagnostics = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
    } catch {}
  };

  const hasSnapshots = snaps.length > 0;

  return (
    <TooltipProvider>
      <div className={clsx("flex h-full flex-col gap-3 p-2", className)}>
        <StateHeader
          rev={safeInfra.template.rev ?? 0}
          hash={safeInfra.template.hash}
          isPublishedFromDraft={publishedId === undefined}
          onRefresh={onRefresh}
          info={info}
          templateId={templateId}
          infoOpen={infoOpen}
          setInfoOpen={setInfoOpen}
        />

        {deprecatedCount > 0 && (
          <DeprecatedBanner count={deprecatedCount} onReview={() => setInfoOpen(true)} />
        )}

        <CollapsiblePanel
          id="timeline"
          title="Timeline"
          defaultOpen={false}
          lazyMount
          onOpenChange={setTimelineOpen}
        >
          {({ open }) =>
            !open ? null : (
              <Card className="flex h-full min-h-40 flex-col border-neutral-200">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">History</CardTitle>
                </CardHeader>
                <CardContent className="h-full p-0">
                  <ScrollArea className="h-[42vh] w-full">
                    <ul className="relative mx-3 my-2">
                      <div className="absolute left-4 top-0 h-full w-px bg-border" />
                      {effectiveEvents.length === 0 && (
                        <li className="px-3 py-2 text-xs text-muted-foreground">
                          {lazyEvents === null && (!events || events.length === 0)
                            ? "Open to load history…"
                            : "No events yet."}
                        </li>
                      )}
                      {effectiveEvents.map((evt, idx) => (
                        <TimelineItem
                          key={evt.id ?? `${evt.type}-${idx}`}
                          evt={evt}
                          prevEvt={effectiveEvents[idx + 1]}
                          isFirst={idx === 0}
                          onViewDiff={onViewDiff}
                          onPublish={onPublish}
                          onRestore={onRestore}
                          publishedSnapshotId={publishedId}
                        />
                      ))}
                    </ul>
                  </ScrollArea>
                </CardContent>
              </Card>
            )
          }
        </CollapsiblePanel>

        <CollapsiblePanel id="infra-map" title="Infra Map" defaultOpen={false} lazyMount>
          {({ open }) =>
            !open ? null : (
              <InfraMap
                draft={{ rev: safeInfra.template.rev ?? 0, hash: safeInfra.template.hash }}
                latestSnapshot={
                  safeInfra.lastSnapshot ?? {
                    id: latestSnapshot?.id,
                    rev: latestSnapshot?.rev,
                    hash: latestSnapshot?.hash,
                    createdAt: latestSnapshot?.createdAt,
                  }
                }
                publishedSnapshotId={publishedId}
                siteSlug={safeInfra.site?.slug}
                cacheInfo={safeInfra.cache}
              />
            )
          }
        </CollapsiblePanel>

        <CollapsiblePanel id="snapshot-picker" title="Snapshot Picker + Actions" defaultOpen={false} lazyMount>
          <Card className="border-neutral-200">
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Snapshots & Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <select
                  className="w-full rounded-md border bg-background px-2 py-1 text-sm"
                  value={selectedSnapshot?.id ?? ""}
                  onChange={(e) => setSelectedSnap(e.target.value)}
                  disabled={!hasSnapshots}
                >
                  {snaps.map((s) => (
                    <option key={s.id} value={s.id}>
                      {shortHash(s.hash)} · rev {s.rev} · {shortTime(s.createdAt)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="default" onClick={onCreateSnapshot} className="gap-1">
                  <PlusCircle className="h-4 w-4" /> Snapshot
                </Button>
                <Button
                  size="sm"
                  variant={selectedSnapshot?.id && selectedSnapshot?.id === publishedId ? "secondary" : "default"}
                  disabled={!selectedSnapshot?.id}
                  className="gap-1"
                  onClick={() => selectedSnapshot?.id && onPublish?.(selectedSnapshot.id)}
                >
                  <Rocket className="h-4 w-4" />
                  {selectedSnapshot?.id === publishedId ? "Published" : "Publish"}
                </Button>
                <Button size="sm" variant="outline" className="gap-1" onClick={copyDiagnostics}>
                  <Share className="h-4 w-4" /> Copy diagnostics
                </Button>
              </div>
              {selectedVersionTag && (
                <div className="text-xs text-muted-foreground">
                  Tagged <Badge variant="secondary">{selectedVersionTag.tag}</Badge>
                  {selectedVersionTag.notes ? ` · ${selectedVersionTag.notes}` : ""}
                </div>
              )}
            </CardContent>
          </Card>
        </CollapsiblePanel>
      </div>
    </TooltipProvider>
  );
}

    