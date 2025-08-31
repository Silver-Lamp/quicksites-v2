'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Info } from 'lucide-react';

type Props = {
  productsCount: number;
  productPhotosAi: boolean;
  productImageSize?: string;
  productImagesPerItem?: number;
  generateTemplate: boolean;
  templateDraft?: any;

  providerChat?: string;
  modelChat?: string;
  imageProviderHero?: string;
  imageModelHero?: string;
  imageProviderProduct?: string;
  imageModelProduct?: string;

  onReadyChange?: (ready: boolean) => void;
};

function useDebounced<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function templateFingerprint(t?: any) {
  try {
    if (!t) return 'none';
    const pages = Array.isArray(t.pages) ? t.pages : [];
    let heroes = 0;
    for (const p of pages) {
      for (const b of p?.blocks || []) if (b?.type === 'hero') heroes++;
    }
    return `p:${pages.length};h:${heroes}`;
  } catch {
    return 'err';
  }
}

export default function RunCostEstimate({
  productsCount,
  productPhotosAi,
  productImageSize,
  productImagesPerItem = 1,
  generateTemplate,
  templateDraft,

  providerChat,
  modelChat,
  imageProviderHero,
  imageModelHero,
  imageProviderProduct,
  imageModelProduct,

  onReadyChange,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [bd, setBd] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  // keep callback stable inside the effect without re-triggering
  const readyRef = useRef<(r: boolean) => void>(() => {});
  useEffect(() => {
    readyRef.current = onReadyChange ?? (() => {});
  }, [onReadyChange]);

  const tSig = useMemo(() => templateFingerprint(templateDraft), [templateDraft]);

  // Build a *key* of ONLY primitives so we can debounce + compare
  const reqKey = useMemo(
    () =>
      JSON.stringify({
        productsCount,
        productPhotosAi,
        productImageSize: productImageSize || '1024x1024',
        productImagesPerItem,
        generateTemplate,
        tSig,
        providerChat: providerChat || '',
        modelChat: modelChat || '',
        imageProviderHero: imageProviderHero || '',
        imageModelHero: imageModelHero || '',
        imageProviderProduct: imageProviderProduct || '',
        imageModelProduct: imageModelProduct || '',
      }),
    [
      productsCount,
      productPhotosAi,
      productImageSize,
      productImagesPerItem,
      generateTemplate,
      tSig,
      providerChat,
      modelChat,
      imageProviderHero,
      imageModelHero,
      imageProviderProduct,
      imageModelProduct,
    ]
  );

  const debKey = useDebounced(reqKey, 350);

  useEffect(() => {
    const controller = new AbortController();

    async function run() {
      setLoading(true);
      setErr(null);
      readyRef.current?.(false);

      try {
        // Recreate the body from current props (not from reqKey)
        const body = {
          productsCount,
          productPhotosAi,
          productImageSize,
          productImagesPerItem,
          generateTemplate,
          templateDraft, // okay to send big; the key is based on tSig so we only send when it *likely* changed
          providerChat,
          modelChat,
          imageProviderHero,
          imageModelHero,
          imageProviderProduct,
          imageModelProduct,
        };

        const r = await fetch('/api/admin/ai-cost/estimate-seed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);

        setTotal(j.total ?? null);
        setBd(j.breakdown ?? null);
      } catch (e: any) {
        if (e?.name === 'AbortError') return; // ignore
        setTotal(null);
        setBd(null);
        setErr(e?.message || 'estimate failed');
      } finally {
        setLoading(false);
        readyRef.current?.(true);
      }
    }

    run();

    return () => controller.abort();
    // Intentionally depend ONLY on the debounced key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debKey]);

  return (
    <div className="flex items-center gap-3">
      <div className="text-sm">
        <div className="font-medium">Cost for this run</div>
        <div className="text-muted-foreground">
          {loading ? 'estimating…' : err ? '—' : total != null ? `$${total.toFixed(2)}` : '—'}
        </div>
      </div>

      {bd && !err && (
        <details className="text-xs">
          <summary className="cursor-pointer inline-flex items-center gap-1">
            <Info className="h-4 w-4" /> breakdown
          </summary>
          <div className="mt-1 p-2 rounded border bg-background/60 shadow-sm whitespace-nowrap">
            <div>Template text: ${bd.template_text?.toFixed(4) ?? '0.0000'}</div>
            <div>Hero images: ${bd.hero_images?.toFixed(4) ?? '0.0000'}</div>
            <div>Products text: ${bd.products_text?.toFixed(4) ?? '0.0000'}</div>
            <div>Product images: ${bd.product_images?.toFixed(4) ?? '0.0000'}</div>
          </div>
        </details>
      )}

      {err && (
        <details className="text-xs">
          <summary className="cursor-pointer underline text-amber-500">estimator error</summary>
          <div className="mt-1">{String(err)}</div>
        </details>
      )}
    </div>
  );
}
