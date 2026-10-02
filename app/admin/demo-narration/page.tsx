// app/admin/demo-narration/page.tsx
//
// Record narration for the demo clips, one scripted line at a time, against the footage.

import { redirect } from 'next/navigation';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { signInHref } from '@/lib/auth/authLinks';
import { createClient } from '@supabase/supabase-js';
import NarrationStudio, { type StudioClip } from './narration-studio';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Demo narration · QuickSites admin' };

export default async function DemoNarrationPage() {
  const admin = await getAdminUser();
  if (!admin) redirect(signInHref('/admin/demo-narration'));

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data } = await db
    .from('features')
    .select('slug, title, video_url, demo_clips')
    .not('demo_clips', 'is', null);

  // One entry per CLIP, not per feature: the same recording can be attached to more than one
  // feature, and narration belongs to the recording.
  const bySrc = new Map<string, StudioClip>();
  for (const row of (data ?? []) as any[]) {
    for (const c of Array.isArray(row.demo_clips) ? row.demo_clips : []) {
      if (!c?.src || bySrc.has(c.src)) continue;
      bySrc.set(c.src, {
        src: c.src,
        poster: c.poster ?? null,
        label: c.label ?? 'Walkthrough',
        recordedOn: c.recorded_on ?? null,
        manifestUrl: c.manifest ?? null,
        durationSeconds: c.duration_seconds ?? null,
        feature: row.title ?? row.slug,
      });
    }
  }

  return <NarrationStudio clips={[...bySrc.values()]} />;
}
