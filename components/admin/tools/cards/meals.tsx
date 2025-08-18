// components/admin/tools/cards/meals.tsx
'use client';

import * as React from 'react';
import { ToolCard, Field, HelpRow, PrimaryButton, SecondaryButton } from '@/components/admin/tools/ui';
import { postJSON, isEmail } from '@/components/admin/tools/utils';

/* helpers */
const targetOk = (mealId:string, mealSlug:string, email:string) =>
  !!mealId.trim() || !!mealSlug.trim() || (email.trim() && isEmail(email));
const normalizeEmail = (e:string) => e.trim().toLowerCase();

/* 5) Create demo reviews */
export function CreateDemoReviewsCard({
  run, isBusy, emailState, setEmailState
}:{
  run:(label:string, fn:()=>Promise<any>)=>void;
  isBusy:boolean;
  emailState:string;
  setEmailState:(v:string)=>void;
}) {
  const [mealId, setMealId]   = React.useState('');
  const [mealSlug, setMealSlug] = React.useState('');
  const [email, setEmail]     = React.useState(emailState || 'chef.demo@example.com');
  const [count, setCount]     = React.useState('3');

  React.useEffect(() => setEmailState(email), [email, setEmailState]);

  const countNum = Number(count);
  const countOk  = Number.isFinite(countNum) && countNum >= 1;
  const valid    = targetOk(mealId, mealSlug, email) && countOk;

  const handleCreate = () =>
    run('create-reviews', () => postJSON('/api/admin/reviews', {
      meal_id:  mealId.trim()  ? mealId  : undefined,
      meal_slug:mealSlug.trim()? mealSlug: undefined,
      email:    email.trim()   ? normalizeEmail(email) : undefined,
      count:    Math.max(1, countNum || 0),
    }));

  return (
    <ToolCard title="5) Create demo reviews" subtitle="Provide a meal ID/slug, or the chef’s email to use their most recent meal.">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field id="dr-meal-id"   label="meal_id (optional)"  value={mealId}   onChange={setMealId}   placeholder="uuid"/>
        <Field id="dr-meal-slug" label="meal_slug (optional)"value={mealSlug} onChange={setMealSlug} placeholder="slug"/>
        <Field id="dr-email"     label="Chef email (fallback)" value={email} onChange={setEmail}
               placeholder="used if ID/slug omitted"
               validate={(v)=> (v && !isEmail(v)? 'Invalid email' : null)}
               example="chef.demo@example.com"/>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field id="dr-count" label="# reviews" value={count} onChange={setCount}
               placeholder="e.g. 3" validate={(v)=> (Number(v) >= 1 ? null : 'At least 1')} example="3"/>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <PrimaryButton busy={isBusy} disabled={!valid || isBusy} onClick={handleCreate}>
          Create demo reviews
        </PrimaryButton>
        <SecondaryButton onClick={() => {
          setMealId(''); setMealSlug(''); setEmail('chef.demo@example.com'); setCount('3');
        }}>
          Fill demo values
        </SecondaryButton>
      </div>
      <div className="mt-4">
        <HelpRow items={[
          'Target a specific meal via ID or slug.',
          'If both blank, a valid email lets backend use the chef’s most recent meal.',
          'Keep counts small for realism (e.g., 3–8).',
        ]}/>
      </div>
    </ToolCard>
  );
}

/* 6) Restock + waitlist */
export function RestockMealCard({
  run, isBusy, emailState, setEmailState
}:{
  run:(label:string, fn:()=>Promise<any>)=>void;
  isBusy:boolean;
  emailState:string;
  setEmailState:(v:string)=>void;
}) {
  const [mealId, setMealId]     = React.useState('');
  const [mealSlug, setMealSlug] = React.useState('');
  const [email, setEmail]       = React.useState(emailState || 'chef.demo@example.com');
  const [qty, setQty]           = React.useState('10');

  React.useEffect(() => setEmailState(email), [email, setEmailState]);

  const qtyNum = Number(qty);
  const qtyOk  = Number.isFinite(qtyNum) && qtyNum >= 1;
  const valid  = targetOk(mealId, mealSlug, email) && qtyOk;

  const handleRestock = () =>
    run('restock', () => postJSON('/api/admin/meals/restock', {
      meal_id:   mealId.trim()   ? mealId   : undefined,
      meal_slug: mealSlug.trim() ? mealSlug : undefined,
      email:     email.trim()    ? normalizeEmail(email) : undefined,
      qty:       Math.max(1, qtyNum || 0),
      is_active: true,
    }));

  return (
    <ToolCard title="6) Restock a meal & queue waitlist" subtitle="Adds quantity, marks active, and enqueues waitlist notifications.">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Field id="rs-meal-id"   label="meal_id (optional)" value={mealId}   onChange={setMealId}   placeholder="uuid"/>
        <Field id="rs-meal-slug" label="meal_slug (optional)" value={mealSlug} onChange={setMealSlug} placeholder="slug"/>
        <Field id="rs-email"     label="Chef email (fallback)" value={email} onChange={setEmail}
               placeholder="used if ID/slug omitted"
               validate={(v)=> (v && !isEmail(v)? 'Invalid email' : null)}
               example="chef.demo@example.com"/>
        <Field id="rs-qty"       label="qty_available" value={qty} onChange={setQty}
               placeholder="e.g. 10" validate={(v)=> (Number(v) >= 1 ? null : 'Must be at least 1')}/>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <PrimaryButton busy={isBusy} disabled={!valid || isBusy} onClick={handleRestock}>
          Restock & enqueue waitlist
        </PrimaryButton>
        <SecondaryButton onClick={() => {
          setMealId(''); setMealSlug(''); setEmail('chef.demo@example.com'); setQty('10');
        }}>
          Fill demo values
        </SecondaryButton>
      </div>
      <div className="mt-4">
        <HelpRow items={[
          'Provide ID/slug; otherwise a valid email targets the most recent meal for that chef.',
          'Sets meal to active=true.',
        ]}/>
      </div>
    </ToolCard>
  );
}

/* 7) Send restock emails now */
export function SendRestockEmailsCard({
  run, isBusy, emailState, setEmailState
}:{
  run:(label:string, fn:()=>Promise<any>)=>void;
  isBusy:boolean;
  emailState:string;
  setEmailState:(v:string)=>void;
}) {
  const [mealId, setMealId]     = React.useState('');
  const [mealSlug, setMealSlug] = React.useState('');
  const [email, setEmail]       = React.useState(emailState || 'chef.demo@example.com');
  const [limit, setLimit]       = React.useState('50');

  React.useEffect(() => setEmailState(email), [email, setEmailState]);

  const limitNum = Number(limit);
  const limitOk  = Number.isFinite(limitNum) && limitNum >= 1;
  const valid    = targetOk(mealId, mealSlug, email) && limitOk;

  const handleSend = () =>
    run('send-restock', () => postJSON('/api/admin/emails/restock', {
      meal_id:   mealId.trim()   ? mealId   : undefined,
      meal_slug: mealSlug.trim() ? mealSlug : undefined,
      email:     email.trim()    ? normalizeEmail(email) : undefined,
      limit:     Math.max(1, limitNum || 0),
    }));

  return (
    <ToolCard title="7) Send restock emails now" subtitle="Sends to active waitlist subscribers for the meal.">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Field id="se-meal-id"   label="meal_id (optional)" value={mealId}   onChange={setMealId}   placeholder="uuid"/>
        <Field id="se-meal-slug" label="meal_slug (optional)" value={mealSlug} onChange={setMealSlug} placeholder="slug"/>
        <Field id="se-email"     label="Chef email (fallback)" value={email} onChange={setEmail}
               placeholder="used if ID/slug omitted"
               validate={(v)=> (v && !isEmail(v)? 'Invalid email' : null)}
               example="chef.demo@example.com"/>
        <Field id="se-limit"     label="send limit" value={limit} onChange={setLimit}
               placeholder="e.g. 50" validate={(v)=> (Number(v) >= 1 ? null : 'At least 1')}/>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <PrimaryButton busy={isBusy} disabled={!valid || isBusy} onClick={handleSend}>
          Send restock emails
        </PrimaryButton>
        <SecondaryButton onClick={() => {
          setMealId(''); setMealSlug(''); setEmail('chef.demo@example.com'); setLimit('50');
        }}>
          Fill demo values
        </SecondaryButton>
      </div>
      <div className="mt-4">
        <HelpRow items={[
          'Target via ID/slug; with a valid email, backend can use the chef’s most recent meal.',
          'Limit throttles the batch size.',
        ]}/>
      </div>
    </ToolCard>
  );
}
