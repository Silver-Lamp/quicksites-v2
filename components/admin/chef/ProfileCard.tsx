// components/admin/chef/ProfileCard.tsx
'use client';


import ChefProfileManager from '@/components/admin/chef/chef-profile-manager';


export default function ProfileCard() {
return (
<div className="rounded-2xl border p-4">
<h2 className="text-base font-semibold mb-2">My Profile</h2>
<p className="text-sm text-muted-foreground mb-3">Update your public profile shown on delivered.menu.</p>
<ChefProfileManager />
</div>
);
}