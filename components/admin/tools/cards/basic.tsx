// components/admin/tools/cards/basic.tsx
'use client';

import * as React from 'react';
import { ToolCard, Field, HelpRow, PrimaryButton, SecondaryButton } from '@/components/admin/tools/ui';
import { postJSON, isEmail, passwordIssues, parseUsdToCents, isState2 } from '@/components/admin/tools/utils';

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

  React.useEffect(() => setEmailState(email), [email, setEmailState]);

  const valid = isEmail(email) && !!displayName.trim();

  const handlePromote = () =>
    run('promote-chef', () => {
      const normalizedEmail = email.trim().toLowerCase();
      return postJSON('/api/admin/chefs/promote', {
        email: normalizedEmail,
        display_name: displayName.trim(),
      });
    });

  return (
    <ToolCard title="2) Promote to chef" subtitle="Upgrades an existing user to a Chef. If the user doesn’t exist yet, create them first">
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

/* 4) Create meal */
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
      return postJSON('/api/admin/meals', {
        email: normalizedEmail,
        title: title.trim(),
        price_cents: cents!,        // safe because valid guards on cents !== null
        qty_available: qtyNum,
        // image_url: imageUrl || undefined, // uncomment when backend supports it
      });
    });

  return (
    <ToolCard title="4) Make a meal (for user’s chef)" subtitle="Creates a meal for the chef associated with the given user email.">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field
          id="mm-email" label="Chef user email" value={email} onChange={setEmail}
          autoComplete="email" required
          validate={(v)=> (v && isEmail(v)? null : 'Enter a valid email')}
          example="chef.demo@example.com"
        />
        <Field id="mm-title" label="Meal title" value={title} onChange={setTitle} required example="Citrus Chicken with Herb Rice"/>
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
          'Price accepts “15” or “15.99”; converted to cents.',
          'Quantity must be at least 1.',
        ]}/>
      </div>
    </ToolCard>
  );
}
