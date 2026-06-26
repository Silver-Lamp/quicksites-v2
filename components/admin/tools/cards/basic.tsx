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

