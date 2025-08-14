'use client';

import * as React from 'react';

type Json = Record<string, any>;

async function postJSON(url: string, body: Json) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || res.statusText);
  return data;
}

export default function AdminToolsPage() {
  const [busy, setBusy] = React.useState<string | null>(null);
  const [out, setOut] = React.useState<Json | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const run = async (label: string, fn: () => Promise<any>) => {
    setBusy(label); setErr(null); setOut(null);
    try { const d = await fn(); setOut(d); }
    catch (e: any) { setErr(e?.message || String(e)); }
    finally { setBusy(null); }
  };

  // shared form state
  const [email, setEmail] = React.useState('chef.demo@example.com');
  const [password, setPassword] = React.useState('StrongPass!1');
  const [name, setName] = React.useState('Demo Chef');

  const [displayName, setDisplayName] = React.useState('Chef Demo');
  const [state, setState] = React.useState('CA');
  const [county, setCounty] = React.useState('San Francisco');
  const [opType, setOpType] = React.useState('home_kitchen');

  const [mealTitle, setMealTitle] = React.useState("Demo Chef's Citrus Chicken");
  const [priceCents, setPriceCents] = React.useState(1500);
  const [qty, setQty] = React.useState(10);

  // new controls
  const [mealId, setMealId] = React.useState('');
  const [mealSlug, setMealSlug] = React.useState('');
  const [reviewCount, setReviewCount] = React.useState(3);
  const [sendNowLimit, setSendNowLimit] = React.useState(50);

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Admin Tools</h1>
        <p className="text-sm text-muted-foreground">
          Quick actions to create users, promote to chef, enable compliance, and create meals.
        </p>
      </header>

      {/* Create new user */}
      <section className="border rounded-xl p-4 space-y-3">
        <h2 className="font-medium">1) Create new user</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input className="border rounded px-2 py-1" value={email} onChange={e=>setEmail(e.target.value)} placeholder="email" />
          <input className="border rounded px-2 py-1" value={password} onChange={e=>setPassword(e.target.value)} placeholder="password" />
          <input className="border rounded px-2 py-1" value={name} onChange={e=>setName(e.target.value)} placeholder="name" />
        </div>
        <button className="border rounded px-3 py-1 text-sm" disabled={!!busy}
          onClick={() => run('create-user', () => postJSON('/api/admin/users', { email, password, name }))}>
          {busy === 'create-user' ? 'Creating…' : 'Create user'}
        </button>
      </section>

      {/* Promote to chef */}
      <section className="border rounded-xl p-4 space-y-3">
        <h2 className="font-medium">2) Promote to chef</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input className="border rounded px-2 py-1" value={email} onChange={e=>setEmail(e.target.value)} placeholder="user email" />
          <input className="border rounded px-2 py-1" value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="display name" />
        </div>
        <button className="border rounded px-3 py-1 text-sm" disabled={!!busy}
          onClick={() => run('promote-chef', () => postJSON('/api/admin/chefs/promote', { email, display_name: displayName }))}>
          {busy === 'promote-chef' ? 'Promoting…' : 'Promote to chef'}
        </button>
      </section>

      {/* Enable compliance */}
      <section className="border rounded-xl p-4 space-y-3">
        <h2 className="font-medium">3) Enable compliance for merchant (by user email)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input className="border rounded px-2 py-1" value={email} onChange={e=>setEmail(e.target.value)} placeholder="user email" />
          <input className="border rounded px-2 py-1" value={state} onChange={e=>setState(e.target.value)} placeholder="state (e.g. CA)" />
          <input className="border rounded px-2 py-1" value={county} onChange={e=>setCounty(e.target.value)} placeholder="county (or blank)" />
        </div>
        <div>
          <select className="border rounded px-2 py-1" value={opType} onChange={e=>setOpType(e.target.value)}>
            <option value="home_kitchen">home_kitchen</option>
            <option value="cottage_food">cottage_food</option>
          </select>
        </div>
        <button className="border rounded px-3 py-1 text-sm" disabled={!!busy}
          onClick={() => run('enable-compliance', () => postJSON('/api/admin/compliance/enable', {
            email, state, county: county || null, operation_type: opType
          }))}>
          {busy === 'enable-compliance' ? 'Enabling…' : 'Enable compliance'}
        </button>
      </section>

      {/* Make a meal */}
      <section className="border rounded-xl p-4 space-y-3">
        <h2 className="font-medium">4) Make a meal (for user’s chef)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input className="border rounded px-2 py-1" value={email} onChange={e=>setEmail(e.target.value)} placeholder="user email" />
          <input className="border rounded px-2 py-1" value={mealTitle} onChange={e=>setMealTitle(e.target.value)} placeholder="meal title" />
          <input className="border rounded px-2 py-1" value={priceCents} onChange={e=>setPriceCents(Number(e.target.value)||0)} placeholder="price cents" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input className="border rounded px-2 py-1" value={qty} onChange={e=>setQty(Number(e.target.value)||0)} placeholder="qty available" />
          <input className="border rounded px-2 py-1" placeholder="image url (optional)" />
        </div>
        <button className="border rounded px-3 py-1 text-sm" disabled={!!busy}
          onClick={() => run('make-meal', () => postJSON('/api/admin/meals', {
            email, title: mealTitle, price_cents: priceCents, qty_available: qty
          }))}>
          {busy === 'make-meal' ? 'Creating…' : 'Create meal'}
        </button>
      </section>

      {/* NEW: Create demo reviews */}
      <section className="border rounded-xl p-4 space-y-3">
        <h2 className="font-medium">5) Create demo reviews</h2>
        <p className="text-sm text-muted-foreground">Provide a meal ID/slug, or just the chef’s user email to use their most recent meal.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input className="border rounded px-2 py-1" value={mealId} onChange={e=>setMealId(e.target.value)} placeholder="meal_id (optional)" />
          <input className="border rounded px-2 py-1" value={mealSlug} onChange={e=>setMealSlug(e.target.value)} placeholder="meal_slug (optional)" />
          <input className="border rounded px-2 py-1" value={email} onChange={e=>setEmail(e.target.value)} placeholder="user email (fallback)" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input className="border rounded px-2 py-1" type="number" value={reviewCount} onChange={e=>setReviewCount(Number(e.target.value)||0)} placeholder="# reviews (e.g. 3)" />
        </div>
        <button className="border rounded px-3 py-1 text-sm" disabled={!!busy}
          onClick={() => run('create-reviews', () => postJSON('/api/admin/reviews', {
            meal_id: mealId || undefined, meal_slug: mealSlug || undefined, email, count: reviewCount
          }))}>
          {busy === 'create-reviews' ? 'Creating…' : 'Create demo reviews'}
        </button>
      </section>

      {/* NEW: Restock a meal (and enqueue waitlist) */}
      <section className="border rounded-xl p-4 space-y-3">
        <h2 className="font-medium">6) Restock a meal & queue waitlist</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input className="border rounded px-2 py-1" value={mealId} onChange={e=>setMealId(e.target.value)} placeholder="meal_id (optional)" />
          <input className="border rounded px-2 py-1" value={mealSlug} onChange={e=>setMealSlug(e.target.value)} placeholder="meal_slug (optional)" />
          <input className="border rounded px-2 py-1" value={email} onChange={e=>setEmail(e.target.value)} placeholder="user email (fallback)" />
          <input className="border rounded px-2 py-1" type="number" value={qty} onChange={e=>setQty(Number(e.target.value)||0)} placeholder="qty_available" />
        </div>
        <button className="border rounded px-3 py-1 text-sm" disabled={!!busy}
          onClick={() => run('restock', () => postJSON('/api/admin/meals/restock', {
            meal_id: mealId || undefined, meal_slug: mealSlug || undefined, email, qty: qty, is_active: true
          }))}>
          {busy === 'restock' ? 'Restocking…' : 'Restock & enqueue waitlist'}
        </button>
      </section>

      {/* NEW: Send restock emails now */}
      <section className="border rounded-xl p-4 space-y-3">
        <h2 className="font-medium">7) Send restock emails now</h2>
        <p className="text-sm text-muted-foreground">Sends to active waitlist subscribers for the meal.</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input className="border rounded px-2 py-1" value={mealId} onChange={e=>setMealId(e.target.value)} placeholder="meal_id (optional)" />
          <input className="border rounded px-2 py-1" value={mealSlug} onChange={e=>setMealSlug(e.target.value)} placeholder="meal_slug (optional)" />
          <input className="border rounded px-2 py-1" value={email} onChange={e=>setEmail(e.target.value)} placeholder="user email (fallback)" />
          <input className="border rounded px-2 py-1" type="number" value={sendNowLimit} onChange={e=>setSendNowLimit(Number(e.target.value)||0)} placeholder="limit (e.g. 50)" />
        </div>
        <button className="border rounded px-3 py-1 text-sm" disabled={!!busy}
          onClick={() => run('send-restock', () => postJSON('/api/admin/emails/restock', {
            meal_id: mealId || undefined, meal_slug: mealSlug || undefined, email, limit: sendNowLimit
          }))}>
          {busy === 'send-restock' ? 'Sending…' : 'Send restock emails'}
        </button>
      </section>

{/* 8) Mark compliance doc */}
<section className="border rounded-xl p-4 space-y-3">
  <h2 className="font-medium">8) Mark compliance doc</h2>
  <p className="text-sm text-muted-foreground">
    Approve/expire/pending/rejected a requirement by <code>code</code> for a merchant (by user email).
  </p>
  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
    <input className="border rounded px-2 py-1" value={email} onChange={e=>setEmail(e.target.value)} placeholder="merchant user email" />
    <input className="border rounded px-2 py-1" placeholder="merchant_id (optional)" />
    <input className="border rounded px-2 py-1" placeholder="(unused)" />
    <input className="border rounded px-2 py-1" placeholder="(unused)" />
  </div>
  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
    <input className="border rounded px-2 py-1" placeholder="jurisdiction auto (from profile)" disabled />
    <input className="border rounded px-2 py-1" id="code" defaultValue="INSURANCE_GPL" placeholder="requirement code" />
    <select className="border rounded px-2 py-1" id="status" defaultValue="approved">
      <option value="approved">approved</option>
      <option value="expired">expired</option>
      <option value="pending">pending</option>
      <option value="rejected">rejected</option>
    </select>
    <input className="border rounded px-2 py-1" id="expires" type="number" defaultValue={180} placeholder="expires in days" />
  </div>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
    <input className="border rounded px-2 py-1" id="kind" placeholder="kind (e.g. AI ENDORSEMENT)" />
  </div>
  <button
    className="border rounded px-3 py-1 text-sm"
    disabled={!!busy}
    onClick={() => run('mark-doc', () => postJSON('/api/admin/compliance/docs/mark', {
      email,
      code: (document.getElementById('code') as HTMLInputElement)?.value || 'INSURANCE_GPL',
      status: (document.getElementById('status') as HTMLSelectElement)?.value || 'approved',
      expires_in_days: Number((document.getElementById('expires') as HTMLInputElement)?.value || 180),
      kind: (document.getElementById('kind') as HTMLInputElement)?.value || undefined,
    }))}
  >
    {busy === 'mark-doc' ? 'Saving…' : 'Save doc'}
  </button>
</section>

{/* 9) Seed compliance set */}
<section className="border rounded-xl p-4 space-y-3">
  <h2 className="font-medium">9) Seed compliance set</h2>
  <p className="text-sm text-muted-foreground">Quickly make a merchant OK / Blocked / Mixed.</p>
  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
    <input className="border rounded px-2 py-1" value={email} onChange={e=>setEmail(e.target.value)} placeholder="merchant user email" />
    <select className="border rounded px-2 py-1" id="scenario" defaultValue="ok">
      <option value="ok">ok</option>
      <option value="blocked">blocked</option>
      <option value="mixed">mixed</option>
    </select>
    <input className="border rounded px-2 py-1" id="days" type="number" defaultValue={180} placeholder="valid days (for ok/mixed)" />
  </div>
  <button
    className="border rounded px-3 py-1 text-sm"
    disabled={!!busy}
    onClick={() => run('seed-compliance', () => postJSON('/api/admin/compliance/seed', {
      email,
      scenario: (document.getElementById('scenario') as HTMLSelectElement)?.value || 'ok',
      valid_days: Number((document.getElementById('days') as HTMLInputElement)?.value || 180),
    }))}
  >
    {busy === 'seed-compliance' ? 'Seeding…' : 'Seed compliance'}
  </button>
</section>

{/* 10) Deactivate a meal */}
<section className="border rounded-xl p-4 space-y-3">
  <h2 className="font-medium">10) Deactivate a meal</h2>
  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
    <input className="border rounded px-2 py-1" value={mealId} onChange={e=>setMealId(e.target.value)} placeholder="meal_id (optional)" />
    <input className="border rounded px-2 py-1" value={mealSlug} onChange={e=>setMealSlug(e.target.value)} placeholder="meal_slug (optional)" />
    <input className="border rounded px-2 py-1" value={email} onChange={e=>setEmail(e.target.value)} placeholder="user email (fallback)" />
    <input className="border rounded px-2 py-1" type="number" placeholder="set qty to (optional)" id="dq" />
  </div>
  <button
    className="border rounded px-3 py-1 text-sm"
    disabled={!!busy}
    onClick={() => run('deactivate-meal', () => postJSON('/api/admin/meals/deactivate', {
      meal_id: mealId || undefined,
      meal_slug: mealSlug || undefined,
      email,
      qty: ((document.getElementById('dq') as HTMLInputElement)?.value || '') ? Number((document.getElementById('dq') as HTMLInputElement).value) : undefined
    }))}
  >
    {busy === 'deactivate-meal' ? 'Deactivating…' : 'Deactivate meal'}
  </button>
</section>

{/* 11) Create AI endorsement doc */}
<section className="border rounded-xl p-4 space-y-3">
  <h2 className="font-medium">11) Create AI Endorsement (Insurance)</h2>
  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
    <input className="border rounded px-2 py-1" placeholder="merchant user email" value={email} onChange={e=>setEmail(e.target.value)} />
    <input className="border rounded px-2 py-1" id="endorseDays" type="number" defaultValue={180} placeholder="expires in days" />
  </div>
  <button className="border rounded px-3 py-1 text-sm" disabled={!!busy}
    onClick={() => run('endorsement', () => postJSON('/api/admin/compliance/docs/endorsement', {
      email, expires_in_days: Number((document.getElementById('endorseDays') as HTMLInputElement)?.value || 180)
    }))}>
    {busy === 'endorsement' ? 'Creating…' : 'Create AI endorsement'}
  </button>
</section>

{/* 12) Approve ALL requirements */}
<section className="border rounded-xl p-4 space-y-3">
  <h2 className="font-medium">12) Approve ALL requirements</h2>
  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
    <input className="border rounded px-2 py-1" placeholder="merchant user email" value={email} onChange={e=>setEmail(e.target.value)} />
    <input className="border rounded px-2 py-1" id="allDays" type="number" defaultValue={365} placeholder="valid days" />
    <label className="inline-flex items-center gap-2 text-sm">
      <input type="checkbox" id="includeAI" defaultChecked /> include AI endorsement
    </label>
  </div>
  <button className="border rounded px-3 py-1 text-sm" disabled={!!busy}
    onClick={() => run('approve-all', () => postJSON('/api/admin/compliance/approve_all', {
      email,
      valid_days: Number((document.getElementById('allDays') as HTMLInputElement)?.value || 365),
      include_ai_endorsement: (document.getElementById('includeAI') as HTMLInputElement)?.checked
    }))}>
    {busy === 'approve-all' ? 'Approving…' : 'Approve all'}
  </button>
</section>

{/* 13) Clone a meal */}
<section className="border rounded-xl p-4 space-y-3">
  <h2 className="font-medium">13) Clone a meal</h2>
  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
    <input className="border rounded px-2 py-1" value={mealId} onChange={e=>setMealId(e.target.value)} placeholder="meal_id (or)" />
    <input className="border rounded px-2 py-1" value={mealSlug} onChange={e=>setMealSlug(e.target.value)} placeholder="meal_slug" />
    <input className="border rounded px-2 py-1" id="newTitle" placeholder="new title (optional)" />
    <input className="border rounded px-2 py-1" id="cloneQty" type="number" placeholder="qty (optional)" />
  </div>
  <label className="inline-flex items-center gap-2 text-sm">
    <input type="checkbox" id="cloneActive" /> set active
  </label>
  <div>
    <button className="border rounded px-3 py-1 text-sm" disabled={!!busy}
      onClick={() => run('clone-meal', () => postJSON('/api/admin/meals/clone', {
        meal_id: mealId || undefined,
        meal_slug: mealSlug || undefined,
        new_title: (document.getElementById('newTitle') as HTMLInputElement)?.value || undefined,
        qty_available: ((document.getElementById('cloneQty') as HTMLInputElement)?.value || '') ? Number((document.getElementById('cloneQty') as HTMLInputElement).value) : undefined,
        is_active: (document.getElementById('cloneActive') as HTMLInputElement)?.checked || false
      }))}>
      {busy === 'clone-meal' ? 'Cloning…' : 'Clone meal'}
    </button>
  </div>
</section>

{/* 14) Bulk-generate meals */}
<section className="border rounded-xl p-4 space-y-3">
  <h2 className="font-medium">14) Bulk-generate meals</h2>
  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
    <input className="border rounded px-2 py-1" value={email} onChange={e=>setEmail(e.target.value)} placeholder="chef user email" />
    <input className="border rounded px-2 py-1" id="bulkCount" type="number" defaultValue={20} placeholder="count (max 100)" />
    <input className="border rounded px-2 py-1" id="bulkBase" defaultValue="Demo Meal" placeholder="base title" />
    <input className="border rounded px-2 py-1" id="bulkActiveRatio" defaultValue="0.7" placeholder="active ratio 0..1" />
  </div>
  <button className="border rounded px-3 py-1 text-sm" disabled={!!busy}
    onClick={() => run('bulk-meals', () => postJSON('/api/admin/meals/bulk', {
      email,
      count: Number((document.getElementById('bulkCount') as HTMLInputElement)?.value || 20),
      base_title: (document.getElementById('bulkBase') as HTMLInputElement)?.value || 'Demo Meal',
      active_ratio: Number((document.getElementById('bulkActiveRatio') as HTMLInputElement)?.value || 0.7),
    }))}>
    {busy === 'bulk-meals' ? 'Generating…' : 'Generate meals'}
  </button>
</section>
{/* 15) Nuke demo data */}
<section className="border rounded-xl p-4 space-y-3">
  <h2 className="font-medium">15) Nuke demo data</h2>
  <p className="text-sm text-muted-foreground">
    Delete seeded/admin-tagged meals and related rows for a merchant (by user email). Toggle scopes as needed.
  </p>
  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
    <input className="border rounded px-2 py-1" placeholder="merchant user email" value={email} onChange={e=>setEmail(e.target.value)} />
    <label className="inline-flex items-center gap-2 text-sm">
      <input type="checkbox" id="onlyDemo" defaultChecked /> only demo
    </label>
  </div>
  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
    <label className="inline-flex items-center gap-2"><input type="checkbox" id="scReviews" defaultChecked/> reviews</label>
    <label className="inline-flex items-center gap-2"><input type="checkbox" id="scWaitlist" defaultChecked/> waitlist</label>
    <label className="inline-flex items-center gap-2"><input type="checkbox" id="scOutbox" defaultChecked/> outbox</label>
    <label className="inline-flex items-center gap-2"><input type="checkbox" id="scInvites" defaultChecked/> invites</label>
    <label className="inline-flex items-center gap-2"><input type="checkbox" id="scMeals" defaultChecked/> meals</label>
    <label className="inline-flex items-center gap-2"><input type="checkbox" id="scDocs" /> compliance docs</label>
    <label className="inline-flex items-center gap-2"><input type="checkbox" id="scProfile" /> compliance profile/status</label>
  </div>
  <button className="border rounded px-3 py-1 text-sm" disabled={!!busy}
    onClick={() => run('nuke', () => postJSON('/api/admin/nuke', {
      email,
      only_demo: (document.getElementById('onlyDemo') as HTMLInputElement)?.checked,
      scope: {
        reviews: (document.getElementById('scReviews') as HTMLInputElement)?.checked,
        waitlist: (document.getElementById('scWaitlist') as HTMLInputElement)?.checked,
        outbox: (document.getElementById('scOutbox') as HTMLInputElement)?.checked,
        invites: (document.getElementById('scInvites') as HTMLInputElement)?.checked,
        meals: (document.getElementById('scMeals') as HTMLInputElement)?.checked,
        compliance_docs: (document.getElementById('scDocs') as HTMLInputElement)?.checked,
        compliance_profile: (document.getElementById('scProfile') as HTMLInputElement)?.checked,
      }
    }))}>
    {busy === 'nuke' ? 'Deleting…' : 'Nuke demo data'}
  </button>
</section>

{/* 16) Generate QR review links */}
<section className="border rounded-xl p-4 space-y-3">
  <h2 className="font-medium">16) Generate QR review links</h2>
  <p className="text-sm text-muted-foreground">
    Create tokenized review links (optionally with QR PNGs) for stickers. Provide a meal ID/slug or a chef’s email.
  </p>
  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
    <input className="border rounded px-2 py-1" value={mealId} onChange={e=>setMealId(e.target.value)} placeholder="meal_id (optional)" />
    <input className="border rounded px-2 py-1" value={mealSlug} onChange={e=>setMealSlug(e.target.value)} placeholder="meal_slug (optional)" />
    <input className="border rounded px-2 py-1" value={email} onChange={e=>setEmail(e.target.value)} placeholder="chef email (fallback)" />
    <input className="border rounded px-2 py-1" id="invCount" type="number" defaultValue={10} placeholder="# invites" />
  </div>
  <label className="inline-flex items-center gap-2 text-sm">
    <input type="checkbox" id="qrPng" defaultChecked /> include QR PNGs
  </label>
  <button className="border rounded px-3 py-1 text-sm" disabled={!!busy}
    onClick={() => run('qr-invites', () => postJSON('/api/admin/reviews/invites', {
      meal_id: mealId || undefined,
      meal_slug: mealSlug || undefined,
      email,
      count: Number((document.getElementById('invCount') as HTMLInputElement)?.value || 10),
      include_qr_png: (document.getElementById('qrPng') as HTMLInputElement)?.checked
    }))}>
    {busy === 'qr-invites' ? 'Generating…' : 'Generate invites'}
  </button>
  <p className="text-xs text-muted-foreground">Tip: install <code>qrcode</code> to embed PNGs: <code>npm i qrcode</code></p>
</section>
{/* 17) Sticker Sheet (PDF) — updated with Avery templates */}
<section className="border rounded-xl p-4 space-y-3">
  <h2 className="font-medium">17) Sticker Sheet (PDF)</h2>
  <p className="text-sm text-muted-foreground">Build a printable sheet of QR stickers (Avery presets included).</p>

  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
    <input className="border rounded px-2 py-1" placeholder="meal_id (optional)" id="ssMealId" />
    <input className="border rounded px-2 py-1" placeholder="meal_slug (optional)" id="ssMealSlug" />
    <input className="border rounded px-2 py-1" placeholder="chef email (fallback)" id="ssEmail" />
    <input className="border rounded px-2 py-1" type="number" defaultValue={30} placeholder="# stickers" id="ssCount" />
  </div>

  {/* New: Choose a template OR use custom grid */}
  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
    <select className="border rounded px-2 py-1" id="ssTemplate" defaultValue="">
      <option value="">Custom grid…</option>
      <option value="avery_5160">Avery 5160 (1"×2⅝", 30)</option>
      <option value="avery_5163">Avery 5163 (2"×4", 10)</option>
      <option value="avery_5164">Avery 5164 (3⅓"×4", 6)</option>
      <option value="avery_5167">Avery 5167 (½"×1¾", 80)</option>
      <option value="avery_l7160">Avery L7160 (A4, 63.5×38.1mm, 21)</option>
      <option value="avery_22806_round">Avery 22806 (2" round, 12)</option>
    </select>

    {/* Custom-grid fallbacks (ignored if template chosen) */}
    <div className="grid grid-cols-3 gap-2">
      <select className="border rounded px-2 py-1" id="ssPaper" defaultValue="letter">
        <option value="letter">US Letter</option>
        <option value="a4">A4</option>
      </select>
      <input className="border rounded px-2 py-1" type="number" defaultValue={10} placeholder="rows" id="ssRows" />
      <input className="border rounded px-2 py-1" type="number" defaultValue={3} placeholder="cols" id="ssCols" />
    </div>
  </div>

  <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
    <input className="border rounded px-2 py-1" placeholder="brand (top-right)" id="ssBrand" defaultValue="delivered.menu" />
    <input className="border rounded px-2 py-1" placeholder="title (big)" id="ssTitle" defaultValue="Scan to review" />
    <input className="border rounded px-2 py-1" placeholder="chef label (optional)" id="ssChef" />
    <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" id="ssBorder" /> borders</label>
    <input className="border rounded px-2 py-1" type="number" placeholder="margin (pt, custom only)" id="ssMargin" />
  </div>

  {/* Fine tuning */}
  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
    <input className="border rounded px-2 py-1" type="number" step="0.5" defaultValue={0} placeholder="offset X (pt)" id="ssOffX" />
    <input className="border rounded px-2 py-1" type="number" step="0.5" defaultValue={0} placeholder="offset Y (pt)" id="ssOffY" />
    <input className="border rounded px-2 py-1" type="number" step="0.01" defaultValue={1.0} placeholder="scale (0.9–1.1)" id="ssScale" />
    <span className="text-xs text-muted-foreground self-center">Tip: tweak offsets if print drifts.</span>
  </div>

  <button
    className="border rounded px-3 py-1 text-sm"
    onClick={async () => {
      const payload: any = {
        meal_id: (document.getElementById('ssMealId') as HTMLInputElement)?.value || undefined,
        meal_slug: (document.getElementById('ssMealSlug') as HTMLInputElement)?.value || undefined,
        email: (document.getElementById('ssEmail') as HTMLInputElement)?.value || undefined,
        count: Number((document.getElementById('ssCount') as HTMLInputElement)?.value || 30),
        template: (document.getElementById('ssTemplate') as HTMLSelectElement)?.value || undefined,
        // custom fallback (ignored if template chosen)
        paper: (document.getElementById('ssPaper') as HTMLSelectElement)?.value || 'letter',
        rows: Number((document.getElementById('ssRows') as HTMLInputElement)?.value || 10),
        cols: Number((document.getElementById('ssCols') as HTMLInputElement)?.value || 3),
        brand: (document.getElementById('ssBrand') as HTMLInputElement)?.value || 'delivered.menu',
        title: (document.getElementById('ssTitle') as HTMLInputElement)?.value || 'Scan to review',
        chef_label: (document.getElementById('ssChef') as HTMLInputElement)?.value || undefined,
        border: (document.getElementById('ssBorder') as HTMLInputElement)?.checked || false,
        margin_pt: (document.getElementById('ssMargin') as HTMLInputElement)?.value
          ? Number((document.getElementById('ssMargin') as HTMLInputElement).value) : undefined,
        offset_x_pt: Number((document.getElementById('ssOffX') as HTMLInputElement)?.value || 0),
        offset_y_pt: Number((document.getElementById('ssOffY') as HTMLInputElement)?.value || 0),
        scale: Number((document.getElementById('ssScale') as HTMLInputElement)?.value || 1.0),
      };
      const res = await fetch('/api/admin/reviews/invites/sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(()=>({}));
        alert('Failed to generate PDF: ' + (d?.error || res.statusText));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'review-stickers.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }}
  >
    Generate PDF
  </button>
</section>

      {/* Output */}
      <section className="border rounded-xl p-4 space-y-2">
        <h2 className="font-medium">Output</h2>
        {busy && <div className="text-sm text-muted-foreground">Working: {busy}…</div>}
        {err && <pre className="text-sm text-red-600 whitespace-pre-wrap">{err}</pre>}
        {out && <pre className="text-xs bg-muted/30 p-2 rounded overflow-auto">{JSON.stringify(out, null, 2)}</pre>}
      </section>
    </main>
  );
}
