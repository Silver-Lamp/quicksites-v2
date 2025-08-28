// components/admin/tools/cards/basic.tsx
'use client';

import * as React from 'react';
import { ToolCard, Field, HelpRow, PrimaryButton, SecondaryButton } from '@/components/admin/tools/ui';
import { postJSON, isEmail, passwordIssues, parseUsdToCents, isState2 } from '@/components/admin/tools/utils';

function ChefProfilePreview({
  email,
  name,
  chef,
  merchant,
  compliance,
}: {
  email?: string;
  name?: string | null;
  chef?: {
    id: string;
    display_name: string | null;
    location: string | null;
    bio: string | null;
    profile_image_url: string | null;
  } | null;
  merchant?: { id: string; name: string | null } | null;
  compliance?: {
    overall?: string | null;
    profile?: { state?: string | null; county?: string | null; operation_type?: string | null; country?: string | null } | null;
    snapshot?: { overall?: string | null; updated_at?: string | null; missing?: string[] | null; expiring?: string[] | null } | null;
  } | null;
}) {
  const display = chef?.display_name || name || (email ? email.split('@')[0] : 'Chef');
  const overall = (compliance?.snapshot?.overall || compliance?.overall || 'none') as string;

  const badge =
    overall === 'ok' ? 'OK' :
    overall === 'pending' ? 'Pending' :
    overall === 'none' ? 'None' :
    overall;

  const jur =
    compliance?.profile
      ? `US-${(compliance.profile.state ?? '').toUpperCase()}${compliance.profile.county ? ` / ${compliance.profile.county}` : ''}` +
        (compliance.profile.operation_type ? ` (${compliance.profile.operation_type})` : '')
      : null;

  const updated = compliance?.snapshot?.updated_at
    ? new Date(compliance.snapshot.updated_at).toLocaleDateString()
    : null;

  const missing = compliance?.snapshot?.missing ?? [];

  return (
    <div className="rounded-2xl border border-border/50 bg-background shadow-sm overflow-hidden">
      <div className="h-32 w-full bg-muted flex items-center justify-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {chef?.profile_image_url ? (
          <img src={chef.profile_image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs text-muted-foreground">Chef photo</span>
        )}
      </div>
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="font-semibold leading-tight">{display}</h4>
            <p className="text-xs text-muted-foreground">{email}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`text-[10px] rounded-full px-2 py-0.5 border ${chef ? '' : 'opacity-70'}`}>
              {chef ? 'Chef' : 'User'}
            </span>
            {merchant?.id && (
              <span className="text-[10px] rounded-full px-2 py-0.5 border">Merchant</span>
            )}
          </div>
        </div>

        {jur && (
          <p className="text-xs text-muted-foreground">Jurisdiction: <span className="font-medium">{jur}</span></p>
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

function MealCardPreview({
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
  const price = typeof priceCents === 'number'
    ? `$${(priceCents / 100).toFixed(2)}`
    : '—';

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
          <h4 className="font-semibold leading-tight">
            {title?.trim() || 'Meal title'}
          </h4>
          <span className="shrink-0 rounded-full border px-2 py-0.5 text-xs">
            {price}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Quantity available: {Number.isFinite(qty as any) ? qty : '—'}
        </p>
        <div className="flex gap-2 pt-1">
          <div className="h-8 flex-1 rounded-md border text-xs grid place-items-center">
            Add to cart
          </div>
          <div className="h-8 w-16 rounded-md border text-xs grid place-items-center">
            Info
          </div>
        </div>
      </div>
    </div>
  );
}

/* 1) Create user */
export function CreateUserCard({
  run, isBusy, emailState, setEmailState,
}: {
  run:(label:string, fn:()=>Promise<any>)=>void;
  isBusy:boolean;
  emailState:string;
  setEmailState:(v:string)=>void;
}) {
  const [email, setEmail] = React.useState(emailState || 'chef.demo@example.com');
  const [password, setPassword] = React.useState('StrongPass!1');
  const [name, setName] = React.useState('Demo Chef');

  React.useEffect(() => setEmailState(email), [email, setEmailState]);

  const emailErr = (v:string)=> (v && isEmail(v) ? null : 'Enter a valid email');
  const passErr  = (v:string)=> passwordIssues(v).length ? `Include ${passwordIssues(v).join(', ')}` : null;
  const valid    = !!name.trim() && isEmail(email) && passwordIssues(password).length === 0;

  const handleCreate = () =>
    run('create-user', () => {
      const normalizedEmail = email.trim().toLowerCase();
      const trimmedName = name.trim();
      return postJSON('/api/admin/users', { email: normalizedEmail, password, name: trimmedName });
    });

  return (
    <ToolCard title="1) Create new user" subtitle="Creates an auth user + basic profile. Then you can promote them to a Chef.">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field
          id="cu-email" label="Email" value={email} onChange={setEmail}
          placeholder="e.g. chef@demo.com" autoComplete="email" required validate={emailErr}
          example="chef.demo@example.com"
        />
        <Field
          id="cu-password" label="Password" value={password} onChange={setPassword}
          type="password" placeholder="At least 8 chars incl. a number"
          autoComplete="new-password" required validate={passErr} example="StrongPass!1"
        />
        <Field
          id="cu-name" label="Full name" value={name} onChange={setName}
          placeholder="Shown internally & sometimes to customers" required example="Demo Chef"
        />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <PrimaryButton busy={isBusy} disabled={!valid || isBusy} onClick={handleCreate}>
          Create user
        </PrimaryButton>
        <SecondaryButton onClick={() => { setEmail('chef.demo@example.com'); setPassword('StrongPass!1'); setName('Demo Chef'); }}>
          Fill demo values
        </SecondaryButton>
      </div>
      <div className="mt-4">
        <HelpRow items={[
          'Email must be unique.',
          'If the user exists, skip to “Promote to chef.”',
          'Clean up demo data later with the Nuke tool.',
        ]}/>
      </div>
    </ToolCard>
  );
}

/* 2) Promote to chef */
export function PromoteChefCard({
  run, isBusy, emailState, setEmailState,
}: {
  run:(label:string, fn:()=>Promise<any>)=>void;
  isBusy:boolean;
  emailState:string;
  setEmailState:(v:string)=>void;
}) {
  const [email, setEmail] = React.useState(emailState || 'chef.demo@example.com');
  const [displayName, setDisplayName] = React.useState('Chef Demo');
  const [launching, setLaunching] = React.useState(false);

  // user list
  type Row = {
    id: string;
    email: string;
    name: string | null;
    is_chef: boolean;
    is_merchant?: boolean;
    chef: {
      id: string; display_name: string | null; merchant_id: string | null;
      name: string | null; location: string | null; bio: string | null; profile_image_url: string | null;
    } | null;
    merchant: { id: string; name: string | null } | null;
    compliance: {
      overall?: string | null;
      profile?: { state?: string | null; county?: string | null; operation_type?: string | null; country?: string | null } | null;
      snapshot?: { overall?: string | null; updated_at?: string | null; missing?: string[] | null; expiring?: string[] | null } | null;
    } | null;
  };

  type RoleFilter = 'all' | 'chef' | 'merchant';
  const [roleFilter, setRoleFilter] = React.useState<RoleFilter>('all');

  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(false);
  const [selected, setSelected] = React.useState<Row | null>(null);
  const [error, setError] = React.useState<string | null>(null);

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

  // initial load
  React.useEffect(() => { load(true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  // search debounce
  React.useEffect(() => {
    const t = setTimeout(() => load(true), 300);
    return () => clearTimeout(t);
  }, [query, load]);

  const filteredRows = React.useMemo(() => {
    if (roleFilter === 'chef') return rows.filter(r => r.is_chef);
    if (roleFilter === 'merchant') return rows.filter(r => (r.is_merchant ?? !!r.merchant?.id));
    return rows;
  }, [rows, roleFilter]);

  // clear selection if hidden by filter
  React.useEffect(() => {
    if (selected && !filteredRows.some(r => r.id === selected.id)) {
      setSelected(null);
    }
  }, [filteredRows, selected]);

  const handlePick = (r: Row) => {
    setSelected(r);
    setEmail(r.email);
    // prefer existing chef display_name, else profile name, else "Chef" + first part of email
    const fallback = r.name || (r.email?.split('@')[0] ? `Chef ${r.email.split('@')[0]}` : 'Chef');
    setDisplayName(r.chef?.display_name || r.chef?.name || fallback);
  };

  const handlePromote = () =>
    run('promote-chef', () => {
      const normalizedEmail = email.trim().toLowerCase();
      return postJSON('/api/admin/chefs/promote', {
        email: normalizedEmail,
        display_name: displayName.trim(),
      });
    });

  async function openChefDashboard() {
    const targetEmail = (selected?.email || email).trim().toLowerCase();
    if (!targetEmail) return;
    setLaunching(true);
    try {
      const res = await fetch('/api/admin/chefs/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, next: '/chef/dashboard' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create link');
      // open in new tab without giving it control of the opener
      window.open(json.url, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      alert(e.message || 'Could not open dashboard');
    } finally {
      setLaunching(false);
    }
  }

  return (
    <ToolCard title="2) Promote to chef" subtitle="Upgrades an existing user to a Chef. If the user doesn’t exist yet, create them first">
      <div className="grid gap-6 md:grid-cols-2">
        {/* left: form */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              id="pc-email" label="User email" value={email} onChange={setEmail}
              placeholder="user’s login email" autoComplete="email" required
              validate={(v)=> (v && isEmail(v)? null : 'Enter a valid email')}
              example="chef.demo@example.com"
            />
            <Field
              id="pc-display" label="Public display name" value={displayName} onChange={setDisplayName}
              placeholder="shown on the storefront" required example="Chef Demo"
              help="Keep it short & human—this is what customers will see."
            />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <PrimaryButton busy={isBusy} disabled={!valid || isBusy} onClick={handlePromote}>
              Promote to chef
            </PrimaryButton>
            <SecondaryButton onClick={() => { setEmail('chef.demo@example.com'); setDisplayName('Chef Demo'); }}>
              Fill demo values
            </SecondaryButton>
          </div>
          <div className="mt-4">
            <HelpRow items={[
              'Promotion is idempotent—safe to run again.',
              'Next: enable compliance and create the first meal.',
            ]}/>
          </div>
        </div>

        {/* right: user list + preview */}
        <div className="space-y-3">
          <div className="rounded-xl border border-border/50 bg-background p-3">
            {/* role filter */}
            <div className="mb-2 flex items-center justify-between">
              <div className="inline-flex rounded-lg border bg-background p-0.5">
                {(['all','chef','merchant'] as RoleFilter[]).map(opt => (
                  <button
                    key={opt}
                    onClick={() => { setRoleFilter(opt); setPage(1); }}
                    className={[
                      'px-3 py-1 text-xs rounded-md border',
                      roleFilter === opt
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-transparent hover:bg-muted'
                    ].join(' ')}
                  >
                    {opt === 'all' ? 'All' : opt === 'chef' ? 'Chefs' : 'Merchants'}
                  </button>
                ))}
              </div>
              <span className="hidden text-xs text-muted-foreground md:inline">Tip: press “/” to search</span>
            </div>

            {/* search */}
            <div className="mb-2 flex items-center gap-2">
              <input
                type="text"
                placeholder="Search users by email or name…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={query}
                onChange={(e)=> { setQuery(e.target.value); setPage(1); }}
              />
              <button
                onClick={()=> load(true)}
                className="shrink-0 h-9 px-3 rounded-md border text-sm"
              >
                Search
              </button>
            </div>

            {/* list */}
            <div className="max-h-64 overflow-auto divide-y">
              {filteredRows.map((r) => (
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
                      {r.compliance?.overall && (
                        <span className="text-[10px] rounded-full px-2 py-0.5 border">
                          {r.compliance.overall === 'ok' ? 'OK'
                            : r.compliance.overall === 'pending' ? 'Pending'
                            : r.compliance.overall === 'none' ? 'None'
                            : r.compliance.overall}
                        </span>
                      )}

                      {/* Chef pill */}
                      <span className={`text-[10px] rounded-full px-2 py-0.5 border ${r.is_chef ? '' : 'opacity-70'}`}>
                        {r.is_chef ? 'Chef' : 'User'}
                      </span>

                      {/* Merchant pill (works with either is_merchant or merchant.id) */}
                      {(r.is_merchant ?? !!r.merchant?.id) && (
                        <span className="text-[10px] rounded-full px-2 py-0.5 border">Merchant</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
              {!loading && filteredRows.length === 0 && (
                <div className="px-2 py-6 text-sm text-muted-foreground text-center">No users match.</div>
              )}
            </div>

            <div className="mt-2 flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {error ? <span className="text-red-500">{error}</span> : loading ? 'Loading…' : `Showing ${filteredRows.length} user(s)`}
              </div>
              {hasMore && (
                <button
                  className="h-8 px-3 rounded-md border text-xs"
                  onClick={()=> load(false)}
                  disabled={loading}
                >
                  Load more
                </button>
              )}
            </div>
          </div>

          {/* live chef preview */}
          <ChefProfilePreview
            email={selected?.email || email}
            name={selected?.name || null}
            chef={selected?.chef ?? null}
            merchant={selected?.merchant ?? null}
            compliance={selected?.compliance ?? null}
          />
          <p className="text-[11px] text-muted-foreground">
            Selecting a user fills the form. If they’re already a chef, we’ll keep/repair links as needed.
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={openChefDashboard}
              disabled={launching || (!selected && !email)}
              className="h-9 rounded-md border px-3 text-sm"
              title="Open the chef dashboard in a new tab (impersonate)"
            >
              {launching ? 'Opening…' : 'Open Chef Dashboard'}
            </button>
          </div>
        </div>
      </div>
    </ToolCard>
  );
}

/* 3) Enable compliance */
export function EnableComplianceCard({
  run, isBusy, emailState, setEmailState,
}: {
  run:(label:string, fn:()=>Promise<any>)=>void;
  isBusy:boolean;
  emailState:string;
  setEmailState:(v:string)=>void;
}) {
  const [email, setEmail] = React.useState(emailState || 'chef.demo@example.com');
  const [state, setState] = React.useState('CA');
  const [county, setCounty] = React.useState('San Francisco');
  const [opType, setOpType] = React.useState<'home_kitchen'|'cottage_food'>('home_kitchen');

  React.useEffect(() => setEmailState(email), [email, setEmailState]);

  const stateUpper = (v:string)=> setState(v.toUpperCase().slice(0,2));
  const valid = isEmail(email) && isState2(state) && !!opType;

  const handleEnable = () =>
    run('enable-compliance', () => {
      const normalizedEmail = email.trim().toLowerCase();
      return postJSON('/api/admin/compliance/enable', {
        email: normalizedEmail,
        state,
        county: county.trim() ? county : null,
        operation_type: opType,
      });
    });

  return (
    <ToolCard title="3) Enable compliance for merchant" subtitle="Creates a compliance profile for the merchant (by user email). County is optional.">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field
          id="ec-email" label="Merchant user email" value={email} onChange={setEmail}
          autoComplete="email" required
          validate={(v)=> (v && isEmail(v)? null : 'Enter a valid email')}
          example="chef.demo@example.com"
        />
        <Field
          id="ec-state" label="State (2-letter)" value={state} onChange={stateUpper}
          placeholder="e.g. CA, WA" required
          validate={(v)=> (isState2(v)? null : 'Use 2-letter code')}
          help="Auto-uppercases as you type."
        />
        <Field
          id="ec-county" label="County (optional)" value={county} onChange={setCounty}
          placeholder="leave blank if N/A" help="Sent as null when blank."
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">Operation type</label>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={opType}
            onChange={(e)=> setOpType(e.target.value as any)}
          >
            <option value="home_kitchen">home_kitchen</option>
            <option value="cottage_food">cottage_food</option>
          </select>
          <p className="text-xs text-muted-foreground">Choose the appropriate regulatory path in that state.</p>
        </div>
        <div className="md:col-span-2 self-end text-xs text-muted-foreground">
          Jurisdiction preview:{' '}
          <span className="font-medium">
            US-{state} {county ? `/ ${county}` : '(no county)'} ({opType})
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <PrimaryButton busy={isBusy} disabled={!valid || isBusy} onClick={handleEnable}>
          Enable compliance
        </PrimaryButton>
        <SecondaryButton onClick={() => {
          setEmail('chef.demo@example.com'); setState('CA'); setCounty('San Francisco'); setOpType('home_kitchen');
        }}>
          Fill demo values
        </SecondaryButton>
      </div>
      <div className="mt-4">
        <HelpRow items={[
          'County is optional; blank sends null.',
          'Run again to change operation type later.',
        ]}/>
      </div>
    </ToolCard>
  );
}

/* 4) Create meal — now uses generic /products (product_type='meal') */
export function CreateMealCard({
  run, isBusy, emailState, setEmailState,
}: {
  run:(label:string, fn:()=>Promise<any>)=>void;
  isBusy:boolean;
  emailState:string;
  setEmailState:(v:string)=>void;
}) {
  const [email, setEmail] = React.useState(emailState || 'chef.demo@example.com');
  const [title, setTitle] = React.useState("Demo Chef's Citrus Chicken");
  const [priceUsd, setPriceUsd] = React.useState('15.00');
  const [qty, setQty] = React.useState('10');
  const [imageUrl, setImageUrl] = React.useState('');

  React.useEffect(() => setEmailState(email), [email, setEmailState]);

  const cents = parseUsdToCents(priceUsd);
  const qtyNum = Number(qty);
  const valid = isEmail(email) && !!title.trim() && cents !== null && qtyNum >= 1;

  const handleCreate = () =>
    run('make-meal', () => {
      const normalizedEmail = email.trim().toLowerCase();

      // ⬇️ Switched to generic products endpoint; forces product_type='meal'
      return postJSON('/api/admin/products', {
        email: normalizedEmail,        // backend should resolve merchant_id (or via chef → merchant)
        title: title.trim(),
        price_cents: cents!,           // preferred
        qty_available: qtyNum,
        image_url: imageUrl || null,
        product_type: 'meal',          // ← the key change
      });
    });

  return (
    <ToolCard
      title="4) Make a meal (product)"
      subtitle="Creates a product with product_type=‘meal’ for the merchant linked to the given user email (chef or merchant)."
    >
      {/* form + preview layout */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* left: the existing fields */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field
              id="mm-email"
              label="Merchant/Chef user email"
              value={email}
              onChange={setEmail}
              autoComplete="email"
              required
              validate={(v)=> (v && isEmail(v)? null : 'Enter a valid email')}
              example="chef.demo@example.com"
              help="We’ll resolve the merchant by this user (chef or merchant account)."
            />
            <Field
              id="mm-title" label="Meal title" value={title} onChange={setTitle}
              required example="Citrus Chicken with Herb Rice"
            />
            <Field
              id="mm-price" label="Price (USD)" value={priceUsd} onChange={setPriceUsd}
              placeholder="e.g. 15 or 15.99" required
              validate={(v)=> (parseUsdToCents(v) !== null ? null : 'Enter a positive number')}
              help={cents !== null ? `Will send: ${cents}¢` : undefined}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field
              id="mm-qty" label="Quantity available" value={qty} onChange={setQty}
              placeholder="e.g. 10" required
              validate={(v)=> (Number(v) >= 1 ? null : 'Must be at least 1')}
              example="10"
            />
            <Field
              id="mm-img" label="Image URL (optional)" value={imageUrl}
              onChange={setImageUrl} placeholder="https://…" help="Optional (upload/selection may come later)."
            />
          </div>

          <div className="mt-3 flex items-center gap-2">
            <PrimaryButton busy={isBusy} disabled={!valid || isBusy} onClick={handleCreate}>
              Create meal
            </PrimaryButton>
            <SecondaryButton onClick={() => {
              setEmail('chef.demo@example.com'); setTitle("Demo Chef's Citrus Chicken");
              setPriceUsd('15.00'); setQty('10'); setImageUrl('');
            }}>
              Fill demo values
            </SecondaryButton>
          </div>

          <div className="mt-4">
            <HelpRow items={[
              'Now posts to /api/admin/products with product_type="meal".',
              'Price accepts “15” or “15.99”; converted to cents.',
              'Quantity must be at least 1.',
            ]}/>
          </div>
        </div>

        {/* right: live preview */}
        <div className="md:pt-1">
          <MealCardPreview
            title={title}
            priceCents={cents}
            qty={Number(qty)}
            imageUrl={imageUrl}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Live preview only — exact storefront styling may vary.
          </p>
        </div>
      </div>
    </ToolCard>
  );
}
