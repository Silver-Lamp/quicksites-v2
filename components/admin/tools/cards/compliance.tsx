// components/admin/tools/cards/compliance.tsx
'use client';

import * as React from 'react';
import { ToolCard, Field, HelpRow, PrimaryButton, SecondaryButton } from '@/components/admin/tools/ui';
import { postJSON, isEmail } from '@/components/admin/tools/utils';

/* 8) Mark compliance doc */
export function MarkComplianceDocCard({
  run, isBusy, emailState, setEmailState,
}: {
  run:(label:string, fn:()=>Promise<any>)=>void;
  isBusy:boolean;
  emailState:string;
  setEmailState:(v:string)=>void;
}) {
  const [email, setEmail] = React.useState(emailState || 'chef.demo@example.com');
  const [code, setCode] = React.useState('INSURANCE_GPL');
  const [status, setStatus] = React.useState<'approved'|'expired'|'pending'|'rejected'>('approved');
  const [expires, setExpires] = React.useState('180');
  const [kind, setKind] = React.useState('');

  React.useEffect(() => setEmailState(email), [email, setEmailState]);

  const expiresOk = Number.isFinite(Number(expires)) && Number(expires) >= 1;
  const valid = isEmail(email) && !!code.trim() && expiresOk;

  const handleSave = () =>
    run('mark-doc', () => {
      const normalizedEmail = email.trim().toLowerCase();
      const codeUpper = code.trim().toUpperCase();
      const days = Math.max(1, Number(expires) || 0);
      return postJSON('/api/admin/compliance/docs/mark', {
        email: normalizedEmail,
        code: codeUpper,
        status,
        expires_in_days: days,
        kind: kind.trim() ? kind.trim() : undefined,
      });
    });

  return (
    <ToolCard title="8) Mark compliance doc" subtitle="Approve / expire / set pending / reject a requirement by code for a merchant.">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Field id="md-email" label="Merchant user email" value={email} onChange={setEmail} required validate={(v)=> (v && isEmail(v)? null : 'Invalid email')}/>
        <div className="space-y-1">
          <label className="text-sm font-medium">Requirement code</label>
          <input
            list="req-codes"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={code}
            onChange={(e)=> setCode(e.target.value)}
            placeholder="e.g. INSURANCE_GPL"
          />
          <datalist id="req-codes">
            <option value="INSURANCE_GPL" />
            <option value="FOOD_HANDLER_CARD" />
            <option value="PERMIT_HEALTH" />
            <option value="AI_ENDORSEMENT" />
          </datalist>
          <p className="text-xs text-muted-foreground">Free text with suggestions. Uppercased on submit.</p>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Status</label>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={status}
            onChange={(e)=> setStatus(e.target.value as any)}
          >
            <option value="approved">approved</option>
            <option value="expired">expired</option>
            <option value="pending">pending</option>
            <option value="rejected">rejected</option>
          </select>
        </div>
        <Field
          id="md-expires"
          label="Expires in (days)"
          value={expires}
          onChange={setExpires}
          placeholder="e.g. 180"
          validate={(v)=> (Number(v) >= 1 ? null : 'At least 1')}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field id="md-kind" label="Kind (optional)" value={kind} onChange={setKind} placeholder="e.g. AI ENDORSEMENT"/>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <PrimaryButton busy={isBusy} disabled={!valid || isBusy} onClick={handleSave}>
          Save doc
        </PrimaryButton>
        <SecondaryButton onClick={() => { setEmail('chef.demo@example.com'); setCode('INSURANCE_GPL'); setStatus('approved'); setExpires('180'); setKind(''); }}>
          Fill demo values
        </SecondaryButton>
      </div>
      <div className="mt-4">
        <HelpRow items={[
          'Codes are flexible—use your internal enum.',
          'Typical validity is 90–365 days depending on requirement.',
        ]}/>
      </div>
    </ToolCard>
  );
}

/* 9) Seed compliance set */
export function SeedComplianceSetCard({
  run, isBusy, emailState, setEmailState,
}: {
  run:(label:string, fn:()=>Promise<any>)=>void;
  isBusy:boolean;
  emailState:string;
  setEmailState:(v:string)=>void;
}) {
  const [email, setEmail] = React.useState(emailState || 'chef.demo@example.com');
  const [scenario, setScenario] = React.useState<'ok'|'blocked'|'mixed'>('ok');
  const [days, setDays] = React.useState('180');

  React.useEffect(() => setEmailState(email), [email, setEmailState]);

  const daysOk = Number.isFinite(Number(days)) && Number(days) >= 1;
  const valid = isEmail(email) && (scenario === 'blocked' || daysOk);

  const handleSeed = () =>
    run('seed-compliance', () => {
      const normalizedEmail = email.trim().toLowerCase();
      const payload: any = { email: normalizedEmail, scenario };
      if (scenario !== 'blocked') payload.valid_days = Math.max(1, Number(days) || 0);
      return postJSON('/api/admin/compliance/seed', payload);
    });

  return (
    <ToolCard title="9) Seed compliance set" subtitle="Quickly make a merchant OK / Blocked / Mixed.">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field id="sc-email" label="Merchant user email" value={email} onChange={setEmail} required validate={(v)=> (v && isEmail(v)? null : 'Invalid email')}/>
        <div className="space-y-1">
          <label className="text-sm font-medium">Scenario</label>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={scenario}
            onChange={(e)=> setScenario(e.target.value as any)}
          >
            <option value="ok">ok</option>
            <option value="blocked">blocked</option>
            <option value="mixed">mixed</option>
          </select>
        </div>
        <Field
          id="sc-days"
          label="Valid days"
          value={days}
          onChange={setDays}
          placeholder="for ok/mixed"
          validate={(v)=> (scenario==='blocked'||Number(v)>=1?null:'At least 1')}
          help={scenario==='blocked' ? 'Ignored for blocked.' : 'Used for ok/mixed sets.'}
        />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <PrimaryButton busy={isBusy} disabled={!valid || isBusy} onClick={handleSeed}>
          Seed compliance
        </PrimaryButton>
        <SecondaryButton onClick={() => { setEmail('chef.demo@example.com'); setScenario('ok'); setDays('180'); }}>
          Fill demo values
        </SecondaryButton>
      </div>
      <div className="mt-4">
        <HelpRow items={[
          'OK = all requirements valid.',
          'Blocked = critical items failed/expired.',
          'Mixed = a few pending/expired to test UI states.',
        ]}/>
      </div>
    </ToolCard>
  );
}

/* 10) Deactivate a meal */
export function DeactivateMealCard({
  run, isBusy, emailState, setEmailState,
}: {
  run:(label:string, fn:()=>Promise<any>)=>void;
  isBusy:boolean;
  emailState:string;
  setEmailState:(v:string)=>void;
}) {
  const [mealId, setMealId] = React.useState('');
  const [mealSlug, setMealSlug] = React.useState('');
  const [email, setEmail] = React.useState(emailState || 'chef.demo@example.com');
  const [qty, setQty] = React.useState('');

  React.useEffect(() => setEmailState(email), [email, setEmailState]);

  const haveTarget = !!mealId.trim() || !!mealSlug.trim() || (email.trim() && isEmail(email));
  const qtyOk = !qty.trim() || (!isNaN(Number(qty)) && Number(qty) >= 0);
  const valid = haveTarget && qtyOk;
  const qtyNum = qty.trim() ? Number(qty) : undefined;

  const handleDeactivate = () =>
    run('deactivate-meal', () => {
      const normalized = email.trim() ? email.trim().toLowerCase() : '';
      return postJSON('/api/admin/meals/deactivate', {
        meal_id: mealId || undefined,
        meal_slug: mealSlug || undefined,
        email: normalized || undefined,
        qty: typeof qtyNum === 'number' ? qtyNum : undefined,
      });
    });

  return (
    <ToolCard title="10) Deactivate a meal" subtitle="Marks the meal inactive. Optionally force-set a specific quantity.">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Field id="dm-meal-id" label="meal_id (optional)" value={mealId} onChange={setMealId} placeholder="uuid"/>
        <Field id="dm-meal-slug" label="meal_slug (optional)" value={mealSlug} onChange={setMealSlug} placeholder="slug"/>
        <Field id="dm-email" label="Chef email (fallback)" value={email} onChange={setEmail} placeholder="used if ID/slug omitted" validate={(v)=> (v && !isEmail(v)? 'Invalid email' : null)}/>
        <Field id="dm-qty" label="set qty to (optional)" value={qty} onChange={setQty} placeholder="leave blank to keep as-is" validate={(v)=> (!v || Number(v) >= 0 ? null : 'Must be ≥ 0')}/>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <PrimaryButton busy={isBusy} disabled={!valid || isBusy} onClick={handleDeactivate}>
          Deactivate meal
        </PrimaryButton>
        <SecondaryButton onClick={() => { setMealId(''); setMealSlug(''); setEmail('chef.demo@example.com'); setQty(''); }}>
          Fill demo values
        </SecondaryButton>
      </div>
      <div className="mt-4">
        <HelpRow items={[
          'Provide ID/slug; with only email, backend may target the most recent meal.',
          'Leaving qty blank keeps current inventory unchanged.',
        ]}/>
      </div>
    </ToolCard>
  );
}

/* 11) Create AI Endorsement */
export function CreateAiEndorsementCard({
  run, isBusy, emailState, setEmailState,
}: {
  run:(label:string, fn:()=>Promise<any>)=>void;
  isBusy:boolean;
  emailState:string;
  setEmailState:(v:string)=>void;
}) {
  const [email, setEmail] = React.useState(emailState || 'chef.demo@example.com');
  const [days, setDays] = React.useState('180');

  React.useEffect(() => setEmailState(email), [email, setEmailState]);

  const daysOk = Number.isFinite(Number(days)) && Number(days) >= 1;
  const valid = isEmail(email) && daysOk;

  const handleCreate = () =>
    run('endorsement', () => {
      const normalizedEmail = email.trim().toLowerCase();
      return postJSON('/api/admin/compliance/docs/endorsement', {
        email: normalizedEmail,
        expires_in_days: Math.max(1, Number(days) || 0),
      });
    });

  return (
    <ToolCard title="11) Create AI Endorsement (Insurance)" subtitle="Creates an insurance endorsement document for the merchant.">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field id="ae-email" label="Merchant user email" value={email} onChange={setEmail} required validate={(v)=> (v && isEmail(v)? null : 'Invalid email')}/>
        <Field id="ae-days" label="Expires in (days)" value={days} onChange={setDays} placeholder="e.g. 180" validate={(v)=> (Number(v) >= 1 ? null : 'At least 1')}/>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <PrimaryButton busy={isBusy} disabled={!valid || isBusy} onClick={handleCreate}>
          Create AI endorsement
        </PrimaryButton>
        <SecondaryButton onClick={() => { setEmail('chef.demo@example.com'); setDays('180'); }}>
          Fill demo values
        </SecondaryButton>
      </div>
    </ToolCard>
  );
}

/* 12) Approve ALL requirements */
export function ApproveAllRequirementsCard({
  run, isBusy, emailState, setEmailState,
}: {
  run:(label:string, fn:()=>Promise<any>)=>void;
  isBusy:boolean;
  emailState:string;
  setEmailState:(v:string)=>void;
}) {
  const [email, setEmail] = React.useState(emailState || 'chef.demo@example.com');
  const [days, setDays] = React.useState('365');
  const [includeAi, setIncludeAi] = React.useState(true);

  React.useEffect(() => setEmailState(email), [email, setEmailState]);

  const daysOk = Number.isFinite(Number(days)) && Number(days) >= 1;
  const valid = isEmail(email) && daysOk;

  const handleApprove = () =>
    run('approve-all', () => {
      const normalizedEmail = email.trim().toLowerCase();
      return postJSON('/api/admin/compliance/approve_all', {
        email: normalizedEmail,
        valid_days: Math.max(1, Number(days) || 0),
        include_ai_endorsement: includeAi,
      });
    });

  return (
    <ToolCard title="12) Approve ALL requirements" subtitle="Marks all requirements valid for a set period. Optionally includes AI endorsement.">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field id="aa-email" label="Merchant user email" value={email} onChange={setEmail} required validate={(v)=> (v && isEmail(v)? null : 'Invalid email')}/>
        <Field id="aa-days" label="Valid days" value={days} onChange={setDays} placeholder="e.g. 365" validate={(v)=> (Number(v) >= 1 ? null : 'At least 1')}/>
        <div className="flex items-end">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={includeAi} onChange={(e)=> setIncludeAi(e.target.checked)}/> include AI endorsement
          </label>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <PrimaryButton busy={isBusy} disabled={!valid || isBusy} onClick={handleApprove}>
          Approve all
        </PrimaryButton>
        <SecondaryButton onClick={() => { setEmail('chef.demo@example.com'); setDays('365'); setIncludeAi(true); }}>
          Fill demo values
        </SecondaryButton>
      </div>
    </ToolCard>
  );
}
