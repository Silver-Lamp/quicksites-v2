// components/admin/templates/block-editors/testimonial-editor.tsx
'use client';

import * as React from 'react';
import { useMemo, useState } from 'react';
import Image from 'next/image';
import { v4 as uuidv4 } from 'uuid';

import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import type { Block } from '@/types/blocks';
import type { Template } from '@/types/template';
import type { BlockEditorProps } from './index';
import BlockField from './block-field';
import TestimonialBlockComponent from '@/components/admin/templates/render-blocks/testimonial';
import { extractFieldErrors } from '../utils/extractFieldErrors';

type TestimonialItem = {
  _id: string;
  quote: string;
  attribution?: string | null;
  rating?: number | null;
  avatar_url?: string | null;
  ai_generated?: boolean;
};

type ImportSource = 'server_worker' | 'server_html' | 'client_proxy' | 'reader_direct';

const newId = () =>
  (typeof crypto !== 'undefined' && (crypto as any).randomUUID
    ? (crypto as any).randomUUID()
    : uuidv4());

function buildAvatarUrl(name?: string | null) {
  const seed = encodeURIComponent((name && name.trim()) || 'Customer');
  return `https://api.dicebear.com/7.x/initials/svg?radius=50&seed=${seed}`;
}

function DragHandle(props: any) {
  return (
    <button
      {...props}
      aria-label="Drag testimonial"
      className="cursor-grab active:cursor-grabbing text-neutral-400 hover:text-neutral-200"
      title="Drag to reorder"
    >
      ⠿
    </button>
  );
}

function SortableItem({
  item,
  onEdit,
  onDelete,
  isEditing,
  onChange,
  onSave,
  onCancel,
}: {
  item: TestimonialItem;
  onEdit: () => void;
  onDelete: () => void;
  isEditing: boolean;
  onChange: (updated: TestimonialItem) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } =
    useSortable({ id: item._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="p-3 border rounded bg-neutral-800 text-white space-y-2 relative"
    >
      <div className="absolute top-2 left-2">
        <DragHandle {...attributes} {...listeners} />
      </div>

      {isEditing ? (
        <div className="space-y-3 pl-6">
          <BlockField
            type="text"
            label="Quote"
            value={item.quote}
            onChange={(v: string) => onChange({ ...item, quote: v })}
          />
          <BlockField
            type="text"
            label="Attribution"
            value={item.attribution ?? ''}
            onChange={(v: string) => onChange({ ...item, attribution: v })}
          />
          <BlockField
            type="number"
            label="Rating (1–5)"
            value={(item.rating ?? 5).toString()}
            onChange={(v: string | number) => {
              const n = typeof v === 'number' ? v : parseInt(v || '5', 10);
              onChange({
                ...item,
                rating: Number.isFinite(n) ? Math.max(1, Math.min(5, n)) : 5,
              });
            }}
          />
          <BlockField
            type="text"
            label="Avatar URL (optional)"
            value={item.avatar_url ?? ''}
            onChange={(v: string) => onChange({ ...item, avatar_url: v || null })}
          />
          <div className="flex justify-end gap-2">
            <button onClick={onCancel} className="text-xs px-2 py-1 border rounded">
              Cancel
            </button>
            <button
              onClick={onSave}
              className="text-xs px-2 py-1 bg-blue-600 rounded text-white"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="pl-6 pr-8">
          <div className="text-sm">“{item.quote || ''}”</div>
          <div className="mt-1 flex items-center gap-2 text-xs text-gray-300">
            {item.avatar_url ? (
              <Image
                src={item.avatar_url}
                alt={item.attribution || 'Avatar'}
                width={24}
                height={24}
                className="rounded-full object-cover"
                placeholder="empty"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gray-700 text-white flex items-center justify-center text-[10px] font-medium">
                {(item.attribution?.split(' ').map((w) => w[0]).join('') || '?').toUpperCase()}
              </div>
            )}
            <span>{item.attribution || 'Anonymous'}</span>
            {item.rating ? <span>• {item.rating}★</span> : null}
            {item.ai_generated ? (
              <span className="ml-2 px-1.5 py-0.5 rounded bg-purple-700/40 border border-purple-500/40">
                AI Sample
              </span>
            ) : null}
          </div>

          <div className="absolute top-2 right-2 flex gap-2 text-xs">
            <button onClick={onEdit} className="text-blue-300">
              ✏️
            </button>
            <button onClick={onDelete} className="text-red-400">
              🗑
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TestimonialEditor({
  block,
  onSave,
  onClose,
  errors = {},
  template,
}: BlockEditorProps & { template: Template }) {
  // Prefer DB values
  const templateId = (template?.id as string) || undefined;
  const siteSlug = (template as any)?.slug as string | undefined;
  const dbIndustry = (template as any)?.industry as string | undefined;
  const availableServices: string[] = Array.isArray((template as any)?.services)
    ? ((template as any).services as string[])
    : [];

  // Fallback industry if DB missing
  const industry = dbIndustry || (block as any)?.industry || 'services';

  const initial = ((block.content as any)?.testimonials || []) as Omit<
    TestimonialItem,
    '_id'
  >[];
  const [testimonials, setTestimonials] = useState<TestimonialItem[]>(
    initial.map((t) => ({ ...t, _id: newId() }))
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [randomized, setRandomized] = useState<boolean>(
    (block.content as any)?.randomized || false
  );
  const [preview, setPreview] = useState(true);

  // AI controls
  const [aiPrompt, setAiPrompt] = useState('');
  const [tone, setTone] = useState<
    'friendly' | 'professional' | 'enthusiastic' | 'matter-of-fact'
  >('friendly');
  const [count, setCount] = useState(2);
  const [loading, setLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Importer controls
  const [importUrl, setImportUrl] = useState(
    'https://www.yelp.com/biz/joshs-mobile-rock-chip-repair-kenmore#reviews'
  );
  const [importCount, setImportCount] = useState(10);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [lastImport, setLastImport] = useState<null | { source: string; added: number }>(null);

  // Import source selector
  const [importSource, setImportSource] = useState<ImportSource>('server_worker');

  // Post-import curation & filtering
  const [minStars, setMinStars] = useState<number>(4); // default 4★
  const [curateRange, setCurateRange] = useState<boolean>(false);
  const [keepMin, setKeepMin] = useState<number>(4);
  const [keepMax, setKeepMax] = useState<number>(6);

  // Client proxy (browser) URL
  const PROXY = (process.env.NEXT_PUBLIC_REVIEWS_PROXY_URL as string | undefined) || '';

  const fieldErrors = extractFieldErrors(errors as unknown as string[]);
  const hasErrors = useMemo(
    () => Object.keys(fieldErrors).length > 0,
    [fieldErrors]
  );

  const toContent = (items: TestimonialItem[]) => ({
    testimonials: items.map(({ _id, ...t }) => t),
    randomized,
  });

  const persistSave = () => {
    onSave({ ...block, content: toContent(testimonials) } as Block);
    onClose();
  };

  // ---------- AI generation ----------
  async function callAI(n: number) {
    const res = await fetch('/api/testimonials/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: aiPrompt,
        industry,
        services: availableServices,
        tone,
        count: Math.max(1, Math.min(6, n)),
        template_id: templateId,
        site_slug: siteSlug,
      }),
    });
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return (await res.json()) as {
      testimonials: Array<{
        quote: string;
        attribution?: string | null;
        rating?: number | null;
        avatar_url?: string | null;
      }>;
      meta?: { industry?: string; services?: string[] };
    };
  }

  const handleGenerate = async () => {
    setLoading(true);
    setAiError(null);
    try {
      const data = await callAI(count);
      const newOnes: TestimonialItem[] = (data.testimonials || []).map((t) => ({
        _id: newId(),
        quote: t.quote,
        attribution: t.attribution ?? null,
        rating: t.rating ?? 5,
        avatar_url: t.avatar_url ?? null,
        ai_generated: true,
      }));
      if (!newOnes.length) throw new Error('No testimonials returned');
      setTestimonials((prev) => [...prev, ...newOnes]);
      setAiPrompt('');
    } catch (e: any) {
      setAiError(e?.message || 'Failed to generate testimonials');
    } finally {
      setLoading(false);
    }
  };

  const handleReplaceAllWithAI = async () => {
    setLoading(true);
    setAiError(null);
    try {
      const data = await callAI(Math.max(count, 3));
      const replaced: TestimonialItem[] = (data.testimonials || []).map((t) => ({
        _id: newId(),
        quote: t.quote,
        attribution: t.attribution ?? null,
        rating: t.rating ?? 5,
        avatar_url: t.avatar_url ?? null,
        ai_generated: true,
      }));
      if (!replaced.length) throw new Error('No testimonials returned');
      setTestimonials(replaced);
      setAiPrompt('');
    } catch (e: any) {
      setAiError(e?.message || 'Failed to replace with AI testimonials');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAvatars = () => {
    setTestimonials((prev) =>
      prev.map((t) =>
        t.avatar_url ? t : { ...t, avatar_url: buildAvatarUrl(t.attribution || undefined) }
      )
    );
  };

  // ---------- utilities ----------
  function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function clamp(n: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, n));
  }

  // ---------- Dispatch based on source ----------
  async function dispatchImport(mode: 'append' | 'replace') {
    if (importSource === 'server_worker') return handleImportWorker(mode);
    if (importSource === 'server_html') return handleImport(mode);
    if (importSource === 'client_proxy') return handleClientImportViaProxy(mode);
    return handleClientImportReaderDirect(mode);
  }

  // ---------- Server: Worker JSON (render) ----------
  async function handleImportWorker(mode: 'append' | 'replace' = 'append') {
    const url = (importUrl || '').trim();
    if (!url) {
      setImportError('Please paste a URL.');
      return;
    }
    if (mode === 'replace' && testimonials.length > 0) {
      const ok = window.confirm('Replace all existing testimonials with the imported set?');
      if (!ok) return;
    }

    setImportLoading(true);
    setImportError(null);
    setImportNotice(null);
    try {
      const res = await fetch('/api/reviews/import-worker?debug=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, limit: Math.max(1, Math.min(50, importCount)) }),
      });
      if (!res.ok) throw new Error(await res.text());

      const data = await res.json() as {
        reviews: Array<{ quote: string; attribution?: string | null; rating?: number | null }>;
        source?: any; debug?: any;
      };

      let imported = (data.reviews || []).map(r => ({
        _id: newId(),
        quote: (r.quote || '').trim(),
        attribution: r.attribution?.trim() || null,
        rating: typeof r.rating === 'number' && Number.isFinite(r.rating) ? r.rating : null,
        avatar_url: buildAvatarUrl(r.attribution || undefined),
        ai_generated: false,
      })).filter(r => r.quote.length > 0);

      if (minStars > 0) imported = imported.filter(r => r.rating != null && r.rating >= minStars);

      if (curateRange && imported.length > 0) {
        const lo = clamp(Math.min(keepMin, keepMax), 1, 50);
        const hi = clamp(Math.max(keepMin, keepMax), lo, 50);
        const k = clamp(Math.floor(Math.random() * (hi - lo + 1)) + lo, 1, imported.length);
        imported = shuffle(imported).slice(0, k);
      }

      if (!imported.length) throw new Error('No reviews matched your filters.');

      if (mode === 'append') {
        const existing = new Set(testimonials.map(t => t.quote.trim().toLowerCase().replace(/\s+/g,' ')));
        imported = imported.filter(r => {
          const k = r.quote.trim().toLowerCase().replace(/\s+/g,' ');
          if (existing.has(k)) return false; existing.add(k); return true;
        });
        if (!imported.length) throw new Error('No new reviews after de-duplication.');
        setTestimonials(prev => [...prev, ...imported]);
      } else {
        setTestimonials(imported);
      }

      setLastImport({ source: 'server (worker json)', added: imported.length });
      setImportNotice('Imported via Worker render → JSON (ratings preserved when available).');
    } catch (e:any) {
      setImportError(e?.message || 'Worker import failed');
    } finally {
      setImportLoading(false);
    }
  }

  // ---------- Server: HTML route (append | replace) ----------
  async function handleImport(mode: 'append' | 'replace' = 'append') {
    const url = (importUrl || '').trim();
    if (!url) {
      setImportError('Please paste a URL.');
      return;
    }
    if (mode === 'replace' && testimonials.length > 0) {
      const ok = window.confirm('Replace all existing testimonials with the imported set?');
      if (!ok) return;
    }

    setImportLoading(true);
    setImportError(null);
    setImportNotice(null);
    try {
      const res = await fetch('/api/reviews/import?debug=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, limit: Math.max(1, Math.min(50, importCount)) }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => '');
        throw new Error(msg || `Import failed (${res.status})`);
      }
      const data = (await res.json()) as {
        reviews: Array<{ quote: string; attribution?: string | null; rating?: number | null }>;
        source?: { provider?: string; url?: string };
        debug?: any;
      };

      let imported: TestimonialItem[] = (data.reviews || [])
        .map((r) => ({
          _id: newId(),
          quote: (r.quote || '').trim(),
          attribution: r.attribution?.trim() || null,
          rating:
            typeof r.rating === 'number' && Number.isFinite(r.rating)
              ? r.rating
              : null,
          avatar_url: buildAvatarUrl(r.attribution || undefined),
          ai_generated: false,
        }))
        .filter((r) => r.quote.length > 0);

      if (minStars > 0) {
        imported = imported.filter((r) => r.rating != null && (r.rating as number) >= minStars);
      }

      if (curateRange && imported.length > 0) {
        const lo = clamp(Math.min(keepMin, keepMax), 1, 50);
        const hi = clamp(Math.max(keepMin, keepMax), lo, 50);
        const k = clamp(Math.floor(Math.random() * (hi - lo + 1)) + lo, 1, imported.length);
        imported = shuffle(imported).slice(0, k);
      }

      if (!imported.length) throw new Error('No reviews matched your filters.');

      if (mode === 'append') {
        const existingQuotes = new Set(
          testimonials.map((t) => t.quote.trim().toLowerCase().replace(/\s+/g, ' '))
        );
        imported = imported.filter((r) => {
          const key = r.quote.trim().toLowerCase().replace(/\s+/g, ' ');
          if (existingQuotes.has(key)) return false;
          existingQuotes.add(key);
          return true;
        });
        if (!imported.length) throw new Error('No new reviews after de-duplication.');
        setTestimonials((prev) => [...prev, ...imported]);
      } else {
        setTestimonials(imported);
      }

      setLastImport({ source: 'server (html/proxy)', added: imported.length });
      setImportNotice('Imported via server route (ratings supported when available).');
    } catch (e: any) {
      setImportError(e?.message || 'Failed to import reviews');
    } finally {
      setImportLoading(false);
    }
  }

  // ---------- Import via client proxy (reader mode) ----------
  async function handleClientImportViaProxy(mode: 'append' | 'replace' = 'append') {
    const url = (importUrl || '').trim();
    if (!url) {
      setImportError('Please paste a URL.');
      return;
    }
    if (!PROXY) {
      setImportError('Client proxy not configured. Set NEXT_PUBLIC_REVIEWS_PROXY_URL in .env.local');
      return;
    }
    if (mode === 'replace' && testimonials.length > 0) {
      const ok = window.confirm('Replace all existing testimonials with the imported set?');
      if (!ok) return;
    }

    setImportLoading(true);
    setImportError(null);
    setImportNotice(null);
    try {
      const proxUrl = `${PROXY}?url=${encodeURIComponent(url)}&mode=reader`;
      const resp = await fetch(proxUrl, { headers: { accept: 'text/plain' } });
      if (!resp.ok) throw new Error(`Proxy returned ${resp.status}`);
      const txt = await resp.text();

      let paras = txt
        .split(/\n{2,}/g)
        .map((s) => s.trim())
        .filter((s) => s.length >= 40);

      if (!paras.length) throw new Error('No readable paragraphs found.');
      paras = paras.slice(0, Math.max(1, Math.min(50, importCount)));

      let incoming: TestimonialItem[] = paras.map((q) => ({
        _id: newId(),
        quote: q,
        attribution: null,
        rating: null,
        avatar_url: null,
        ai_generated: false,
      }));

      if (curateRange && incoming.length > 0) {
        const lo = clamp(Math.min(keepMin, keepMax), 1, 50);
        const hi = clamp(Math.max(keepMin, keepMax), lo, 50);
        const k = clamp(Math.floor(Math.random() * (hi - lo + 1)) + lo, 1, incoming.length);
        incoming = shuffle(incoming).slice(0, k);
      }

      if (mode === 'replace') {
        setTestimonials(incoming);
      } else {
        const existing = new Set(
          testimonials.map((t) => t.quote.trim().toLowerCase().replace(/\s+/g, ' '))
        );
        const deduped = incoming.filter((r) => {
          const k = r.quote.trim().toLowerCase().replace(/\s+/g, ' ');
          if (existing.has(k)) return false;
          existing.add(k);
          return true;
        });
        if (!deduped.length) throw new Error('No new reviews after de-duplication.');
        setTestimonials((prev) => [...prev, ...deduped]);
      }

      setLastImport({ source: 'client proxy (reader)', added: (mode === 'replace' ? incoming.length : undefined) as any ?? 0 });
      setImportNotice('Imported via client proxy reader (no star ratings available).');
    } catch (e: any) {
      setImportError(e?.message || 'Client import failed');
    } finally {
      setImportLoading(false);
    }
  }

  // ---------- Import via reader direct (no proxy) ----------
  async function handleClientImportReaderDirect(mode: 'append' | 'replace' = 'append') {
    const url = (importUrl || '').trim();
    if (!url) {
      setImportError('Please paste a URL.');
      return;
    }
    if (mode === 'replace' && testimonials.length > 0) {
      const ok = window.confirm('Replace all existing testimonials with the imported set?');
      if (!ok) return;
    }

    setImportLoading(true);
    setImportError(null);
    setImportNotice(null);
    try {
      const readerUrl = `https://r.jina.ai/http://${url.replace(/^https?:\/\//, '')}`;
      const resp = await fetch(readerUrl, { headers: { accept: 'text/plain' } });
      if (!resp.ok) throw new Error(`Reader returned ${resp.status}`);
      const txt = await resp.text();

      let paras = txt
        .split(/\n{2,}/g)
        .map((s) => s.trim())
        .filter((s) => s.length >= 40);

      if (!paras.length) throw new Error('No readable paragraphs found.');
      paras = paras.slice(0, Math.max(1, Math.min(50, importCount)));

      let incoming: TestimonialItem[] = paras.map((q) => ({
        _id: newId(),
        quote: q,
        attribution: null,
        rating: null,
        avatar_url: null,
        ai_generated: false,
      }));

      if (curateRange && incoming.length > 0) {
        const lo = clamp(Math.min(keepMin, keepMax), 1, 50);
        const hi = clamp(Math.max(keepMin, keepMax), lo, 50);
        const k = clamp(Math.floor(Math.random() * (hi - lo + 1)) + lo, 1, incoming.length);
        incoming = shuffle(incoming).slice(0, k);
      }

      if (mode === 'replace') {
        setTestimonials(incoming);
      } else {
        const existing = new Set(
          testimonials.map((t) => t.quote.trim().toLowerCase().replace(/\s+/g, ' '))
        );
        const deduped = incoming.filter((r) => {
          const k = r.quote.trim().toLowerCase().replace(/\s+/g, ' ');
          if (existing.has(k)) return false;
          existing.add(k);
          return true;
        });
        if (!deduped.length) throw new Error('No new reviews after de-duplication.');
        setTestimonials((prev) => [...prev, ...deduped]);
      }

      setLastImport({ source: 'reader direct', added: (mode === 'replace' ? incoming.length : undefined) as any ?? 0 });
      setImportNotice('Imported via direct reader (no star ratings available).');
    } catch (e: any) {
      setImportError(e?.message || 'Reader import failed');
    } finally {
      setImportLoading(false);
    }
  }

  // ---------- Paste from clipboard (bookmarklet flow) ----------
  async function handlePasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      let raw: any;
      try { raw = JSON.parse(text); } catch {}
      if (!Array.isArray(raw)) throw new Error('Clipboard does not contain reviews JSON. Run the bookmarklet on the Yelp page first.');

      let incoming: TestimonialItem[] = raw
        .map((r: any) => ({
          _id: newId(),
          quote: String(r.quote || '').trim(),
          attribution: r.attribution ? String(r.attribution).trim() : null,
          rating: typeof r.rating === 'number' ? Math.max(1, Math.min(5, Math.round(r.rating))) : null,
          avatar_url: r.attribution ? buildAvatarUrl(r.attribution) : null,
          ai_generated: false,
        }))
        .filter((r) => r.quote.length > 0);

      if (minStars > 0) {
        incoming = incoming.filter((r) => r.rating != null && (r.rating as number) >= minStars);
      }

      if (curateRange && incoming.length > 0) {
        const lo = clamp(Math.min(keepMin, keepMax), 1, 50);
        const hi = clamp(Math.max(keepMin, keepMax), lo, 50);
        const k = clamp(Math.floor(Math.random() * (hi - lo + 1)) + lo, 1, incoming.length);
        incoming = shuffle(incoming).slice(0, k);
      }

      const existing = new Set(
        testimonials.map((t) => t.quote.trim().toLowerCase().replace(/\s+/g, ' '))
      );
      const deduped = incoming.filter((r) => {
        const k = r.quote.trim().toLowerCase().replace(/\s+/g, ' ');
        if (existing.has(k)) return false;
        existing.add(k);
        return true;
      });

      if (!deduped.length) throw new Error('No new reviews after de-duplication.');

      setTestimonials((prev) => [...prev, ...deduped]);
      setLastImport({ source: 'clipboard (bookmarklet)', added: deduped.length });
      setImportNotice('Pasted reviews from bookmarklet JSON.');
      setImportError(null);
    } catch (e: any) {
      setImportError(e?.message || 'Failed to paste reviews');
    }
  }

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setTestimonials((prev) => {
      const oldIndex = prev.findIndex((t) => t._id === active.id);
      const newIndex = prev.findIndex((t) => t._id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  return (
    <div className="space-y-4 bg-black text-white border border-black p-4 rounded">
      <h3 className="text-lg font-semibold">Edit Testimonials</h3>

      {/* Import from URL */}
      <div className="rounded border border-white/10 bg-neutral-900 p-3 space-y-3">
        <div className="text-sm font-medium">Import reviews from URL</div>

        <div className="grid md:grid-cols-[1fr,120px] gap-3">
          <input
            type="url"
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            placeholder="https://www.yelp.com/biz/your-business#reviews"
            className="w-full rounded bg-neutral-800 border border-white/10 p-2 text-sm"
          />
          <input
            type="number"
            min={1}
            max={50}
            value={importCount}
            onChange={(e) => setImportCount(parseInt(e.target.value || '10', 10))}
            title="How many reviews to try to import"
            className="w-full rounded bg-neutral-800 border border-white/10 p-2 text-sm"
          />
        </div>

        {/* Filters, curation, and source */}
        <div className="grid md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-neutral-300">Min stars</label>
            <select
              value={minStars}
              onChange={(e) => setMinStars(parseInt(e.target.value, 10))}
              className="w-full rounded bg-neutral-800 border border-white/10 p-2 text-sm"
            >
              <option value={0}>No minimum</option>
              <option value={3}>3★+</option>
              <option value={4}>4★+</option>
              <option value={5}>5★ only</option>
            </select>
            <div className="text-[11px] text-neutral-400">
              Unrated reviews are excluded when a minimum is set.
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-neutral-300">Keep 4–6 & shuffle</label>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={curateRange}
                onChange={(e) => setCurateRange(e.target.checked)}
                className="accent-purple-600"
              />
              <span className="text-xs text-neutral-300">Enabled</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <input
                type="number"
                min={1}
                max={50}
                value={keepMin}
                onChange={(e) => setKeepMin(parseInt(e.target.value || '4', 10))}
                disabled={!curateRange}
                className="w-full rounded bg-neutral-800 border border-white/10 p-2 text-sm"
                title="Min to keep"
              />
              <input
                type="number"
                min={1}
                max={50}
                value={keepMax}
                onChange={(e) => setKeepMax(parseInt(e.target.value || '6', 10))}
                disabled={!curateRange}
                className="w-full rounded bg-neutral-800 border border-white/10 p-2 text-sm"
                title="Max to keep"
              />
            </div>
            <div className="text-[11px] text-neutral-400">
              When enabled, we shuffle and keep a random count within the range.
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-neutral-300">Import source</label>
            <select
              value={importSource}
              onChange={(e) => setImportSource(e.target.value as ImportSource)}
              className="w-full rounded bg-neutral-800 border border-white/10 p-2 text-sm"
            >
              <option value="server_worker">Server – Worker JSON (render)</option>
              <option value="server_html">Server – HTML (direct/proxy)</option>
              <option value="client_proxy">Client – Proxy (reader)</option>
              <option value="reader_direct">Client – Reader (direct)</option>
            </select>
            <div className="text-[11px] text-neutral-400">
              Worker JSON preserves ratings when available; reader modes don’t.
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-end justify-end gap-2">
          <button
            onClick={() => dispatchImport('append')}
            disabled={importLoading}
            className="h-[38px] text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-60 px-3 py-1.5 rounded text-white"
            title="Append imported reviews to the current list"
          >
            {importLoading ? 'Importing…' : 'Import (append)'}
          </button>
          <button
            onClick={() => dispatchImport('replace')}
            disabled={importLoading}
            className="h-[38px] text-sm bg-rose-600 hover:bg-rose-700 disabled:opacity-60 px-3 py-1.5 rounded text-white"
            title="Replace current testimonials with the imported set"
          >
            {importLoading ? 'Replacing…' : 'Replace with import'}
          </button>
          <button
            onClick={handlePasteFromClipboard}
            disabled={importLoading}
            className="h-[38px] text-sm bg-sky-600 hover:bg-sky-700 disabled:opacity-60 px-3 py-1.5 rounded text-white"
            title="Paste reviews JSON copied by the bookmarklet"
          >
            Paste reviews
          </button>
        </div>

        {lastImport ? (
          <div className="text-[11px] text-neutral-400">
            Last import: <span className="text-neutral-200">{lastImport.added}</span> added via{' '}
            <span className="text-neutral-200">{lastImport.source}</span>.
          </div>
        ) : null}

        {importNotice ? (
          <div className="text-[11px] text-emerald-300">{importNotice}</div>
        ) : null}

        {importError ? (
          <div className="text-xs text-red-300 whitespace-pre-wrap">{importError}</div>
        ) : PROXY ? (
          <div className="text-[11px] text-neutral-400">
            Tip: Client proxy & reader imports use readable text (no star ratings). Set “Min stars”
            to “No minimum” for those runs.
          </div>
        ) : (
          <div className="text-[11px] text-amber-300">
            Client proxy unavailable — set <code>NEXT_PUBLIC_REVIEWS_PROXY_URL</code> in
            <code> .env.local</code>.
          </div>
        )}
      </div>

      {/* AI generator */}
      <div className="rounded border border-white/10 bg-neutral-900 p-3 space-y-3">
        <div className="text-sm font-medium">AI generator</div>

        {/* DB context summary */}
        <div className="text-xs text-neutral-400">
          <div>
            <span className="opacity-70">Industry:</span>{' '}
            <span className="font-medium text-neutral-200">{dbIndustry || industry}</span>
          </div>
          <div className="mt-1">
            <span className="opacity-70">Services (DB):</span>{' '}
            {availableServices.length ? (
              <span className="text-neutral-200">{availableServices.join(', ')}</span>
            ) : (
              <span className="italic">none configured</span>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs text-neutral-300">Prompt (optional)</label>
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder={`e.g. “Mention fast response time and careful handling.”`}
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
                max={6}
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value || '1', 10))}
                className="w-full rounded bg-neutral-800 border border-white/10 p-2 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-between">
          <p className="text-xs text-neutral-400">
            Generated quotes are tagged as <span className="text-purple-300">AI Sample</span>.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddAvatars}
              className="text-xs bg-neutral-700 hover:bg-neutral-600 px-3 py-1.5 rounded"
              title="Fill missing avatars with initials-based images"
            >
              Add avatars
            </button>
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="text-sm bg-purple-600 hover:bg-purple-700 disabled:opacity-60 px-3 py-1.5 rounded text-white"
            >
              {loading ? 'Working…' : 'Generate'}
            </button>
            <button
              onClick={handleReplaceAllWithAI}
              disabled={loading}
              className="text-xs bg-rose-600 hover:bg-rose-700 disabled:opacity-60 px-3 py-1.5 rounded text-white"
              title="Replace current list with fresh AI samples"
            >
              Replace all with AI
            </button>
          </div>
        </div>
        {aiError ? <div className="text-xs text-red-300">{aiError}</div> : null}
      </div>

      {/* Sortable list */}
      <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext
          items={testimonials.map((t) => t._id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="grid gap-3">
            {testimonials.map((item) => (
              <SortableItem
                key={item._id}
                item={item}
                isEditing={editingId === item._id}
                onEdit={() => setEditingId(item._id)}
                onCancel={() => setEditingId(null)}
                onChange={(updated) =>
                  setTestimonials((prev) =>
                    prev.map((t) => (t._id === item._id ? updated : t))
                  )
                }
                onSave={() => setEditingId(null)}
                onDelete={() =>
                  setTestimonials((prev) => prev.filter((t) => t._id !== item._id))
                }
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Controls */}
      <div className="pt-2 flex items-center justify-between">
        <button
          onClick={() =>
            setTestimonials((prev) => [
              ...prev,
              { _id: newId(), quote: '', attribution: '', rating: 5, avatar_url: null },
            ])
          }
          className="text-sm bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded text-white"
        >
          ➕ Add Testimonial
        </button>

        <label className="flex items-center gap-2 text-xs text-neutral-300">
          <input
            type="checkbox"
            checked={randomized}
            onChange={(e) => setRandomized(e.target.checked)}
            className="accent-purple-600"
          />
          Randomize on render
        </label>
      </div>

      {/* Preview */}
      <div className="pt-2">
        <button
          onClick={() => setPreview(!preview)}
          className="text-xs underline text-white/70"
        >
          {preview ? 'Hide' : 'Show'} Preview
        </button>
        {preview && (
          <div className="bg-neutral-900 p-4 mt-2 rounded border border-white/10">
            <TestimonialBlockComponent
              block={{
                ...block,
                content: toContent(testimonials),
              } as Block}
              template={template as Template}
            />
          </div>
        )}
      </div>

      {/* Persist */}
      <div className="flex justify-end gap-2 pt-4">
        <button
          onClick={onClose}
          className="text-sm px-4 py-2 border border-gray-500 rounded hover:bg-neutral-800"
        >
          Cancel
        </button>
        <button
          onClick={persistSave}
          className="text-sm px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
          disabled={hasErrors}
          title={hasErrors ? 'Fix validation errors before saving' : undefined}
        >
          Save
        </button>
      </div>
    </div>
  );
}
