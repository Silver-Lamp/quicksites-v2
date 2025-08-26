// components/admin/templates/template-json-editor.tsx
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { ChevronRight, ChevronDown, Lock, Unlock, Copy, Check, Save } from 'lucide-react';
import { TemplateSaveSchema, type ValidatedTemplate } from '@/admin/lib/zod/templateSaveSchema';
import type { JsonValue } from '@/types/json';
import { validateBlocksInTemplate } from '@/admin/lib/validateBlocksInTemplate';
import { cleanTemplateDataStructure } from '@/admin/lib/cleanTemplateData';
import { TemplateValidationInspector } from '@/components/admin/dev/template-validation-inspector';
import { SqlFieldPreview } from '@/components/admin/dev/sql-field-preview';
import { validateTemplateAndFix } from '@/admin/lib/validateTemplate';
import Collapsible from '@/components/ui/collapsible-panel';
import { keysFromSchema, pickAllowedKeys } from '@/lib/zod/utils';

/** Props are the same as before */
type TemplateJsonEditorProps = {
  rawJson: string;
  setRawJson: (value: string) => void;
  sidebarValues: any;                   // current working template-like object (should include id)
  setSidebarValues: (values: any) => void;
  colorMode: 'light' | 'dark';
};

/* ------------------------ header/footer + pages helpers ------------------------ */
const isHeader = (b: any) => b?.type === 'header';
const isFooter = (b: any) => b?.type === 'footer';

function getPages(tpl: any): any[] {
  const dataPages = tpl?.data?.pages;
  const rootPages = tpl?.pages;
  if (Array.isArray(dataPages)) return dataPages;
  if (Array.isArray(rootPages)) return rootPages;
  return [];
}
function stripHeaderFooterFromPage(page: any) {
  const blocks = Array.isArray(page?.content_blocks) ? page.content_blocks : [];
  return {
    ...page,
    content_blocks: blocks.filter((b: any) => !isHeader(b) && !isFooter(b)),
  };
}

/**
 * Normalize incoming data:
 *  - hoist header/footer to root
 *  - strip header/footer from page content
 *  - sync pages at root and under data.pages
 *  - carry color_mode (top-level > nested)
 */
function hoistHeaderFooterIntoRoot(input: any) {
  const tpl = { ...(input || {}) };
  const pagesIn = getPages(tpl);
  let headerBlock = tpl.headerBlock ?? tpl?.data?.headerBlock ?? null;
  let footerBlock = tpl.footerBlock ?? tpl?.data?.footerBlock ?? null;

  if ((!headerBlock || !footerBlock) && pagesIn.length > 0) {
    const firstBlocks = Array.isArray(pagesIn[0]?.content_blocks) ? pagesIn[0].content_blocks : [];
    if (!headerBlock) headerBlock = firstBlocks.find(isHeader) ?? null;
    if (!footerBlock) footerBlock = firstBlocks.find(isFooter) ?? null;
  }

  const cleanedPages = pagesIn.map(stripHeaderFooterFromPage);

  // Sync pages to both locations (UI depends on both)
  tpl.pages = cleanedPages;
  tpl.data = { ...(tpl.data ?? {}), pages: cleanedPages };

  // Persist single source at root
  tpl.headerBlock = headerBlock ?? null;
  tpl.footerBlock = footerBlock ?? null;

  // color_mode precedence: top-level beats nested
  const topMode = tpl?.color_mode;
  const nestedMode = tpl?.data?.color_mode;
  if (topMode === 'light' || topMode === 'dark') {
    // keep as-is
  } else if (nestedMode === 'light' || nestedMode === 'dark') {
    tpl.color_mode = nestedMode;
  }

  return tpl;
}

/* ------------------------------ component ------------------------------ */
export default function TemplateJsonEditor({
  rawJson,
  setRawJson,
  sidebarValues,
  setSidebarValues,
  colorMode = 'dark',
}: TemplateJsonEditorProps) {
  const [isReadOnly, setIsReadOnly] = useState(true);
  const [parsedJson, setParsedJson] = useState<ValidatedTemplate | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [zodFieldErrors, setZodFieldErrors] = useState<Record<string, string[]> | null>(null);
  const [collapsed, setCollapsed] = useState(new Set<string>());
  const [extractedSqlFields, setExtractedSqlFields] = useState<Record<string, any>>({});
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  /* ---------- sanitize keystrokes ---------- */
  const sanitizeJsonInput = (raw: string) => {
    try {
      const parsed = JSON.parse(raw);

      // strip fields we never want the user to edit
      const toRemove = ['created_at', 'domain', 'custom_domain'];
      for (const k of toRemove) delete (parsed as any)[k];

      // keep `data`; normalize later
      const allowedKeys = keysFromSchema(TemplateSaveSchema);
      const filtered = pickAllowedKeys(parsed, allowedKeys);

      // gentle defaults expected by schema
      filtered.slug ??= 'new-template-' + Math.random().toString(36).slice(2, 6);
      filtered.template_name ??= filtered.slug;
      filtered.layout ??= 'standard';
      filtered.color_scheme ??= 'neutral';
      filtered.theme ??= 'default';

      return JSON.stringify(cleanTemplateDataStructure(filtered), null, 2);
    } catch {
      return raw;
    }
  };

  const cleanParsedForZod = (data: any): ValidatedTemplate => {
    const allowedKeys = keysFromSchema(TemplateSaveSchema);
    const cleaned = pickAllowedKeys(data, allowedKeys);
    delete (cleaned as any).created_at;
    delete (cleaned as any).domain;
    delete (cleaned as any).custom_domain;
    return cleaned as ValidatedTemplate;
  };

  /* ---------- expand/collapse viewer ---------- */
  const toggleCollapse = (path: string) => {
    const s = new Set(collapsed);
    s.has(path) ? s.delete(path) : s.add(path);
    setCollapsed(s);
  };

  const renderValue = (value: JsonValue, path = '') => {
    const type = typeof value;
    if (value === null) return <span className="text-pink-400">null</span>;

    if (Array.isArray(value)) {
      const isCollapsed = collapsed.has(path);
      return (
        <div>
          <span className="cursor-pointer select-none" onClick={() => toggleCollapse(path)}>
            {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
            <span className="text-yellow-400"> [Array]</span>
          </span>
          {!isCollapsed && (
            <div className="ml-4">
              {value.map((v, i) => (
                <div key={i}>{renderValue(v as JsonValue, `${path}[${i}]`)}</div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (type === 'object') {
      const isCollapsed = collapsed.has(path);
      return (
        <div>
          <span className="cursor-pointer select-none" onClick={() => toggleCollapse(path)}>
            {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
            <span className="text-blue-400"> {'{Object}'} </span>
          </span>
          {!isCollapsed && (
            <div className="ml-4">
              {Object.entries(value as Record<string, JsonValue>).map(([k, v]) => (
                <div key={k}>
                  <span className="text-green-400">&quot;{k}&quot;</span>: {renderValue(v, `${path}.${k}`)}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (type === 'string') return <span className="text-emerald-400">"{value as string}"</span>;
    if (type === 'number') return <span className="text-cyan-400">{value as number}</span>;
    if (type === 'boolean') return <span className="text-orange-400">{String(value)}</span>;
    return <span className="text-white">{String(value)}</span>;
  };

  /* ---------- prettify & validate (no side-effects) ---------- */
  const handlePrettify = () => {
    try {
      const parsed = JSON.parse(rawJson);

      // 1) validate + structural fix
      const result = validateTemplateAndFix(parsed);
      if (!result.valid) {
        console.warn('[❌ Failed to validate after prettify]', result.errors);
        alert('Unable to prettify: Template has structural issues.');
        return;
      }

      // 2) hoist header/footer; strip from pages; sync pages both places
      const normalizedHF = hoistHeaderFooterIntoRoot(result.data);

      // 3) allow only save schema keys
      const allowedKeys = keysFromSchema(TemplateSaveSchema);
      const cleaned = pickAllowedKeys(normalizedHF as any, allowedKeys);

      // 4) canonical internal structure
      const finalData = cleanTemplateDataStructure(cleaned);

      // 5) write it back to text editor
      setRawJson(JSON.stringify(finalData, null, 2));

      // keep viewer/inspector in sync
      setValidationError(null);
      setZodFieldErrors(null);
      const parsedForViewer = cleanParsedForZod(finalData);
      setParsedJson(parsedForViewer);

      const blockIssues = validateBlocksInTemplate(parsedForViewer);
      if (blockIssues.length) setValidationError(blockIssues.join('\n'));
    } catch (err) {
      console.error('Failed to prettify:', err);
      alert('Invalid JSON. Cannot format.');
    }
  };

  /* ---------- apply to template (state only) ---------- */
  const applyToTemplate = async () => {
    try {
      const parsed = JSON.parse(rawJson);

      // validate & normalize as in prettify
      const result = validateTemplateAndFix(parsed);
      if (!result.valid) {
        alert('Template has structural issues — fix before applying.');
        return;
      }
      const normalizedHF = hoistHeaderFooterIntoRoot(result.data);
      const allowedKeys = keysFromSchema(TemplateSaveSchema);
      const cleaned = pickAllowedKeys(normalizedHF as any, allowedKeys);
      const finalData = cleanTemplateDataStructure(cleaned);

      // Update JSON text (pretty) and viewer
      setRawJson(JSON.stringify(finalData, null, 2));
      setParsedJson(cleanParsedForZod(finalData));
      setValidationError(null);
      setZodFieldErrors(null);

      // Emit a merge so the parent editor updates working template immediately
      window.dispatchEvent(new CustomEvent('qs:template:merge', { detail: finalData }));

      // Mirror top-levels into sidebar
      setSidebarValues((prev: any) => ({ ...prev, ...finalData }));

    } catch (e) {
      console.error('[applyToTemplate] failed', e);
      alert('Could not apply JSON to template');
    }
  };

  /* ---------- apply and persist to server ---------- */
  const applyAndSave = async () => {
    try {
      setSaving(true);
      await applyToTemplate(); // updates working state first

      // best-effort: read the now-applied working template from sidebarValues (id is required)
      const id = (sidebarValues as any)?.id;
      if (!id) {
        alert('Missing template id; cannot save.');
        setSaving(false);
        return;
      }

      // Persist to /api/templates/:id/edit (server normalizes again & stores color_mode, header/footer, pages)
      const res = await fetch(`/api/templates/${encodeURIComponent(id)}/edit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: rawJson, // already normalized and prettified above
      });

      let json: any = undefined;
      try { json = await res.json(); } catch {}

      if (!res.ok) {
        console.error('[applyAndSave] server error:', json?.error || res.status);
        alert(json?.error || 'Save failed');
      }
    } catch (e) {
      console.error('[applyAndSave] failed', e);
      alert('Save failed');
    } finally {
      setSaving(false);
    }
  };

  /* ---------- copy to clipboard ---------- */
  const handleCopy = async () => {
    try {
      const textToCopy = rawJson;
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        // fallback
        const ta = document.createElement('textarea');
        ta.value = textToCopy;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error('Copy failed:', e);
      alert('Could not copy to clipboard');
    }
  };

  return (
    <Collapsible title="JSON Editor" id="template-json-editor" defaultOpen>
      <div className="space-y-2">
        <div className="space-y-2">
          <div className="flex justify-start items-start gap-2 flex-wrap">
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={handlePrettify}>
                Prettify & Fix
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setIsReadOnly(!isReadOnly)}>
                {isReadOnly ? <Lock size={16} /> : <Unlock size={16} />}
                {isReadOnly ? 'Unlock' : 'Read-Only'}
              </Button>
              <Button variant="secondary" size="sm" onClick={handleCopy} title="Copy JSON to clipboard">
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>

            {/* New: Apply and Apply & Save */}
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={applyToTemplate}
                title="Apply JSON to the current template (editor only)"
              >
                Apply
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={applyAndSave}
                disabled={saving}
                title="Apply JSON and persist to server"
              >
                <Save size={16} className="mr-1" />
                {saving ? 'Saving…' : 'Apply & Save'}
              </Button>
            </div>

            <TemplateValidationInspector fullTemplateJson={parsedJson} />
          </div>

          {(validationError || zodFieldErrors) && (
            <div className="bg-red-950 text-red-300 border border-red-700 p-3 rounded text-sm space-y-2 max-w-3xl">
              <div className="font-semibold text-red-200">Validation Errors:</div>
              {validationError && <div className="whitespace-pre-line">• {validationError}</div>}
              {zodFieldErrors &&
                Object.entries(zodFieldErrors).map(([field, messages]) =>
                  messages.map((msg, i) => (
                    <div key={`${field}-${i}`}>• {field}: {msg}</div>
                  ))
                )}
            </div>
          )}

          <div className="overflow-auto rounded border border-gray-700 bg-gray-900 font-mono text-sm text-white max-h-[500px] p-4">
            {isReadOnly ? (
              parsedJson ? renderValue(parsedJson as any) : <pre>{rawJson}</pre>
            ) : (
              <textarea
                value={rawJson}
                onChange={(e) => setRawJson(sanitizeJsonInput(e.target.value))}
                className="w-full h-[600px] resize-none bg-gray-900 text-white font-mono text-sm p-2 border border-gray-700 rounded"
              />
            )}
          </div>

          {Object.keys(extractedSqlFields).length > 0 && (
            <SqlFieldPreview fields={extractedSqlFields} />
          )}
        </div>
      </div>
    </Collapsible>
  );
}
