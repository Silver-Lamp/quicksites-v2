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


