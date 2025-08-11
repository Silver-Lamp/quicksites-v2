// components/admin/templates/template-json-editor.tsx
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { ChevronRight, ChevronDown, Lock, Unlock, Copy, Check } from 'lucide-react';
import { TemplateSaveSchema, type ValidatedTemplate } from '@/admin/lib/zod/templateSaveSchema';
import type { JsonValue } from '@/types/json';
import { validateBlocksInTemplate } from '@/admin/lib/validateBlocksInTemplate';
import { cleanTemplateDataStructure } from '@/admin/lib/cleanTemplateData';
import { TemplateValidationInspector } from '@/components/admin/dev/template-validation-inspector';
import { SqlFieldPreview } from '@/components/admin/dev/sql-field-preview';
import { validateTemplateAndFix } from '@/admin/lib/validateTemplate';
import Collapsible from '@/components/ui/collapsible-panel';
import { keysFromSchema, pickAllowedKeys } from '@/lib/zod/utils';

type TemplateJsonEditorProps = {
  rawJson: string;
  setRawJson: (value: string) => void;
  sidebarValues: any;
  setSidebarValues: (values: any) => void;
  colorMode: 'light' | 'dark';
};

// ---------- helpers for header/footer hoist + page sync ----------
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

  // Sync pages to both locations
  tpl.pages = cleanedPages;
  tpl.data = { ...(tpl.data ?? {}), pages: cleanedPages };

  // Persist the single source of truth at root
  tpl.headerBlock = headerBlock ?? null;
  tpl.footerBlock = footerBlock ?? null;

  // color_mode precedence: top-level beats nested; don't invent defaults here
  const topMode = tpl?.color_mode;
  const nestedMode = tpl?.data?.color_mode;
  if (topMode === 'light' || topMode === 'dark') {
    // keep as-is
  } else if (nestedMode === 'light' || nestedMode === 'dark') {
    tpl.color_mode = nestedMode;
  }

  return tpl;
}

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

  // ---------- sanitize & clean ----------
  const sanitizeJsonInput = (raw: string) => {
    try {
      const parsed = JSON.parse(raw);

      // strip fields we never want the user to edit
      const toRemove = ['created_at', 'domain', 'custom_domain'];
      for (const k of toRemove) delete (parsed as any)[k];

      // keep `data` (don’t delete), we normalize it below during prettify
      const allowedKeys = keysFromSchema(TemplateSaveSchema);
      const filtered = pickAllowedKeys(parsed, allowedKeys);

      // defaults expected by schema (gentle)
      filtered.slug ??= 'new-template-' + Math.random().toString(36).slice(2, 6);
      filtered.template_name ??= filtered.slug;
      filtered.layout ??= 'standard';
      filtered.color_scheme ??= 'neutral';
      filtered.theme ??= 'default';

      // do not hoist/strip here (only prettify does structural changes)
      return JSON.stringify(cleanTemplateDataStructure(filtered), null, 2);
    } catch {
      return raw;
    }
  };

  const cleanParsedForZod = (data: any): ValidatedTemplate => {
    const allowedKeys = keysFromSchema(TemplateSaveSchema);
    const cleaned = pickAllowedKeys(data, allowedKeys);

    // Never expose these in the viewer payload
    delete (cleaned as any).created_at;
    delete (cleaned as any).domain;
    delete (cleaned as any).custom_domain;

    return cleaned as ValidatedTemplate;
  };

  // ---------- UI helpers ----------
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

  // ---------- prettify & validate ----------
  const handlePrettify = () => {
    try {
      const parsed = JSON.parse(rawJson);

      // 1) Validate & apply your existing structural fixes
      const result = validateTemplateAndFix(parsed);
      if (!result.valid) {
        console.warn('[❌ Failed to validate after prettify]', result.errors);
        alert('Unable to prettify: Template has structural issues.');
        return;
      }

      // 2) Hoist header/footer to template root; strip from pages; sync pages both places
      const normalizedHF = hoistHeaderFooterIntoRoot(result.data);

      // 3) Keep only allowed keys per save schema
      const allowedKeys = keysFromSchema(TemplateSaveSchema);
      const cleaned = pickAllowedKeys(normalizedHF as any, allowedKeys);

      // 4) Make sure the internal structure (data/pages) is consistently shaped
      const finalData = cleanTemplateDataStructure(cleaned);

      // 5) Emit prettified JSON back to editor
      setRawJson(JSON.stringify(finalData, null, 2));

      // Mirror top-levels into sidebar (unchanged)
      setSidebarValues((prev: any) => ({
        ...prev,
        template_name: (finalData as any)?.template_name,
        slug: (finalData as any)?.slug,
        layout: (finalData as any)?.layout,
        color_scheme: (finalData as any)?.color_scheme,
        theme: (finalData as any)?.theme,
        brand: (finalData as any)?.brand,
        industry: (finalData as any)?.industry,
        phone: (finalData as any)?.phone,
        commit: (finalData as any)?.commit,
        is_site: (finalData as any)?.is_site,
        published: (finalData as any)?.published,
        verified: (finalData as any)?.verified,
        saved_at: (finalData as any)?.saved_at,
        save_count: (finalData as any)?.save_count,
        last_editor: (finalData as any)?.last_editor,
        hero_url: (finalData as any)?.hero_url,
        banner_url: (finalData as any)?.banner_url,
        logo_url: (finalData as any)?.logo_url,
        team_url: (finalData as any)?.team_url,
      }));

      // 6) Clear validation banners; re-run block validation on the normalized version
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

  // ---------- copy to clipboard ----------
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
          <div className="flex justify-start items-start gap-2">
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
