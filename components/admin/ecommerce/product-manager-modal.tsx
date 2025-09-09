'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { parseUsdToCents, isEmail } from '@/components/admin/tools/utils';

/* ---------- tiny hook to detect server AI config ---------- */
function useAiReady() {
  const [aiReady, setAiReady] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await fetch('/api/ai/ready', { cache: 'no-store' });
        const j = await r.json();
        if (mounted) setAiReady(!!j.ok);
      } catch {
        if (mounted) setAiReady(true);
      }
    })();
    return () => { mounted = false; };
  }, []);
  return aiReady; // null = checking, true = ready, false = not configured
}

/* ---------- event payload + helpers ---------- */
type MerchantSelectedPayload = {
  merchantId?: string | null;
  email?: string | null;
  name?: string | null;
  industry?: string | null;
  label?: string | null;
};

function merchantPrettyLabel(m?: { display_name?: string|null; name?: string|null; email?: string|null; industry?: string|null }) {
  if (!m) return null;
  const base = m.display_name || m.name || m.email || 'Merchant';
  const parts = [base];
  if (m.industry) parts.push(m.industry);
  if (m.email) parts.push(m.email);
  return parts.filter(Boolean).join(' • ');
}

function emitMerchantSelected(detail: MerchantSelectedPayload) {
  try { window.dispatchEvent(new CustomEvent('qs:ecom:merchant-selected', { detail })); } catch {}
}
function emitProductsUpdated(detail: MerchantSelectedPayload) {
  try { window.dispatchEvent(new CustomEvent('qs:ecom:products-updated', { detail })); } catch {}
}

/* ---------- template/global persistence helpers ---------- */
function getTpl(): any {
  try {
    return (window as any).__QS_TPL_REF__?.current ?? (window as any).__QS_TEMPLATE__ ?? null;
  } catch { return null; }
}
function patchTplData(nextData: any) {
  try {
    window.dispatchEvent(new CustomEvent('qs:template:apply-patch', { detail: { data: nextData, __transient: false } }));
    setTimeout(() => { try { window.dispatchEvent(new Event('qs:toolbar:save-now')); } catch {} }, 50);
  } catch {}
}

/** Snapshot first-class writer (works even if server strips keys) */
function setMerchantSnapshot({ email, merchantId, label }:
  { email?: string | null; merchantId?: string | null; label?: string | null }) {
  const snap = { email: email ?? null, merchantId: merchantId ?? null, label: label ?? null };
  try { (window as any).__QS_ECOM__ = snap; } catch {}
  try {
    if (snap.email) localStorage.setItem('merchant_email', snap.email); else localStorage.removeItem('merchant_email');
    if (snap.merchantId) localStorage.setItem('qs_merchant_id', snap.merchantId); else localStorage.removeItem('qs_merchant_id');
    if (snap.label) localStorage.setItem('qs_merchant_label', snap.label);
  } catch {}
  try { window.dispatchEvent(new CustomEvent('qs:ecom:merchant-storage-updated')); } catch {}
}

/** Best-effort template patch (snapshot is the source of truth for UI) */
function writeMerchantToTemplate({
  email, merchantId, label,
}: { email?: string | null; merchantId?: string | null; label?: string | null }) {
  setMerchantSnapshot({ email, merchantId, label }); // ensure UI sees it immediately

  const tpl = getTpl();
  if (!tpl) return;

  const prevData = tpl.data ?? {};
  const prevMeta = prevData.meta ?? {};
  const prevEcomMeta = prevMeta.ecom ?? prevMeta.ecommerce ?? {};
  const prevEcommerce = prevData.ecommerce ?? {};

  const ecom = { ...prevEcomMeta, merchant_email: email ?? null, merchant_id: merchantId ?? null };
  const ecommerce = { ...prevEcommerce, merchant_email: email ?? null, merchant_id: merchantId ?? null };

  const nextData = {
    ...prevData,
    meta: { ...prevMeta, ecom },
    ecommerce,
    merchant_email: email ?? null, // legacy fallback
  };

  patchTplData(nextData);
}

/* ---------- read any previously saved merchant from template ---------- */
function readMerchantFromTemplate() {
  try {
    const tpl = getTpl();
    const data = tpl?.data ?? {};
    const metaE = data?.meta?.ecom ?? data?.meta?.ecommerce ?? {};
    const email =
      metaE?.merchant_email ??
      data?.ecommerce?.merchant_email ??
      data?.merchant_email ??
      '';
    const merchantId = metaE?.merchant_id ?? data?.ecommerce?.merchant_id ?? '';
    return { email: String(email || ''), merchantId: String(merchantId || '') };
  } catch { return { email: '', merchantId: '' }; }
}

type Product = {
  id: string;
  title: string;
  price_cents: number;
  qty_available: number;
  image_url?: string | null;
  product_type?: 'meal' | 'physical' | 'digital' | 'service';
};

type MerchantLite = {
  id: string;
  email?: string | null;
  display_name?: string | null;
  name?: string | null;
  industry?: string | null;
};

export function ProductManagerModal({
  open,
  onOpenChange,
  merchantEmail,
  onMerchantEmailChange,
  onInsertGrid,
  templateId,
  industryHint,
  cityHint,
  stateHint,
  currency,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  merchantEmail: string;
  onMerchantEmailChange: (v: string) => void;
  onInsertGrid: (ids: string[], title?: string) => void;
  templateId?: string | null;
  industryHint?: string | null;
  cityHint?: string | null;
  stateHint?: string | null;
  currency?: string | null;
}) {
  const [loading, setLoading] = React.useState(false);
  const [list, setList] = React.useState<Product[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Record<string, boolean>>({});
  const [gridTitle, setGridTitle] = React.useState('Featured Products');

  // create form
  const [title, setTitle] = React.useState('Sample Product');
  const [priceUsd, setPriceUsd] = React.useState('19.00');
  const [qty, setQty] = React.useState('25');
  const [imageUrl, setImageUrl] = React.useState('');
  const [type, setType] =
    React.useState<'meal' | 'physical' | 'digital' | 'service'>('service');

  // AI Assist state
  const [aiHint, setAiHint] = React.useState('');
  const [aiBusy, setAiBusy] = React.useState(false);
  const [aiError, setAiError] = React.useState<string | null>(null);
  const aiReady = useAiReady();

  // merchants dropdown state
  const [merchants, setMerchants] = React.useState<MerchantLite[]>([]);
  const [merchantsLoading, setMerchantsLoading] = React.useState(false);
  const [merchantsError, setMerchantsError] = React.useState<string | null>(null);
  const [useCustomEmail, setUseCustomEmail] = React.useState(false);
  const [merchantId, setMerchantId] = React.useState<string>(''); // when no email is available

  const [mode, setMode] = React.useState<'profile' | 'email-only' | 'invalid-email' | undefined>(undefined);
  const [ensuring, setEnsuring] = React.useState(false);
  const [ensureMsg, setEnsureMsg] = React.useState<string | null>(null);

  /* ---------- derived values (declare ONCE) ---------- */
  const cents = parseUsdToCents(priceUsd);
  const qtyNum = Number(qty);
  const validRecipient = isEmail(merchantEmail) || !!merchantId;
  const validCreate = validRecipient && !!title.trim() && cents !== null && qtyNum >= 1;
  const canSuggest = (aiReady !== false) && validRecipient && !aiBusy;

  // hydrate from template meta on open if nothing chosen yet
  React.useEffect(() => {
    if (!open) return;
    if (!merchantEmail && !merchantId) {
      const fromTpl = readMerchantFromTemplate();
      if (fromTpl.merchantId) setMerchantId(fromTpl.merchantId);
      if (fromTpl.email) onMerchantEmailChange(fromTpl.email);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function persistCurrentMerchant(label?: string | null) {
    const email = isEmail(merchantEmail) ? merchantEmail : null;
    const id = merchantId || null;
    writeMerchantToTemplate({ email, merchantId: id, label: label ?? (email || null) });
    emitMerchantSelected({ email, merchantId: id, label: label ?? (email || null) });
  }

  // ---------- load merchants (admin first, public fallback) ----------
  function getSiteContext() {
    try {
      const site = (window as any).__QS_SITE__ ?? null;
      if (site?.id) return { siteId: site.id as string, slug: site.slug as string | undefined };
      const tpl = getTpl();
      const siteId = tpl?.site_id || tpl?.data?.site_id || null;
      const slug = tpl?.slug || tpl?.data?.slug || null;
      return { siteId: siteId || null, slug: slug || null };
    } catch { return { siteId: null, slug: null }; }
  }

  const loadMerchants = React.useCallback(async () => {
    setMerchantsLoading(true);
    setMerchantsError(null);
    try {
      let res = await fetch('/api/admin/merchants', { cache: 'no-store' });
      if (res.status === 404) {
        const { siteId, slug } = getSiteContext();
        const qs = siteId ? `?siteId=${encodeURIComponent(siteId)}` : slug ? `?slug=${encodeURIComponent(slug)}` : '';
        res = await fetch(`/api/public/merchants${qs}`, { cache: 'no-store' });
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `${res.status} ${res.statusText}`);
      const list: MerchantLite[] = Array.isArray(json.merchants) ? json.merchants : [];
      setMerchants(list);

      // preselect if nothing chosen
      if (!useCustomEmail && !merchantEmail && !merchantId && list.length > 0) {
        const first = list[0];
        if (first?.email) {
          onMerchantEmailChange(first.email);
          const label = merchantPrettyLabel(first);
          writeMerchantToTemplate({ email: first.email, merchantId: null, label });
          emitMerchantSelected({ email: first.email, merchantId: null, label });
        } else {
          setMerchantId(first.id);
          const label = merchantPrettyLabel(first);
          writeMerchantToTemplate({ email: null, merchantId: first.id, label });
          emitMerchantSelected({ email: null, merchantId: first.id, label });
        }
      }
    } catch (e: any) {
      setMerchants([]);
      setMerchantsError(e?.message || 'Failed to load merchants');
    } finally {
      setMerchantsLoading(false);
    }
  }, [merchantEmail, merchantId, onMerchantEmailChange, useCustomEmail]);

  React.useEffect(() => { if (open) void loadMerchants(); }, [open, loadMerchants]);

  // ---------- load products for selected merchant ----------
  const load = React.useCallback(async () => {
    if (!validRecipient) { setMode('invalid-email'); setList([]); return; }
    setLoading(true); setError(null); setEnsureMsg(null);
    try {
      const q = isEmail(merchantEmail)
        ? `email=${encodeURIComponent(merchantEmail)}`
        : `merchantId=${encodeURIComponent(merchantId)}`;
      const res = await fetch(`/api/admin/products?${q}`, { cache: 'no-store' });
      let json: any = null;
      try { json = await res.json(); } catch {}
      if (!res.ok) throw new Error(json?.error || `${res.status} ${res.statusText}`);
      setMode(json?.mode as any);
      setList(Array.isArray(json?.products) ? json.products : []);

      // Persist & broadcast after successful load
      persistCurrentMerchant(null);
    } catch (e: any) {
      setError(e.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [merchantEmail, merchantId, validRecipient]);

  React.useEffect(() => { if (open) void load(); }, [open, load]);

  const toggle = (id: string) => setSelected(s => ({ ...s, [id]: !s[id] }));

  const createProduct = async () => {
    if (!validCreate) return;
    setLoading(true); setError(null);
    try {
      const payload: any = {
        title: title.trim(),
        price_cents: cents!,
        qty_available: qtyNum,
        image_url: imageUrl || null,
        product_type: type,
      };
      if (isEmail(merchantEmail)) payload.email = merchantEmail.trim().toLowerCase();
      else payload.merchantId = merchantId;

      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create product');

      setTitle('Sample Product');
      setPriceUsd('19.00');
      setQty('25');
      setImageUrl('');

      await load();

      emitProductsUpdated({
        merchantId: isEmail(merchantEmail) ? null : merchantId || null,
        email: isEmail(merchantEmail) ? merchantEmail : null,
        label: isEmail(merchantEmail) ? merchantEmail : null,
      });
    } catch (e:any) {
      setError(e.message || 'Failed to create product');
    } finally {
      setLoading(false);
    }
  };

  async function ensureMerchant() {
    if (!isEmail(merchantEmail)) return;
    setEnsuring(true); setEnsureMsg(null);
    try {
      const r = await fetch('/api/admin/merchants/ensure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: merchantEmail }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || 'Failed to create merchant');
      setEnsureMsg(j.created ? 'Merchant created.' : 'Merchant already existed.');

      await load();
      await loadMerchants();

      // persist + broadcast
      writeMerchantToTemplate({ email: merchantEmail, merchantId: null, label: merchantEmail });
      emitMerchantSelected({ email: merchantEmail, merchantId: null, label: merchantEmail });
    } catch (e: any) {
      setEnsureMsg(e.message || 'Failed to create merchant');
    } finally {
      setEnsuring(false);
    }
  }

  // selected value for <select>
  const selectedValue =
    useCustomEmail
      ? 'custom'
      : (merchantId ||
         (merchants.find(m => (m.email || '').toLowerCase() === (merchantEmail || '').toLowerCase())?.id ?? ''));
         const suggestWithAI = React.useCallback(async () => {
            if (!validRecipient) { setAiError('Select a merchant or enter a valid email first.'); return; }
            setAiBusy(true); setAiError(null);
            try {
              const payload: any = {
                hint: aiHint || null,
                product_type: type,
                template_id: templateId ?? undefined,
                industry: industryHint ?? undefined,
                city: cityHint ?? undefined,
                state: stateHint ?? undefined,
                currency: currency ?? undefined,
                ...(isEmail(merchantEmail)
                  ? { email: merchantEmail.trim().toLowerCase() }
                  : { merchantId }),
              };
              const res = await fetch('/api/admin/products/suggest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                cache: 'no-store',
                body: JSON.stringify(payload),
              });
              const json = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(json.error || 'Suggestion failed');
          
              const t = String(json.title || '').trim();
              const pCents = Number(json.price_cents ?? 0);
              const q = Number(json.qty_available ?? 25);
              const img = typeof json.image_url === 'string' ? json.image_url : '';
              const pType = (json.product_type as typeof type) || type;
          
              setTitle(t || (pType === 'service' ? 'New Service' : 'New Product'));
              setPriceUsd(pCents > 0 ? (pCents / 100).toFixed(2) : '19.00');
              setQty(Number.isFinite(q) && q > 0 ? String(q) : '25');
              setImageUrl(img);
              setType(pType);
            } catch (e: any) {
              setAiError(e.message || 'Suggestion failed');
            } finally {
              setAiBusy(false);
            }
          }, [validRecipient, aiHint, type, templateId, industryHint, cityHint, stateHint, currency, merchantEmail, merchantId]);
          
  return (
    <div className={`fixed inset-0 z-50 ${open ? '' : 'hidden'} bg-black/40 backdrop-blur-sm flex items-center justify-center p-4`}>
      <div className="bg-background text-foreground rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-border">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">Manage products & services</h2>
          <button onClick={() => onOpenChange(false)} className="text-sm text-muted-foreground hover:text-foreground">✕</button>
        </div>

        <div className="grid md:grid-cols-2 gap-6 p-4">
          {/* Left: list + select */}
          <div className="space-y-3">
            <div className="grid gap-2">
              <Label>Merchant</Label>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={selectedValue}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === 'custom') {
                      setUseCustomEmail(true);
                      setMerchantId('');
                      if (merchantEmail) {
                        const label = merchantEmail;
                        writeMerchantToTemplate({ email: merchantEmail, merchantId: null, label });
                        emitMerchantSelected({ merchantId: null, email: merchantEmail, label });
                      }
                    } else {
                      setUseCustomEmail(false);
                      setMerchantId(v);
                      const m = merchants.find(mm => mm.id === v);
                      const nextEmail = m?.email || '';
                      onMerchantEmailChange(nextEmail);
                      const label = merchantPrettyLabel(m);
                      writeMerchantToTemplate({ email: nextEmail || null, merchantId: v, label });
                      emitMerchantSelected({ merchantId: v, email: nextEmail || null, label });
                    }
                    setEnsureMsg(null);
                  }}
                >
                  <option value="" disabled>
                    {merchantsLoading ? 'Loading merchants…' : 'Choose a merchant'}
                  </option>

                  {merchants
                    .slice()
                    .sort((a, b) => {
                      const an = (a.display_name || a.name || a.email || '').toLowerCase();
                      const bn = (b.display_name || b.name || b.email || '').toLowerCase();
                      if (an !== bn) return an.localeCompare(bn);
                      const ai = (a.industry || '').toLowerCase();
                      const bi = (b.industry || '').toLowerCase();
                      return ai.localeCompare(bi);
                    })
                    .map((m) => {
                      const labelBase = m.display_name || m.name || m.email || 'Merchant';
                      const parts = [labelBase];
                      if (m.industry) parts.push(m.industry);
                      if (m.email) parts.push(m.email);
                      return (
                        <option key={m.id} value={m.id}>
                          {parts.join(' • ')}
                        </option>
                      );
                    })}

                  <option value="custom">Custom email…</option>
                </select>

                {useCustomEmail && (
                  <Input
                    value={merchantEmail}
                    onChange={(e) => onMerchantEmailChange(e.target.value)}
                    onBlur={() => {
                      if (merchantEmail) {
                        const label = merchantEmail;
                        writeMerchantToTemplate({ email: merchantEmail || null, merchantId: null, label });
                        emitMerchantSelected({ email: merchantEmail || null, merchantId: null, label });
                      }
                    }}
                    placeholder="merchant.demo@example.com"
                    className="max-w-md"
                  />
                )}
              </div>

              {useCustomEmail && isEmail(merchantEmail) && (
                <div className="flex items-center justify-between text-sm">
                  {mode === 'email-only' ? (
                    <>
                      <div className="text-red-500">No merchant linked for this email.</div>
                      <Button size="sm" variant="outline" onClick={ensureMerchant} disabled={ensuring}>
                        {ensuring ? 'Creating…' : 'Create merchant'}
                      </Button>
                    </>
                  ) : (
                    <div className="text-muted-foreground">Email is valid.</div>
                  )}
                </div>
              )}
              {ensureMsg && <div className="text-xs mt-1 text-muted-foreground">{ensureMsg}</div>}
              {merchantsError && <div className="text-xs mt-1 text-red-500">{merchantsError}</div>}
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {error ? <span className="text-red-500">{error}</span> : loading ? 'Loading…' : `${list.length} product(s)`}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={load}
                disabled={loading || !validRecipient}
              >
                Refresh
              </Button>
            </div>

            <div className="rounded-lg border divide-y max-h-72 overflow-auto">
              {list.map(p => (
                <label key={p.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent/50">
                  <input
                    type="checkbox"
                    className="accent-primary"
                    checked={!!selected[p.id]}
                    onChange={() => setSelected(s => ({ ...s, [p.id]: !s[p.id] }))}
                  />
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt="" className="h-8 w-8 rounded object-cover border" />
                  ) : <div className="h-8 w-8 rounded bg-muted" />}
                  <div className="flex-1">
                    <div className="text-sm font-medium">{p.title}</div>
                    <div className="text-xs text-muted-foreground">
                      ${(p.price_cents / 100).toFixed(2)} • {p.qty_available} in stock {p.product_type ? `• ${p.product_type}` : ''}
                    </div>
                  </div>
                </label>
              ))}
              {(!loading && list.length === 0) && (
                <div className="px-3 py-6 text-sm text-muted-foreground text-center">No products yet.</div>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="gridTitle">Grid title</Label>
              <Input id="gridTitle" value={gridTitle} onChange={(e) => setGridTitle(e.target.value)} />
            </div>
          </div>

          {/* Right: create + AI assist */}
          <div className="space-y-4">
            <div className="text-sm font-medium">Create product/service</div>

            {/* AI Assist */}
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">AI Assist</div>
                <div className="text-xs text-muted-foreground">
                  {aiReady === null ? 'Checking…' : aiReady === false ? 'AI not configured' : 'Ready'}
                </div>
              </div>
              <Label htmlFor="ai-hint" className="text-xs">Hint (optional)</Label>
              <textarea
                id="ai-hint"
                className="w-full min-h-[68px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="e.g. 60-minute roadside battery jump service, flat fee"
                value={aiHint}
                onChange={(e) => setAiHint(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1">
                  <Label className="text-xs">Type</Label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={type}
                    onChange={(e)=> setType(e.target.value as any)}
                  >
                    <option value="service">service</option>
                    <option value="physical">physical</option>
                    <option value="digital">digital</option>
                    <option value="meal">meal (legacy)</option>
                  </select>
                </div>
                <div className="grid content-end">
                  <Button
                    onClick={suggestWithAI}
                    disabled={!canSuggest}
                    title={
                      aiReady === false
                        ? 'AI not configured'
                        : (!validRecipient ? 'Pick a merchant or enter a valid email' : '')
                    }
                  >
                    {aiBusy ? 'Suggesting…' : 'Suggest with AI'}
                  </Button>
                </div>
              </div>
              {aiError && <div className="text-xs text-red-500">{aiError}</div>}
              <p className="text-[11px] text-muted-foreground">
                Fills the form below with a suggested title, price, quantity, and optional image URL.
              </p>
            </div>

            {/* Create form */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <Label>Price (USD)</Label>
                <Input value={priceUsd} onChange={(e) => setPriceUsd(e.target.value)} placeholder="19 or 19.99" />
              </div>
              <div>
                <Label>Quantity</Label>
                <Input value={qty} onChange={(e) => setQty(e.target.value)} placeholder="25" />
              </div>
              <div className="col-span-2">
                <Label>Image URL (optional)</Label>
                <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
              </div>
              <div className="col-span-2">
                <Label>Type</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={type}
                  onChange={(e)=> setType(e.target.value as any)}
                >
                  <option value="service">service</option>
                  <option value="physical">physical</option>
                  <option value="digital">digital</option>
                  <option value="meal">meal (legacy)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={createProduct} disabled={!validCreate || loading}>
                {loading ? 'Saving…' : 'Create'}
              </Button>
              <Button variant="secondary" onClick={() => {
                setTitle('Sample Product'); setPriceUsd('19.00'); setQty('25'); setImageUrl(''); setType('service');
              }}>
                Reset form
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Creates the item for the selected merchant (by email or merchant id).
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-border flex items-center justify-between">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
          <Button
            onClick={() => {
              const ids = Object.keys(selected).filter(k => selected[k]);
              onInsertGrid(ids, gridTitle || 'Featured Products'); // update current block
              try { window.dispatchEvent(new Event('qs:toolbar:save-now')); } catch {}
            }}
          >
            Save selection
          </Button>
        </div>
      </div>
    </div>
  );
}
