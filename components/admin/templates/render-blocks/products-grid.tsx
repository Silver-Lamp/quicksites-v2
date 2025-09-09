// components/admin/templates/render-blocks/products-grid.tsx
'use client';

import * as React from 'react';
import Link from 'next/link';
import type { Block } from '@/types/blocks';

type Product = {
  id: string;
  title: string;
  price_cents: number;
  image_url?: string | null;
  product_type?: string | null;
  slug?: string | null;
  qty_available?: number | null;
};

const clamp = (n: number, min = 1, max = 4) =>
  Math.max(min, Math.min(max, Number.isFinite(n) ? n : 0));

function readIds(c: any): string[] {
  if (!c) return [];
  if (Array.isArray(c.product_ids)) return c.product_ids.filter(Boolean);
  if (Array.isArray(c.productIds)) return c.productIds.filter(Boolean);
  if (Array.isArray(c.ids)) return c.ids.filter(Boolean);
  if (Array.isArray(c.items)) return c.items.map((x: any) => x?.id).filter(Boolean);
  return [];
}

function getTpl(): any {
  return (window as any).__QS_TPL_REF__?.current ?? (window as any).__QS_TEMPLATE__ ?? null;
}
function readMerchantFromTpl() {
  try {
    const tpl = getTpl();
    const data = tpl?.data ?? {};
    const metaE = data?.meta?.ecom ?? data?.meta?.ecommerce ?? {};
    const email =
      metaE?.merchant_email ??
      data?.ecommerce?.merchant_email ??
      data?.merchant_email ??
      '';
    const merchantId =
      metaE?.merchant_id ??
      data?.ecommerce?.merchant_id ??
      '';
    return { email: String(email || ''), merchantId: String(merchantId || '') };
  } catch { return { email: '', merchantId: '' }; }
}

function productHref(p: Product) {
  return p.slug ? `/p/${encodeURIComponent(p.slug)}` : `/product/${encodeURIComponent(p.id)}`;
}

function emitAddToCart(detail: { id: string; qty: number }) {
  try { window.dispatchEvent(new CustomEvent('qs:cart:add', { detail })); } catch {}
  // optional: naive localStorage cart for dev
  try {
    const key = 'qs_cart';
    const current = JSON.parse(localStorage.getItem(key) || '[]') as Array<{id:string;qty:number}>;
    const idx = current.findIndex(x => x.id === detail.id);
    if (idx >= 0) current[idx].qty += detail.qty; else current.push({ id: detail.id, qty: detail.qty });
    localStorage.setItem(key, JSON.stringify(current));
    window.dispatchEvent(new CustomEvent('qs:cart:changed', { detail: { items: current }}));
  } catch {}
}

export default function RenderProductsGrid({ block }: { block: Block }) {
  const content: any = block?.content ?? {};
  const ids = React.useMemo(() => readIds(content), [content]);
  const columns = clamp(Number(content.columns ?? 3), 1, 4);
  const limit = Math.max(1, Number(content.limit ?? columns * 3));

  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchProducts = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (ids.length) {
        const unique = Array.from(new Set(ids));
        const qs = new URLSearchParams({ ids: unique.join(',') });
        const res = await fetch(`/api/public/products?${qs.toString()}`, { cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || `${res.status} ${res.statusText}`);
        const got: Product[] = Array.isArray(json.products) ? json.products : [];
        const byId = new Map(got.map((p) => [p.id, p]));
        setProducts(unique.map((id) => byId.get(id)).filter(Boolean) as Product[]);
      } else {
        const { merchantId, email } = readMerchantFromTpl();
        if (!merchantId && !email) { setProducts([]); setLoading(false); return; }
        const qs = new URLSearchParams({ limit: String(limit) });
        if (merchantId) qs.set('merchantId', merchantId); else qs.set('email', email);
        const res = await fetch(`/api/public/products?${qs.toString()}`, { cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || `${res.status} ${res.statusText}`);
        setProducts(Array.isArray(json.products) ? json.products : []);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load products');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [ids.join(','), limit]);

  React.useEffect(() => { void fetchProducts(); }, [fetchProducts]);

  // Re-run when merchant changes (modal writes + broadcast)
  React.useEffect(() => {
    const rerun = () => { void fetchProducts(); };
    window.addEventListener('qs:ecom:merchant-selected', rerun as EventListener);
    window.addEventListener('qs:template:apply-patch', rerun as EventListener);
    window.addEventListener('qs:ecom:merchant-storage-updated', rerun as EventListener);
    return () => {
      window.removeEventListener('qs:ecom:merchant-selected', rerun as EventListener);
      window.removeEventListener('qs:template:apply-patch', rerun as EventListener);
      window.removeEventListener('qs:ecom:merchant-storage-updated', rerun as EventListener);
    };
  }, [fetchProducts]);

  if (error) return <div className="text-sm text-red-500">{error}</div>;
  if (loading && products.length === 0) return <div className="text-sm text-muted-foreground">Loading products…</div>;
  if (products.length === 0) return <div className="text-sm text-muted-foreground">No products found for this merchant.</div>;

  return (
    <section className="py-8">
      {content.title && <h2 className="text-2xl font-bold mb-4">{content.title}</h2>}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {products.map((p) => {
          const href = productHref(p);
          return (
            <article key={p.id} className="rounded-lg border p-3">
              <Link href={href} className="block">
                <div className="aspect-[4/3] mb-3 overflow-hidden rounded">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt={p.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-muted" />
                  )}
                </div>
                <h3 className="font-medium">{p.title}</h3>
              </Link>
              <div className="mt-1 text-sm text-muted-foreground">
                ${(p.price_cents / 100).toFixed(2)}{p.product_type ? ` • ${p.product_type}` : ''}
              </div>
              <div className="mt-3">
                <button
                  type="button"
                  className="inline-flex items-center rounded-md border px-3 py-1 text-sm hover:bg-accent"
                  onClick={() => emitAddToCart({ id: p.id, qty: 1 })}
                >
                  Add to Cart
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
