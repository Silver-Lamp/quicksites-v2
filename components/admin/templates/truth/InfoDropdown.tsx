// components/admin/templates/truth/InfoDropdown.tsx
'use client';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { BookOpen, Clipboard, FileDown, Info as InfoIcon, ListTree, ShieldAlert } from 'lucide-react';
import clsx from 'clsx';

export function InfoDropdown({
  fileRefs, terms, readmeSummary, templateId,
}: { fileRefs: string[]; terms: { term: string; def: string }[]; readmeSummary: string; templateId: string; }) {
  const [copied, setCopied] = useState(false);
  const [deprecated, setDeprecated] = useState<string[]>([]);
  const [hideDeprecated, setHideDeprecated] = useState(true);
  const [mode, setMode] = useState<'git' | 'fs'>('git');

  const visibleFiles = useMemo(
    () => (hideDeprecated ? fileRefs.filter((f) => !deprecated.includes(f)) : fileRefs),
    [fileRefs, deprecated, hideDeprecated]
  );

  const buildScript = (files: string[], m: 'git' | 'fs') => {
    const hdr = [
      '#!/usr/bin/env bash','set -euo pipefail',
      `# QuickSites cleanup for template ${templateId}`,'',
      'files=(',
      ...files.map((f) => `  "${f}"`),
      ')','','for f in "${files[@]}"; do','  if [ -e "$f" ]; then',
    ];
    const action = m === 'git' ? '    git rm -v "$f"' : '    rm -v "$f"';
    const ftr = ['  else','    echo "skip $f (missing)"','  fi','done',''];
    return [...hdr, action, ...ftr].join('\n');
  };
  const script = useMemo(() => buildScript(deprecated, mode), [deprecated, mode]);

  const copyFiles = async () => { try { await navigator.clipboard.writeText(fileRefs.join('\n')); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch {} };
  const copyScript = async () => { try { await navigator.clipboard.writeText(script); } catch {} };
  const downloadScript = () => {
    try { const blob = new Blob([script], { type: 'text/x-sh' }); const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `delete_deprecated_${templateId}.sh`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch {}
  };

  const total = fileRefs.length, deprecatedCount = deprecated.length, activeCount = total - deprecatedCount;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Guide & terms"><BookOpen className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[380px] p-2">
        <DropdownMenuLabel className="flex items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-2"><InfoIcon className="h-3.5 w-3.5" /> Quick guide</span>
          <span className="text-[10px] text-muted-foreground">{activeCount}/{total} active • {deprecatedCount} deprecated</span>
        </DropdownMenuLabel>
        <div className="px-2 pb-2 text-xs text-muted-foreground whitespace-pre-wrap">{readmeSummary}</div>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-2 text-xs"><ListTree className="h-3.5 w-3.5" /> Terms</DropdownMenuLabel>
        <ul className="px-2 pb-2 space-y-1">
          {terms.map(t => <li key={t.term} className="text-xs leading-snug"><span className="font-medium">{t.term}:</span> {t.def}</li>)}
        </ul>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-2 text-xs text-red-600"><ShieldAlert className="h-3.5 w-3.5" /> Danger zone</DropdownMenuLabel>

        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <label className="text-[11px]">Mode</label>
          <select className="ml-auto rounded border px-2 py-1 text-[11px]" value={mode} onChange={(e) => setMode(e.target.value as 'git' | 'fs')}>
            <option value="git">git rm (tracked files)</option><option value="fs">rm -v (filesystem)</option>
          </select>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-7 px-2 gap-1" onClick={copyScript} disabled={deprecated.length === 0}><Clipboard className="h-3.5 w-3.5" /> Copy script</Button>
            <Button size="sm" variant="outline" className="h-7 px-2 gap-1" onClick={downloadScript} disabled={deprecated.length === 0}><FileDown className="h-3.5 w-3.5" /> Download .sh</Button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-2 pb-1">
          <label className="inline-flex items-center gap-2 text-[11px]">
            <input type="checkbox" checked={hideDeprecated} onChange={(e) => setHideDeprecated(e.target.checked)} />
            <span>Hide deprecated</span>
          </label>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-7 px-2 gap-1" onClick={() => setDeprecated(Array.from(new Set([...deprecated, ...visibleFiles])))}><Clipboard className="h-3.5 w-3.5" /> Mark shown</Button>
            <Button size="sm" variant="outline" className="h-7 px-2 gap-1" onClick={() => setDeprecated(deprecated.filter(f => !visibleFiles.includes(f)))}>Unmark shown</Button>
          </div>
        </div>

        <div className="max-h-40 overflow-auto px-2 pb-2">
          <ul className="space-y-1">
            {visibleFiles.map(f => (
              <li key={f} className="flex items-center justify-between gap-2 text-[11px] font-mono leading-snug break-all">
                <span className={clsx(deprecated.includes(f) && 'line-through text-muted-foreground')}>{f}</span>
                <label className="ml-2 inline-flex items-center gap-1 text-[11px]">
                  <input type="checkbox" checked={deprecated.includes(f)} onChange={() => setDeprecated(deprecated.includes(f) ? deprecated.filter(x => x !== f) : [...deprecated, f])} />
                  <span>deprecated</span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div className="max-h-36 overflow-auto rounded border bg-muted/50 px-2 py-2 text-[11px]">
          <pre className="whitespace-pre-wrap">{script}</pre>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
