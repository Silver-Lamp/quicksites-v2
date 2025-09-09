// components/admin/tools/cards/commerce.tsx
'use client';

import * as React from 'react';
import { ToolCard, Field, HelpRow, PrimaryButton, SecondaryButton } from '@/components/admin/tools/ui';
import { postJSON, isEmail, parseUsdToCents } from '@/components/admin/tools/utils';

/** Minimal preview for merchant */
function MerchantProfilePreview({
  email,
  name,
  merchant,
  compliance,
}: {
  email?: string;
  name?: string | null;
  merchant?: { id: string; name: string | null } | null;
  compliance?: {
    overall?: string | null;
    profile?: { state?: string | null; county?: string | null; operation_type?: string | null; country?: string | null } | null;
    snapshot?: { overall?: string | null; updated_at?: string | null; missing?: string[] | null; expiring?: string[] | null } | null;
  } | null;
}) {
  const display = merchant?.name || name || (email ? email.split('@')[0] : 'Merchant');
  const overall = (compliance?.snapshot?.overall || compliance?.overall || 'none') as string;
  const badge =
    overall === 'ok' ? 'OK' :
    overall === 'pending' ? 'Pending' :
    overall === 'none' ? 'None' : overall;

  const jur = compliance?.profile
    ? `US-${(compliance.profile.state ?? '').toUpperCase()}${compliance.profile.county ? ` / ${compliance.profile.county}` : ''}` +
      (compliance.profile.operation_type ? ` (${compliance.profile.operation_type})` : '')
    : null;

  const updated = compliance?.snapshot?.updated_at
    ? new Date(compliance.snapshot.updated_at).toLocaleDateString()
    : null;

  const missing = compliance?.snapshot?.missing ?? [];

  return (
    <div className="rounded-2xl border border-border/50 bg-background shadow-sm overflow-hidden">
      <div className="h-16 w-full bg-muted grid place-items-center">
        <span className="text-xs text-muted-foreground">Merchant preview</span>
      </div>
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="font-semibold leading-tight">{display}</h4>
            <p className="text-xs text-muted-foreground">{email}</p>
          </div>
          <span className="text-[10px] rounded-full px-2 py-0.5 border">Merchant</span>
        </div>

        {jur && (
          <p className="text-xs text-muted-foreground">
            Jurisdiction: <span className="font-medium">{jur}</span>
          </p>
        )}

        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-md border px-2 py-0.5">Compliance: {badge}</span>
          {updated && <span className="text-muted-foreground">Updated {updated}</span>}
        </div>

        {!!missing?.length && (
          <div className="text-xs">
            <div className="text-muted-foreground">Missing:</div>
            <ul className="list-disc pl-5">
              {missing.slice(0, 3).map((m, i) => <li key={i}>{m}</li>)}
            </ul>
            {missing.length > 3 && (
              <div className="text-muted-foreground">…and {missing.length - 3} more</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Generic product preview */
function ProductCardPreview({
  title,
  priceCents,
  qty,
  imageUrl,
}: {
  title?: string;
  priceCents?: number | null;
  qty?: number | null;
  imageUrl?: string;
}) {
  const price = typeof priceCents === 'number' ? `$${(priceCents / 100).toFixed(2)}` : '—';
  return (
    <div className="rounded-2xl border border-border/50 bg-background shadow-sm overflow-hidden">
      <div className="h-40 w-full bg-muted flex items-center justify-center overflow-hidden">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs text-muted-foreground">Image preview</span>
        )}
      </div>
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <h4 className="font-semibold leading-tight">{title?.trim() || 'Product title'}</h4>
          <span className="shrink-0 rounded-full border px-2 py-0.5 text-xs">{price}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Quantity available: {Number.isFinite(qty as any) ? qty : '—'}
        </p>
        <div className="flex gap-2 pt-1">
          <div className="h-8 flex-1 rounded-md border text-xs grid place-items-center">Add to cart</div>
          <div className="h-8 w-16 rounded-md border text-xs grid place-items-center">Info</div>
        </div>
      </div>
    </div>
  );
}

/* A) Promote to merchant */
export function PromoteMerchantCard({
  run, isBusy, emailState, setEmailState,
}: {
  run:(label:string, fn:()=>Promise<any>)=>void;
  isBusy:boolean;
  emailState:string;
  setEmailState:(v:string)=>void;
}) {
  type Row = {
    id: string;
    email: string;
    name: string | null;
    is_merchant: boolean;
    merchant: { id: string; name: string | null } | null;
    compliance: {
      overall?: string | null;
      profile?: { state?: string | null; county?: string | null; operation_type?: string | null; country?: string | null } | null;
      snapshot?: { overall?: string | null; updated_at?: string | null; missing?: string[] | null; expiring?: string[] | null } | null;
    } | null;
  };

  const [email, setEmail] = React.useState(emailState || 'merchant.demo@example.com');
  const [displayName, setDisplayName] = React.useState('Demo Merchant');
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(false);
  const [selected, setSelected] = React.useState<Row | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [launching, setLaunching] = React.useState(false);

  React.useEffect(() => setEmailState(email), [email, setEmailState]);
  const valid = isEmail(email) && !!displayName.trim();

  const load = React.useCallback(async (reset=false) => {
    setLoading(true); setError(null);
    try {
      const p = reset ? 1 : page;
      const res = await fetch(`/api/admin/users/list?page=${p}&perPage=50&q=${encodeURIComponent(query)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load users');
      setHasMore(Boolean(json.hasMore));
      setPage(p + 1);
      setRows((prev) => reset ? json.users : [...prev, ...json.users]);
    } catch (e:any) {
      setError(e.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  React.useEffect(() => { load(true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  React.useEffect(() => {
    const t = setTimeout(() => load(true), 300);
    return () => clearTimeout(t);
  }, [query, load]);

  const handlePick = (r: Row) => {
    setSelected(r);
    setEmail(r.email);
    setDisplayName(r.merchant?.name || r.name || `Merchant ${r.email.split('@')[0]}`);
  };

  const handlePromote = () =>
    run('promote-merchant', () => {
      const normalizedEmail = email.trim().toLowerCase();
      return postJSON('/api/admin/merchants/promote', {
        email: normalizedEmail,
        name: displayName.trim(),
      });
    });

  async function openMerchantDashboard() {
    const targetEmail = (selected?.email || email).trim().toLowerCase();
    if (!targetEmail) return;
    setLaunching(true);
    try {
      const res = await fetch('/api/admin/merchants/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, next: '/merchant/dashboard' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create link');
      window.open(json.url, '_blank', 'noopener,noreferrer');
    } catch (e:any) {
      alert(e.message || 'Could not open dashboard');
    } finally {
      setLaunching(false);
    }
  }

  return (
    <ToolCard title="Promote to merchant" subtitle="Upgrades an existing user to a Merchant (idempotent).">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              id="pm-email" label="User email" value={email} onChange={setEmail}
              placeholder="user’s login email" autoComplete="email" required
              validate={(v)=> (v && isEmail(v)? null : 'Enter a valid email')}
              example="merchant.demo@example.com"
            />
            <Field
              id="pm-name" label="Merchant display name" value={displayName} onChange={setDisplayName}
              placeholder="shown on the storefront" required example="Demo Merchant"
            />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <PrimaryButton busy={isBusy} disabled={!valid || isBusy} onClick={handlePromote}>
              Promote to merchant
            </PrimaryButton>
            <SecondaryButton onClick={() => { setEmail('merchant.demo@example.com'); setDisplayName('Demo Merchant'); }}>
              Fill demo values
            </SecondaryButton>
          </div>
          <div className="mt-4">
            <HelpRow items={[
              'Safe to run multiple times.',
              'After promotion, you can create products.',
            ]}/>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-border/50 bg-background p-3">
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                placeholder="Search users by email or name…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={query}
                onChange={(e)=> { setQuery(e.target.value); setPage(1); }}
              />
              <button onClick={()=> load(true)} className="shrink-0 h-9 px-3 rounded-md border text-sm">Search</button>
            </div>
            <div className="max-h-64 overflow-auto divide-y">
              {rows.map((r) => (
                <button
                  key={r.id}
                  onClick={()=> handlePick(r)}
                  className={`w-full text-left px-2 py-2 hover:bg-accent hover:text-accent-foreground transition
                    ${selected?.id === r.id ? 'bg-accent/70' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium">{r.name || r.email.split('@')[0]}</div>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] rounded-full px-2 py-0.5 border ${r.is_merchant ? '' : 'opacity-70'}`}>
                        {r.is_merchant ? 'Merchant' : 'User'}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
              {!loading && rows.length === 0 && (
                <div className="px-2 py-6 text-sm text-muted-foreground text-center">No users match.</div>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {error ? <span className="text-red-500">{error}</span> : loading ? 'Loading…' : `Showing ${rows.length} user(s)`}
              </div>
              {hasMore && (
                <button className="h-8 px-3 rounded-md border text-xs" onClick={()=> load(false)} disabled={loading}>
                  Load more
                </button>
              )}
            </div>
          </div>

          <MerchantProfilePreview
            email={selected?.email || email}
            name={selected?.name || null}
            merchant={selected?.merchant ?? null}
            compliance={selected?.compliance ?? null}
          />
          <p className="text-[11px] text-muted-foreground">Selecting a user fills the form.</p>

          <div className="flex items-center gap-2">
            <button
              onClick={openMerchantDashboard}
              disabled={launching || (!selected && !email)}
              className="h-9 rounded-md border px-3 text-sm"
              title="Open the merchant dashboard in a new tab (impersonate)"
            >
              {launching ? 'Opening…' : 'Open Merchant Dashboard'}
            </button>
          </div>
        </div>
      </div>
    </ToolCard>
  );
}

/* B) Create product */
export function CreateProductCard({
  run, isBusy, emailState, setEmailState,
}: {
  run:(label:string, fn:()=>Promise<any>)=>void;
  isBusy:boolean;
  emailState:string;
  setEmailState:(v:string)=>void;
}) {
  const [email, setEmail] = React.useState(emailState || 'merchant.demo@example.com');
  const [title, setTitle] = React.useState('Sample Product');
  const [priceUsd, setPriceUsd] = React.useState('19.00');
  const [qty, setQty] = React.useState('25');
  const [imageUrl, setImageUrl] = React.useState('');
  const [productType, setProductType] = React.useState<'meal' | 'physical' | 'digital' | 'service'>('meal');
  const [launching, setLaunching] = React.useState(false);

  React.useEffect(() => setEmailState(email), [email, setEmailState]);

  const cents = parseUsdToCents(priceUsd);
  const qtyNum = Number(qty);
  const valid = isEmail(email) && !!title.trim() && cents !== null && qtyNum >= 1;

  const handleCreate = () =>
    run('create-product', () => {
      const normalizedEmail = email.trim().toLowerCase();
      return postJSON('/api/admin/products', {
        email: normalizedEmail,         // merchant user email → backend resolves merchant_id
        title: title.trim(),
        price_cents: cents!,
        qty_available: qtyNum,
        image_url: imageUrl || null,
        product_type: productType,      // ← generalized
      });
    });

  async function openMerchantDashboard() {
    const targetEmail = email.trim().toLowerCase();
    if (!targetEmail) return;
    setLaunching(true);
    try {
      const res = await fetch('/api/admin/merchants/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // If you prefer to land on a products view, change next to '/merchant/products'
        body: JSON.stringify({ email: targetEmail, next: '/merchant/dashboard' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create link');
      window.open(json.url, '_blank', 'noopener,noreferrer');
    } catch (e:any) {
      alert(e.message || 'Could not open dashboard');
    } finally {
      setLaunching(false);
    }
  }

  return (
    <ToolCard title="Create product" subtitle="Creates a product for the merchant linked to the given user email.">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field
              id="cp-email" label="Merchant user email" value={email} onChange={setEmail}
              autoComplete="email" required
              validate={(v)=> (v && isEmail(v)? null : 'Enter a valid email')}
              example="merchant.demo@example.com"
            />
            <Field
              id="cp-title" label="Product title" value={title} onChange={setTitle}
              required example="Citrus Chicken (Meal) or Branded T-Shirt"
            />
            <Field
              id="cp-price" label="Price (USD)" value={priceUsd} onChange={setPriceUsd}
              placeholder="e.g. 19 or 19.99" required
              validate={(v)=> (parseUsdToCents(v) !== null ? null : 'Enter a positive number')}
              help={cents !== null ? `Will send: ${cents}¢` : undefined}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field
              id="cp-qty" label="Quantity available" value={qty} onChange={setQty}
              placeholder="e.g. 25" required
              validate={(v)=> (Number(v) >= 1 ? null : 'Must be at least 1')}
              example="25"
            />
            <Field
              id="cp-img" label="Image URL (optional)" value={imageUrl}
              onChange={setImageUrl} placeholder="https://…" help="Optional (uploads later)."
            />
            <div className="space-y-1">
              <label className="text-sm font-medium">Product type</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={productType}
                onChange={(e)=> setProductType(e.target.value as any)}
              >
                <option value="meal">meal</option>
                <option value="physical">physical</option>
                <option value="digital">digital</option>
                <option value="service">service</option>
              </select>
              <p className="text-xs text-muted-foreground">Use “meal” to match legacy storefronts.</p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <PrimaryButton busy={isBusy} disabled={!valid || isBusy} onClick={handleCreate}>
              Create product
            </PrimaryButton>
            <SecondaryButton onClick={() => {
              setEmail('merchant.demo@example.com'); setTitle('Sample Product');
              setPriceUsd('19.00'); setQty('25'); setImageUrl(''); setProductType('meal');
            }}>
              Fill demo values
            </SecondaryButton>

            {/* Impersonate from this card too */}
            <button
              onClick={openMerchantDashboard}
              disabled={launching || !isEmail(email)}
              className="h-9 rounded-md border px-3 text-sm"
              title="Open the merchant dashboard in a new tab (impersonate)"
            >
              {launching ? 'Opening…' : 'Open Merchant Dashboard'}
            </button>
          </div>

          <div className="mt-4">
            <HelpRow items={[
              'Price accepts “19” or “19.99”; converted to cents.',
              'Quantity must be at least 1.',
              'Select a product type to control downstream rendering.',
              'Use “Open Merchant Dashboard” to quickly verify on their portal.',
            ]}/>
          </div>
        </div>

        <div className="md:pt-1">
          <ProductCardPreview
            title={title}
            priceCents={cents}
            qty={Number(qty)}
            imageUrl={imageUrl}
          />
          <p className="mt-2 text-xs text-muted-foreground">Preview only — storefront styling may vary.</p>
        </div>
      </div>
    </ToolCard>
  );
}
