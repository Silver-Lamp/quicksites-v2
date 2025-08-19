// components/admin/chef/PostScheduleCard.tsx
'use client';


import PostScheduleTab from '@/components/admin/chef/post-schedule-tab';


export default function PostScheduleCard({ siteId }: { siteId: string }) {
return (
<div className="rounded-2xl border p-4">
<h2 className="text-base font-semibold mb-2">Post Scheduling</h2>
{!siteId ? (
<p className="text-sm text-muted-foreground">Enter a Site ID above.</p>
) : (
<PostScheduleTab siteId={siteId} />
)}
</div>
);
}