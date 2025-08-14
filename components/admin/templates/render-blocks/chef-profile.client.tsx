// components/admin/templates/render-blocks/chef-profile.client.tsx
'use client';
import React from 'react';

type Props = { chefId?: string; chefSlug?: string };

export default function ChefProfileClient(props: Props) {
  const [chef, setChef] = React.useState<any>(null);
  const [err, setErr] = React.useState<string|null>(null);

  React.useEffect(() => {
    if (!props.chefId && !props.chefSlug) return;
    const p = new URLSearchParams();
    if (props.chefId) p.set('chef_id', props.chefId);
    if (props.chefSlug) p.set('chef_slug', props.chefSlug);
    fetch(`/api/public/chefs/show?${p.toString()}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject('Chef not found'))
      .then(setChef)
      .catch(e => setErr(String(e)));
  }, [props.chefId, props.chefSlug]);

  if (!props.chefId && !props.chefSlug) {
    return <div className="border rounded-md p-3 bg-amber-50 text-sm">
      <b>Chef Profile</b> — set <code>chefId</code> or <code>chefSlug</code> in block settings.
    </div>;
  }
  if (err) return <div className="border rounded-md p-3 text-sm text-red-600">{err}</div>;
  if (!chef) return <div className="border rounded-md p-3 text-sm text-muted-foreground">Loading…</div>;

  return (
    <article className="border rounded-2xl p-4 bg-white">
      <h3 className="text-lg font-semibold">{chef.name}</h3>
      {chef.bio && <p className="text-sm mt-1">{chef.bio}</p>}
    </article>
  );
}
