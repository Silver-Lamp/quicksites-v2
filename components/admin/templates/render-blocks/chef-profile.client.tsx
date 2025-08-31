// components/admin/templates/render-blocks/chef-profile.client.tsx
'use client';
import React from 'react';
import dynamic from 'next/dynamic';
import { useCartStore } from '@/components/cart/cart-store';
import ChefProfileView, { ChefProfileContent } from './chef-profile.view';

const ChefCouponBadge = dynamic(
  () => import('@/components/public/chef-coupon-badge'),
  { ssr: false }
);

export default function ChefProfileClient({ chefId, chefSlug }: { chefId?: string; chefSlug?: string }) {
  const [chef, setChef] = React.useState<any>(null);
  const [err, setErr] = React.useState<string|null>(null);
  const { couponCode } = useCartStore();

  React.useEffect(() => {
    if (!chefId && !chefSlug) return;
    const p = new URLSearchParams();
    if (chefId) p.set('chef_id', chefId);
    if (chefSlug) p.set('chef_slug', chefSlug);
    fetch(`/api/public/chefs/show?${p.toString()}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject('Chef not found'))
      .then(setChef)
      .catch(e => setErr(String(e)));
  }, [chefId, chefSlug]);

  if (!chefId && !chefSlug) {
    return <div className="border rounded-md p-3 bg-amber-50 text-sm">
      <b>Chef Profile</b> — set <code>chefId</code> or <code>chefSlug</code> in block settings.
    </div>;
  }
  if (err) return <div className="border rounded-md p-3 text-sm text-red-600">{err}</div>;
  if (!chef) return <div className="border rounded-md p-3 text-sm text-muted-foreground">Loading…</div>;

  const content: ChefProfileContent = {
    name: chef.name,
    location: chef.location ?? '',
    profile_image_url: chef.profile_image_url ?? '/images/placeholder-avatar.png',
    kitchen_video_url: chef.kitchen_video_url ?? undefined,
    bio: chef.bio ?? '',
    certifications: chef.certifications ?? [],
    meals: chef.meals ?? [],
    merchant_id: chef.merchant_id,
  };

  return (
    <ChefProfileView
      content={content}
      colorMode="light"
      couponBadge={couponCode ? <ChefCouponBadge merchantId={chef.merchant_id} /> : null}
    />
  );
}
