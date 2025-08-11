// components/admin/templates/template-json-editor.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { ChevronRight, ChevronDown, Lock, Unlock } from 'lucide-react';
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

  // ---------- sanitize & clean ----------
  const sanitizeJsonInput = (raw: string) => {
    try {
      const parsed = JSON.parse(raw);

      // strip fields we never want the user to edit
      const toRemove = ['created_at', 'domain', 'custom_domain', 'data'];
      for (const k of toRemove) delete parsed[k];

      // only keep allowed keys according to the schema (works with ZodEffects)
      const allowedKeys = keysFromSchema(TemplateSaveSchema);
      const filtered = pickAllowedKeys(parsed, allowedKeys);

      // defaults expected by schema
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

    delete cleaned.created_at;
    delete cleaned.domain;
    delete cleaned.custom_domain;
    delete cleaned.data;

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
      const result = validateTemplateAndFix(parsed);

      if (!result.valid) {
        console.warn('[❌ Failed to validate after prettify]', result.errors);
        alert('Unable to prettify: Template has structural issues.');
        return;
      }

      const { data } = result;
      const allowedKeys = keysFromSchema(TemplateSaveSchema);
      const cleaned = pickAllowedKeys(data as any, allowedKeys);

      const finalData = cleanTemplateDataStructure(cleaned);
      setRawJson(JSON.stringify(finalData, null, 2));

      // mirror a few top-levels into the sidebar
      setSidebarValues((prev: any) => ({
        ...prev,
        template_name: (data as any)?.template_name,
        slug: (data as any)?.slug,
        layout: (data as any)?.layout,
        color_scheme: (data as any)?.color_scheme,
        theme: (data as any)?.theme,
        brand: (data as any)?.brand,
        industry: (data as any)?.industry,
        phone: (data as any)?.phone,
        commit: (data as any)?.commit,
        is_site: (data as any)?.is_site,
        published: (data as any)?.published,
        verified: (data as any)?.verified,
        saved_at: (data as any)?.saved_at,
        save_count: (data as any)?.save_count,
        last_editor: (data as any)?.last_editor,
        hero_url: (data as any)?.hero_url,
        banner_url: (data as any)?.banner_url,
        logo_url: (data as any)?.logo_url,
        team_url: (data as any)?.team_url,
      }));

      setValidationError(null);
      setZodFieldErrors(null);

      // keep a parsed snapshot for the read-only viewer
      const parsedForViewer = cleanParsedForZod(data);
      setParsedJson(parsedForViewer);

      const blockIssues = validateBlocksInTemplate(parsedForViewer);
      if (blockIssues.length) setValidationError(blockIssues.join('\n'));
    } catch (err) {
      console.error('Failed to prettify:', err);
      alert('Invalid JSON. Cannot format.');
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
