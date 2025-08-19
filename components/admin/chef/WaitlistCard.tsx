'use client';


import WaitlistTab from '@/components/admin/chef/waitlist-tab';


export default function WaitlistCard({ siteId }: { siteId: string }) {
return (
<div className="rounded-2xl border p-4">
<h2 className="text-base font-semibold mb-2">Waitlist</h2>
{!siteId ? (
<p className="text-sm text-muted-foreground">Enter a Site ID above.</p>
) : (
<WaitlistTab siteId={siteId} />
)}
</div>
);
}