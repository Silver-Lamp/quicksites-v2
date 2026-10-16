// app/admin/ab/page.tsx — the homepage A/B test: switch it on, set the B variant, read the
// numbers. Owner, 2026-10-16. Counts are unique VISITORS per variant from `ab_events`
// (DB-backed; PostHog mirrors), never hits. Admin page; the layout gates on an admin session.
import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getHomepageAb, setHomepageAb, loadAbSummary, HOMEPAGE_AB_KEY } from '@/lib/ab/homepageDb';
import { getSiteSetting } from '@/lib/settings/siteSettings';

export const dynamic = 'force-dynamic';

export async function saveHomepageAb(formData: FormData) {
  'use server';
  const raw = (await getSiteSetting<Record<string, any>>(HOMEPAGE_AB_KEY, {})) ?? {};
  const enabled = formData.get('enabled') === 'on';
  const next = {
    ...raw,
    enabled,
    split_b: Number(formData.get('split_b') ?? 50),
    note: String(formData.get('note') ?? ''),
    started_at: enabled ? raw.started_at ?? new Date().toISOString() : raw.started_at ?? null,
    b: {
      video_url: String(formData.get('video_url') ?? '').trim(),
      poster_url: String(formData.get('poster_url') ?? '').trim(),
      headline: String(formData.get('headline') ?? '').trim(),
      subhead: String(formData.get('subhead') ?? '').trim(),
      has_audio: formData.get('has_audio') === 'on',
    },
  };
  await setHomepageAb(next, null);
  revalidatePath('/admin/ab');
  revalidatePath('/');
}

const pct = (r: number | null) => (r == null ? '—' : `${(r * 100).toFixed(1)}%`);

export default async function HomepageAbPage() {
  const [settings, raw, rows] = await Promise.all([getHomepageAb(), getSiteSetting<Record<string, any>>(HOMEPAGE_AB_KEY, {}), loadAbSummary()]);
  const b = raw?.b ?? {};
  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Homepage A/B</h1>
          <p className="text-sm text-muted-foreground">
            A is the homepage as it is. B swaps the hero background for a looping video (muted until the visitor asks for sound) and may change the headline. New visitors are split by the percentage below and stay on their variant for 180 days.
          </p>
        </div>
        <Link href="/" target="_blank" rel="noreferrer"><Button variant="outline">Open homepage</Button></Link>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Status</CardTitle>
          <CardDescription>
            {settings.enabled ? `Running since ${settings.started_at ?? '?'} · ${settings.split_b}% of new visitors see B` : 'Off — everyone sees A'}
            {!settings.b && raw?.enabled ? ' · B is missing a video or poster URL, so the test is OFF until both are https URLs.' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Variant</TableHead>
                <TableHead className="text-right">Visitors shown</TableHead>
                <TableHead className="text-right">Clicked CTA</TableHead>
                <TableHead className="text-right">Started a build</TableHead>
                <TableHead className="text-right">CTA rate</TableHead>
                <TableHead className="text-right">Build rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.variant}>
                  <TableCell className="font-medium">{r.variant}</TableCell>
                  <TableCell className="text-right">{r.exposures}</TableCell>
                  <TableCell className="text-right">{r.cta_click}</TableCell>
                  <TableCell className="text-right">{r.guest_build_started}</TableCell>
                  <TableCell className="text-right">{pct(r.cta_rate)}</TableCell>
                  <TableCell className="text-right">{pct(r.build_rate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">Unique visitors, automation dropped by user agent. Read nothing into a difference under a few hundred visitors per side.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Settings</CardTitle>
          <CardDescription>Both URLs must be https. Upload files to storage first (the videos / site-images buckets) and paste the public URLs.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveHomepageAb} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input type="checkbox" name="enabled" defaultChecked={raw?.enabled === true} /> Test is on
            </label>
            <div>
              <Label htmlFor="split_b">Percent of new visitors who get B</Label>
              <Input id="split_b" name="split_b" type="number" min={0} max={100} defaultValue={settings.split_b} className="mt-1" />
            </div>
            <label className="flex items-center gap-2 self-end text-sm">
              <input type="checkbox" name="has_audio" defaultChecked={b.has_audio === true} /> The video has an audio track (shows the sound toggle)
            </label>
            <div className="md:col-span-2">
              <Label htmlFor="video_url">B video URL (mp4, short, loops)</Label>
              <Input id="video_url" name="video_url" defaultValue={b.video_url ?? ''} placeholder="https://…/videos/home-ab/b-hero.mp4" className="mt-1" />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="poster_url">B poster image URL (first frame)</Label>
              <Input id="poster_url" name="poster_url" defaultValue={b.poster_url ?? ''} placeholder="https://…/site-images/home-ab/b-hero.png" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="headline">B headline (blank = same as A)</Label>
              <Input id="headline" name="headline" defaultValue={b.headline ?? ''} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="subhead">B subhead (blank = same as A)</Label>
              <Input id="subhead" name="subhead" defaultValue={b.subhead ?? ''} className="mt-1" />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="note">Note (what B is testing)</Label>
              <Textarea id="note" name="note" defaultValue={settings.note ?? ''} className="mt-1" rows={2} />
            </div>
            <div className="md:col-span-2"><Button type="submit">Save</Button></div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
