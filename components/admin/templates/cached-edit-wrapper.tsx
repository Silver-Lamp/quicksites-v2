// components/admin/templates/cached-edit-wrapper.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import EditWrapper from '@/components/admin/templates/edit-wrapper';
import { supabase } from '@/lib/supabase/client';
import {
  readTemplateCache,
  writeTemplateCache,
  newerThan,
  clearTemplateCache,
  TEMPLATE_CACHE_INVALIDATE,
  TEMPLATE_CACHE_UPDATE,
  type TemplateCacheRow,
} from '@/lib/templateCache';

type Props =
  | { id: string; initialTemplate: any; slug?: never }
  | { slug: string; initialTemplate: any; id?: never };

/* ---------------- Normalizers ---------------- */

function normalizeBlocksArray(blocks: any[] | undefined | null) {
  if (!Array.isArray(blocks)) return [];
  return blocks.map((b: any) => {
    const id = b?._id || b?.id || (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
    const type = b?.type || b?.block_type || b?.kind || 'unknown';
    // ensure .content exists (fallback to .props)
    const content = b?.content ?? b?.props ?? {};
    return {
      ...b,
      _id: id,
      id,
      type,
      content,
      // keep props for backward compat but prefer content downstream
    };
  });
}

function normalizePage(p: any) {
  const blocks = p?.content_blocks ?? p?.blocks ?? [];
  return {
    ...p,
    content_blocks: normalizeBlocksArray(blocks),
  };
}

function normalizeData(data: any) {
  const d = data ?? {};
  const pages = Array.isArray(d?.pages) ? d.pages.map(normalizePage) : [];
  const headerBlock = d?.headerBlock ?? d?.header_block ?? null;
  const footerBlock = d?.footerBlock ?? d?.footer_block ?? null;
  return { ...d, pages, headerBlock, footerBlock };
}

function toCacheShape(raw: any): TemplateCacheRow {
  const t = raw ?? {};
  const normalizedData = normalizeData(t?.data ?? t?.templateData ?? {});
  return {
    id: t?.id,
    slug: t?.slug ?? null,
    template_name: t?.template_name ?? null,
    updated_at: t?.updated_at ?? new Date().toISOString(),
    color_mode: t?.color_mode ?? null,
    data: normalizedData,
    header_block: t?.header_block ?? normalizedData?.headerBlock ?? null,
    footer_block: t?.footer_block ?? normalizedData?.footerBlock ?? null,
  };
}

/* ---------------- Component ---------------- */

export default function CachedEditWrapper(props: Props) {
  const server = props.initialTemplate;
  const resolvedId = (props as any).id ?? server?.id ?? null;
  const resolvedSlug = (props as any).slug ?? server?.slug ?? null;
  const cacheKey = (resolvedId || resolvedSlug || '') as string;

  // 1) initial payload: cache (if fresher) → server (both normalized)
  const cached = typeof window !== 'undefined' && cacheKey
    ? readTemplateCache(cacheKey)
    : null;

  const initial = useMemo(() => {
    const serverShape = toCacheShape(server);
    if (cached && newerThan(cached.updated_at, serverShape.updated_at)) return cached;
    return serverShape;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  const [current, setCurrent] = useState<TemplateCacheRow>(initial);

  // 2) write back the normalized server payload to cache (if newer)
  useEffect(() => {
    const serverShape = toCacheShape(server);
    if (!cached || newerThan(serverShape.updated_at, cached.updated_at)) {
      writeTemplateCache(serverShape);
      setCurrent((prev) =>
        newerThan(serverShape.updated_at, prev.updated_at) ? serverShape : prev
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 3a) Realtime sync (normalize before applying)
  useEffect(() => {
    if (!resolvedId) return;
    const ch = supabase
      .channel(`tpl:${resolvedId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'templates', filter: `id=eq.${resolvedId}` },
        (payload: any) => {
          const row = (payload.new || payload.record) as any;
          if (!row) return;
          const next = toCacheShape(row);
          if (newerThan(next.updated_at, current.updated_at)) {
            writeTemplateCache(next);
            setCurrent(next);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedId, current.updated_at]);

  // 3b) Cache events (invalidate / update)
  useEffect(() => {
    const onInvalidate = (e: Event) => {
      const key = (e as CustomEvent<{ key?: string }>).detail?.key;
      if (!key) return;
      if (key === resolvedId || key === resolvedSlug) {
        clearTemplateCache(key);
      }
    };
    const onUpdate = (e: Event) => {
      const row = (e as CustomEvent<{ row?: TemplateCacheRow }>).detail?.row;
      if (!row) return;
      if (row.id === resolvedId || (!!resolvedSlug && row.slug === resolvedSlug)) {
        const next = { ...row, data: normalizeData(row.data) }; // normalize just in case
        if (newerThan(next.updated_at, current.updated_at)) {
          writeTemplateCache(next);
          setCurrent(next);
        }
      }
    };
    window.addEventListener(TEMPLATE_CACHE_INVALIDATE, onInvalidate as any);
    window.addEventListener(TEMPLATE_CACHE_UPDATE, onUpdate as any);
    return () => {
      window.removeEventListener(TEMPLATE_CACHE_INVALIDATE, onInvalidate as any);
      window.removeEventListener(TEMPLATE_CACHE_UPDATE, onUpdate as any);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedId, resolvedSlug, current.updated_at]);

  // 3c) Cross-tab storage sync
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const idKey = resolvedId ? `qs:tpl:v1:${resolvedId}` : null;
    const slugKey = resolvedSlug ? `qs:tpl:v1:${resolvedSlug}` : null;
    const onStorage = (e: StorageEvent) => {
      if (!e.key || (!idKey && !slugKey)) return;
      if (e.key !== idKey && e.key !== slugKey) return;
      if (!e.newValue) return;
      try {
        const env = JSON.parse(e.newValue) as { row?: TemplateCacheRow; t?: number };
        const row = env?.row;
        if (!row) return;
        const next = { ...row, data: normalizeData(row.data) };
        if (newerThan(next.updated_at, current.updated_at)) setCurrent(next);
      } catch {}
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedId, resolvedSlug, current.updated_at]);

  // 4) Render editor with normalized payload
  if (resolvedId) return <EditWrapper id={resolvedId} initialTemplate={current as any} />;
  return <EditWrapper slug={resolvedSlug as string} initialTemplate={current as any} />;
}
