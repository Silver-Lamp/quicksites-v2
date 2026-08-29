// app/admin/business-plan/page.tsx
// The plan moved to the public, shareable /business-plan on 2026-08-28. This redirect exists
// so the admin nav, old bookmarks and anything linking here keep working — there is one copy
// of the plan, and a second page would drift from it within a week.
import { redirect } from 'next/navigation';

export default async function AdminBusinessPlanRedirect({
  searchParams,
}: {
  searchParams: Promise<{ v?: string }>;
}) {
  const { v } = await searchParams;
  redirect(v ? `/business-plan?v=${encodeURIComponent(v)}` : '/business-plan');
}
