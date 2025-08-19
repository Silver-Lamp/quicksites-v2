// components/admin/chef/SocialConnectorsCard.tsx
'use client';


import SocialConnectors from '@/components/admin/chef/social-connectors';


export default function SocialConnectorsCard({ siteId }: { siteId: string }) {
return (
<div className="rounded-2xl border p-4">
<h2 className="text-base font-semibold mb-2">Social Connectors</h2>
<p className="text-sm text-muted-foreground mb-3">
Add Slack, Discord, or any service that accepts a webhook (Zapier/Make/IFTTT/Buffer).
</p>
{!siteId ? (
<p className="text-sm text-muted-foreground">Enter a Site ID above.</p>
) : (
<SocialConnectors siteId={siteId} />
)}
</div>
);
}