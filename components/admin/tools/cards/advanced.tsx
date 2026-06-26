// components/admin/tools/cards/advanced.tsx
'use client';

import * as React from 'react';
import { ToolCard, Field, HelpRow, PrimaryButton, SecondaryButton } from '@/components/admin/tools/ui';
import { postJSON, isEmail } from '@/components/admin/tools/utils';



/* 15) Nuke demo data */
export function NukeDemoDataCard({ run, isBusy, emailState, setEmailState }:{
  run:(label:string, fn:()=>Promise<any>)=>void; isBusy:boolean; emailState:string; setEmailState:(v:string)=>void;
}) {
  const [email, setEmail] = React.useState(emailState || 'chef.demo@example.com');
  const [onlyDemo, setOnlyDemo] = React.useState(true);
  const [scope, setScope] = React.useState({
    reviews: true, waitlist: true, outbox: true, invites: true,
    meals: true, compliance_docs: false, compliance_profile: false,
  });
  React.useEffect(() => setEmailState(email), [email, setEmailState]);

  const valid = isEmail(email);
  const toggle = (k: keyof typeof scope) => setScope(s => ({ ...s, [k]: !s[k] }));

  return (
    <ToolCard title="15) Nuke demo data" subtitle="Delete seeded/admin-tagged meals and related rows for a merchant. Toggle scopes as needed.">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field id="nk-email" label="merchant user email" value={email} onChange={setEmail} required validate={(v)=> (v && isEmail(v)? null : 'Invalid email')}/>
        <div className="flex items-end">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyDemo} onChange={(e)=> setOnlyDemo(e.target.checked)}/>
            only demo
          </label>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
        {[
          ['reviews','reviews'],['waitlist','waitlist'],['outbox','outbox'],['invites','invites'],
          ['meals','meals'],['compliance_docs','compliance docs'],['compliance_profile','compliance profile'],
        ].map(([k,label])=>(
          <label key={k} className="inline-flex items-center gap-2">
            <input type="checkbox" checked={(scope as any)[k]} onChange={()=> toggle(k as any)} /> {label}
          </label>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <PrimaryButton
          busy={isBusy}
          disabled={!valid || isBusy}
          onClick={() =>
            run('nuke', () =>
              postJSON('/api/admin/nuke', { email, only_demo: onlyDemo, scope })
            )
          }
        >
          Nuke demo data
        </PrimaryButton>
        <SecondaryButton
          onClick={() => {
            setEmail('chef.demo@example.com');
            setOnlyDemo(true);
            setScope({ reviews:true, waitlist:true, outbox:true, invites:true, meals:true, compliance_docs:false, compliance_profile:false });
          }}
        >
          Fill demo values
        </SecondaryButton>
      </div>
    </ToolCard>
  );
}

/* 16) Generate QR review links */
export function GenerateQrInvitesCard({ run, isBusy, emailState, setEmailState }:{
  run:(label:string, fn:()=>Promise<any>)=>void; isBusy:boolean; emailState:string; setEmailState:(v:string)=>void;
}) {
  const [mealId, setMealId] = React.useState('');
  const [mealSlug, setMealSlug] = React.useState('');
  const [email, setEmail] = React.useState(emailState || 'chef.demo@example.com');
  const [count, setCount] = React.useState('10');
  const [includePng, setIncludePng] = React.useState(true);
  React.useEffect(() => setEmailState(email), [email, setEmailState]);

  const haveTarget = !!mealId.trim() || !!mealSlug.trim() || (email.trim() && isEmail(email));
  const valid = haveTarget && Number(count) >= 1;

  return (
    <ToolCard title="16) Generate QR review links" subtitle="Create tokenized review links (optionally with QR PNGs) for stickers.">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Field id="qr-meal-id" label="meal_id (optional)" value={mealId} onChange={setMealId} placeholder="uuid"/>
        <Field id="qr-meal-slug" label="meal_slug (optional)" value={mealSlug} onChange={setMealSlug} placeholder="slug"/>
        <Field id="qr-email" label="chef email (fallback)" value={email} onChange={setEmail} placeholder="used if ID/slug omitted" validate={(v)=> (v && !isEmail(v)? 'Invalid email' : null)}/>
        <Field id="qr-count" label="# invites" value={count} onChange={setCount} placeholder="e.g. 10" validate={(v)=> (Number(v) >= 1 ? null : 'At least 1')}/>
      </div>
      <label className="mt-2 inline-flex items-center gap-2 text-sm">
        <input type="checkbox" checked={includePng} onChange={(e)=> setIncludePng(e.target.checked)} /> include QR PNGs
      </label>
      <div className="mt-3 flex items-center gap-2">
        <PrimaryButton
          busy={isBusy}
          disabled={!valid || isBusy}
          onClick={() =>
            run('qr-invites', () =>
              postJSON('/api/admin/reviews/invites', {
                meal_id: mealId || undefined,
                meal_slug: mealSlug || undefined,
                email,
                count: Number(count),
                include_qr_png: includePng,
              })
            )
          }
        >
          Generate invites
        </PrimaryButton>
        <SecondaryButton
          onClick={() => {
            setMealId(''); setMealSlug(''); setEmail('chef.demo@example.com'); setCount('10'); setIncludePng(true);
          }}
        >
          Fill demo values
        </SecondaryButton>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Tip: install <code>qrcode</code> to embed PNGs: <code>npm i qrcode</code>
      </p>
    </ToolCard>
  );
}

/* 17) Sticker Sheet (PDF) */
export function StickerSheetCard({ isBusy }:{ isBusy:boolean; }) {
  const [mealId, setMealId] = React.useState('');
  const [mealSlug, setMealSlug] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [count, setCount] = React.useState('30');

  const [template, setTemplate] = React.useState('');
  const [paper, setPaper] = React.useState<'letter'|'a4'>('letter');
  const [rows, setRows] = React.useState('10');
  const [cols, setCols] = React.useState('3');

  const [brand, setBrand] = React.useState('delivered.menu');
  const [title, setTitle] = React.useState('Scan to review');
  const [chefLabel, setChefLabel] = React.useState('');
  const [border, setBorder] = React.useState(false);
  const [marginPt, setMarginPt] = React.useState('');

  const [offX, setOffX] = React.useState('0');
  const [offY, setOffY] = React.useState('0');
  const [scale, setScale] = React.useState('1.0');

  const [localBusy, setLocalBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const valid = Number(count) >= 1;

  const generate = async () => {
    setErr(null);
    setLocalBusy(true);
    try {
      const payload: any = {
        meal_id: mealId || undefined,
        meal_slug: mealSlug || undefined,
        email: email || undefined,
        count: Number(count),
        template: template || undefined,
        paper,
        rows: Number(rows || 10),
        cols: Number(cols || 3),
        brand: brand || 'delivered.menu',
        title: title || 'Scan to review',
        chef_label: chefLabel || undefined,
        border,
        margin_pt: marginPt ? Number(marginPt) : undefined,
        offset_x_pt: Number(offX || 0),
        offset_y_pt: Number(offY || 0),
        scale: Number(scale || 1.0),
      };

      // 🔐 Ensure cookies are sent to the protected route
      const res = await fetch('/api/admin/reviews/invites/sheet', {
        method: 'POST',
        credentials: 'include', // <-- important
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json().catch(()=>({}));
        throw new Error(d?.error || res.statusText);
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
    } catch (e:any) {
      setErr(e?.message || String(e));
    } finally {
      setLocalBusy(false);
    }
  };

  return (
    <ToolCard title="17) Sticker Sheet (PDF)" subtitle="Build a printable sheet of QR stickers (Avery presets included).">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Field id="ssMealId" label="meal_id (optional)" value={mealId} onChange={setMealId}/>
        <Field id="ssMealSlug" label="meal_slug (optional)" value={mealSlug} onChange={setMealSlug}/>
        <Field id="ssEmail" label="chef email (fallback)" value={email} onChange={setEmail}/>
        <Field id="ssCount" label="# stickers" value={count} onChange={setCount} validate={(v)=> (Number(v) >= 1 ? null : 'At least 1')}/>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">Template</label>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={template}
            onChange={(e)=> setTemplate(e.target.value)}
          >
            <option value="">Custom grid…</option>
            <option value="avery_5160">Avery 5160 (1&quot;×2⅝&quot;, 30)</option>
            <option value="avery_5163">Avery 5163 (2&quot;×4&quot;, 10)</option>
            <option value="avery_5164">Avery 5164 (3⅓&quot;×4&quot;, 6)</option>
            <option value="avery_5167">Avery 5167 (½&quot;×1¾&quot;, 80)</option>
            <option value="avery_l7160">Avery L7160 (A4, 63.5×38.1mm, 21)</option>
            <option value="avery_22806_round">Avery 22806 (2&quot; round, 12)</option>
          </select>
          <p className="text-xs text-muted-foreground">Choose a preset or define a custom grid.</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Paper</label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={paper}
              onChange={(e)=> setPaper(e.target.value as any)}
            >
              <option value="letter">US Letter</option>
              <option value="a4">A4</option>
            </select>
          </div>
          <Field id="ssRows" label="rows" value={rows} onChange={setRows}/>
          <Field id="ssCols" label="cols" value={cols} onChange={setCols}/>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <Field id="ssBrand" label="brand (top-right)" value={brand} onChange={setBrand} />
        <Field id="ssTitle" label="title (big)" value={title} onChange={setTitle} />
        <Field id="ssChef" label="chef label (optional)" value={chefLabel} onChange={setChefLabel} />
        <div className="flex items-end">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={border} onChange={(e)=> setBorder(e.target.checked)}/>
            borders
          </label>
        </div>
        <Field id="ssMargin" label="margin (pt, custom only)" value={marginPt} onChange={setMarginPt}/>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Field id="ssOffX" label="offset X (pt)" value={offX} onChange={setOffX}/>
        <Field id="ssOffY" label="offset Y (pt)" value={offY} onChange={setOffY}/>
        <Field id="ssScale" label="scale (0.9–1.1)" value={scale} onChange={setScale}/>
        <span className="self-end text-xs text-muted-foreground">Tip: tweak offsets if print drifts.</span>
      </div>

      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}

      <div className="mt-3 flex items-center gap-2">
        <PrimaryButton busy={isBusy || localBusy} disabled={!valid || isBusy || localBusy} onClick={generate}>
          Generate PDF
        </PrimaryButton>
        <SecondaryButton
          onClick={() => {
            setMealId(''); setMealSlug(''); setEmail(''); setCount('30'); setTemplate(''); setPaper('letter');
            setRows('10'); setCols('3'); setBrand('delivered.menu'); setTitle('Scan to review'); setChefLabel(''); setBorder(false); setMarginPt('');
            setOffX('0'); setOffY('0'); setScale('1.0'); setErr(null);
          }}
        >
          Reset
        </SecondaryButton>
      </div>
    </ToolCard>
  );
}
