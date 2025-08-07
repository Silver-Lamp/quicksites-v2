'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui';
import { ChevronRight, ChevronDown, Lock, Unlock } from 'lucide-react';
import { TemplateSaveSchema, ValidatedTemplate } from '@/admin/lib/zod/templateSaveSchema';
import type { JsonValue } from '@/types/json';
import { validateBlocksInTemplate } from '@/admin/lib/validateBlocksInTemplate';
import { cleanTemplateDataStructure } from '@/admin/lib/cleanTemplateData';
import { TemplateValidationInspector } from '@/components/admin/dev/template-validation-inspector';
import { extractSqlFieldsFromJson } from '@/lib/utils/extractSqlFieldsFromJson';
import { SqlFieldPreview } from '@/components/admin/dev/sql-field-preview';
import { validateTemplateAndFix } from '@/admin/lib/validateTemplate';
import { Template } from '@/types/template';
import Collapsible from '@/components/ui/collapsible-panel';

type TemplateJsonEditorProps = {
  rawJson: string;
  setRawJson: (value: string) => void;
  sidebarValues: any;
  setSidebarValues: (values: any) => void;
  colorMode: 'light' | 'dark';
  template: Template;
};

export default function TemplateJsonEditor({
  rawJson,
  setRawJson,
  sidebarValues,
  setSidebarValues,
  colorMode = 'dark',
  template,
}: TemplateJsonEditorProps) {
  const [isReadOnly, setIsReadOnly] = useState(true);
  const [parsedJson, setParsedJson] = useState<ValidatedTemplate | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [zodFieldErrors, setZodFieldErrors] = useState<Record<string, string[]> | null>(null);
  const [collapsed, setCollapsed] = useState(new Set<string>());
  const [extractedSqlFields, setExtractedSqlFields] = useState<Record<string, any>>({});

  const sanitizeJsonInput = (raw: string) => {
    try {
      const parsed = JSON.parse(raw);
      const keysToRemove = ['created_at', 'domain', 'custom_domain', 'data'];
      for (const key of keysToRemove) delete parsed[key];

      const allowedKeys = Object.keys(TemplateSaveSchema.shape);
      const filtered: Record<string, any> = {};
      for (const key of allowedKeys) {
        if (Object.prototype.hasOwnProperty.call(parsed, key)) {
          filtered[key] = parsed[key];
        }
      }

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
    const allowedKeys = Object.keys(TemplateSaveSchema.shape);
    const cleaned: Record<string, any> = {};
    for (const key of allowedKeys) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        cleaned[key] = data[key];
      }
    }

    delete cleaned.created_at;
    delete cleaned.domain;
    delete cleaned.custom_domain;
    delete cleaned.data;

    return cleaned as ValidatedTemplate;
  };

  useEffect(() => {
    // Cleanup rawJson on mount if not already sanitized
    const cleaned = sanitizeJsonInput(rawJson);
    if (cleaned !== rawJson) {
      setRawJson(cleaned);
    }
  }, []);
  
  useEffect(() => {
    try {
      const parsed = JSON.parse(rawJson);
      const result = validateTemplateAndFix(parsed);

      if (!result.valid) {
        setParsedJson(null);
        setZodFieldErrors(result.errors?.fieldErrors || {});
        const formErrors = result.errors?.formErrors || [];
        setValidationError(
          formErrors.length > 0
            ? formErrors.join(', ')
            : 'Some field(s) inside blocks or pages are incorrectly formatted.'
        );
        return;
      }

      const { data } = result;
      const cleaned = cleanParsedForZod(data);
      setParsedJson(cleaned);

      const blockErrors = validateBlocksInTemplate(cleaned);
      setValidationError(blockErrors.length > 0 ? blockErrors.join('\n') : null);
      setZodFieldErrors(null);
    } catch {
      setParsedJson(null);
      setValidationError('Invalid JSON syntax');
    }
  }, [rawJson]);

  const toggleCollapse = (path: string) => {
    const newSet = new Set(collapsed);
    newSet.has(path) ? newSet.delete(path) : newSet.add(path);
    setCollapsed(newSet);
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
                <div key={i}>{renderValue(v, `${path}[${i}]`)}</div>
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
              {Object.entries(value).map(([k, v]) => (
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
    if (type === 'boolean') return <span className="text-orange-400">{value.toString()}</span>;
    return <span className="text-white">{value as string}</span>;
  };

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

      const allowedKeys = Object.keys(TemplateSaveSchema.shape);
      const cleaned: Record<string, any> = {};
      for (const key of allowedKeys) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          cleaned[key] = (data as any)[key];
        }
      }

      const finalData = cleanTemplateDataStructure(cleaned);
      setRawJson(JSON.stringify(finalData, null, 2));

      setSidebarValues((prev: any) => ({
        ...prev,
        template_name: data?.template_name,
        slug: data?.slug,
        layout: data?.layout,
        color_scheme: data?.color_scheme,
        theme: data?.theme,
        brand: data?.brand,
        industry: data?.industry,
        phone: data?.phone,
        commit: data?.commit,
        is_site: data?.is_site,
        published: data?.published,
        verified: data?.verified,
        saved_at: data?.saved_at,
        save_count: data?.save_count,
        last_editor: data?.last_editor,
        hero_url: data?.hero_url,
        banner_url: data?.banner_url,
        logo_url: data?.logo_url,
        team_url: data?.team_url,
      }));

      setValidationError(null);
      setZodFieldErrors(null);
    } catch (err) {
      console.error('Failed to prettify:', err);
      alert('Invalid JSON. Cannot format.');
    }
  };

  return (
    <Collapsible title="JSON Editor (Layout Only)" id="template-json-editor" defaultOpen={true}>
      <div className="space-y-2">
        <div className="space-y-2">
          <div className="flex justify-start items-start gap-2">
            <h3 className="text-white text-sm font-semibold">JSON Editor (Layout Only)</h3>
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
              parsedJson ? renderValue(parsedJson) : <pre>{rawJson}</pre>
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
