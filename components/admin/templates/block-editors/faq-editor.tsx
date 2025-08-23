// components/admin/templates/block-editors/faq-editor.tsx
'use client';

import * as React from 'react';
import { useState, useMemo } from 'react';
import type { BlockEditorProps } from './index';
import type { Block } from '@/types/blocks';
import BlockField from './block-field';
import { extractFieldErrors } from '../utils/extractFieldErrors';
import type { Template } from '@/types/template';
import { Sparkles } from 'lucide-react';

type FaqItem = { question: string; answer: string };

function normServices(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return Array.from(new Set(v.map((s) => String(s ?? '').trim()).filter(Boolean)));
}

export default function FaqEditor({
  block,
  onSave,
  onClose,
  errors = {},
  template,
}: BlockEditorProps & { template: Template }) {
  const faqBlock = block as unknown as Block;
  const [title, setTitle] = useState<string>(
    (faqBlock.content as any)?.title || 'Frequently Asked Questions'
  );
  const [items, setItems] = useState<FaqItem[]>(
    Array.isArray((faqBlock.content as any)?.items)
      ? ((faqBlock.content as any).items as FaqItem[])
      : []
  );
  const fieldErrors = extractFieldErrors(errors as unknown as string[]);

  // ---------- Template context (for AI prompts) ----------
  const templateId = (template?.id as string) || undefined;
  const siteSlug = (template as any)?.slug as string | undefined;
  const industry = ((template as any)?.industry as string) || 'services';
  const services = normServices((template as any)?.services);

  // ---------- Local helpers ----------
  const updateItem = (i: number, key: keyof FaqItem, value: string) => {
    const updated = [...items];
    updated[i] = { ...updated[i], [key]: value };
    setItems(updated);
  };

  const addRow = () =>
    setItems((prev) => [...prev, { question: 'New Question', answer: 'New Answer' }]);

  const removeLast = () => setItems((prev) => prev.slice(0, -1));

  // ---------- AI state ----------
  const [aiPrompt, setAiPrompt] = useState('');
  const [tone, setTone] = useState<'friendly' | 'professional' | 'enthusiastic' | 'matter-of-fact'>(
    'friendly'
  );
  const [count, setCount] = useState(4);
  const [loading, setLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const contextSummary = useMemo(() => {
    const svc = services.length ? `Services: ${services.join(', ')}` : 'Services: (none)';
    return [`Industry: ${industry}`, svc, siteSlug ? `Site: ${siteSlug}` : null]
      .filter(Boolean)
      .join('  •  ');
  }, [industry, services, siteSlug]);

  async function callAI(n: number) {
    const res = await fetch('/api/faq/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Let the server fetch canonical industry/services from DB via template_id,
        // but also send local fallbacks in case that query fails.
        prompt: aiPrompt,
        tone,
        count: Math.max(1, Math.min(10, n)),
        template_id: templateId,
        site_slug: siteSlug,
        industry,
        services,
      }),
    });
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return (await res.json()) as { faqs: FaqItem[] };
  }

  const handleGenerate = async () => {
    setLoading(true);
    setAiError(null);
    try {
      const data = await callAI(count);
      const newOnes = (data.faqs || []).filter(
        (f) => f?.question?.trim() && f?.answer?.trim()
      );
      if (!newOnes.length) throw new Error('No FAQs returned');
      setItems((prev) => [...prev, ...newOnes]);
      setAiPrompt('');
    } catch (e: any) {
      setAiError(e?.message || 'Failed to generate FAQs');
    } finally {
      setLoading(false);
    }
  };

  const handleReplaceAll = async () => {
    setLoading(true);
    setAiError(null);
    try {
      const data = await callAI(Math.max(count, 5));
      const fresh = (data.faqs || []).filter(
        (f) => f?.question?.trim() && f?.answer?.trim()
      );
      if (!fresh.length) throw new Error('No FAQs returned');
      setItems(fresh);
      setAiPrompt('');
    } catch (e: any) {
      setAiError(e?.message || 'Failed to replace with AI FAQs');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="p-4 space-y-4"
      // prevent global hotkeys while editing here
      onKeyDownCapture={(e) => e.stopPropagation()}
    >
      <h3 className="text-lg font-semibold">Edit FAQ</h3>

      {/* AI Assist */}
      <div className="rounded border border-white/10 bg-neutral-900 text-white p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-300" />
          <div className="text-sm font-medium">AI Assist</div>
        </div>

        {/* Template context summary */}
        <div className="text-xs text-neutral-400">{contextSummary}</div>

        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs text-neutral-300">Prompt (optional)</label>
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder={`e.g., “Focus on response times, pricing, and what to do during a breakdown.”`}
              className="w-full rounded bg-neutral-800 border border-white/10 p-2 text-sm min-h-[74px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-neutral-300">Tone</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as any)}
                className="w-full rounded bg-neutral-800 border border-white/10 p-2 text-sm"
              >
                <option value="friendly">Friendly</option>
                <option value="professional">Professional</option>
                <option value="enthusiastic">Enthusiastic</option>
                <option value="matter-of-fact">Matter-of-fact</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-neutral-300">How many</label>
              <input
                type="number"
                min={1}
                max={10}
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value || '1', 10))}
                className="w-full rounded bg-neutral-800 border border-white/10 p-2 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-between">
          <p className="text-xs text-neutral-400">
            Generates concise, helpful Q&A. Questions should reflect your industry and services.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="text-sm bg-purple-600 hover:bg-purple-700 disabled:opacity-60 px-3 py-1.5 rounded text-white"
              title="Append AI-generated FAQs"
            >
              {loading ? 'Working…' : 'Generate'}
            </button>
            <button
              onClick={handleReplaceAll}
              disabled={loading}
              className="text-xs bg-rose-600 hover:bg-rose-700 disabled:opacity-60 px-3 py-1.5 rounded text-white"
              title="Replace current list with AI-generated FAQs"
            >
              Replace all with AI
            </button>
          </div>
        </div>
        {aiError ? <div className="text-xs text-red-300">{aiError}</div> : null}
      </div>

      {/* Manual editor */}
      <BlockField
        type="text"
        label="Section Title"
        value={title}
        onChange={(v) => setTitle(v)}
        error={fieldErrors?.title}
      />

      {items.map((item: FaqItem, i: number) => (
        <div key={i} className="border border-white/10 p-3 rounded space-y-2">
          <BlockField
            type="text"
            label={`Question ${i + 1}`}
            value={item.question}
            onChange={(v) => updateItem(i, 'question', v)}
          />
          <BlockField
            type="text"
            label={`Answer ${i + 1}`}
            value={item.answer}
            onChange={(v) => updateItem(i, 'answer', v)}
          />
        </div>
      ))}

      <div className="flex gap-2">
        <button onClick={addRow} className="text-sm text-green-400 underline">
          + Add Q&A
        </button>
        {items.length > 1 && (
          <button onClick={removeLast} className="text-sm text-red-400 underline">
            − Remove Last
          </button>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <button onClick={onClose} className="px-4 py-2 bg-gray-700 text-white rounded">
          Cancel
        </button>
        <button
          onClick={() =>
            onSave({ ...(faqBlock as any), content: { title, items } as any })
          }
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Save
        </button>
      </div>
    </div>
  );
}
