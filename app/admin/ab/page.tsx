// app/admin/ab/page.tsx — A/B tests: one for the QuickSites homepage, and one per SITE
// (`?template=<id>`, reachable from the editor's 🧪 A/B button). Owner, 2026-10-16. Counts are
// unique VISITORS per variant from `ab_events` (DB-backed; PostHog mirrors), never hits.
import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getHomepageAb, setHomepageAb, loadAbSummary, HOMEPAGE_AB_KEY } from '@/lib/ab/homepageDb';
import { getSiteAb, setSiteAb, listSiteAbTests, siteSummary } from '@/lib/ab/siteAbDb';
import { siteExperimentId } from '@/lib/ab/siteAb';
import { getSiteSetting } from '@/lib/settings/siteSettings';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { AbSummaryRow } from '@/lib/ab/homepage';

export const dynamic = 'force-dynamic';

export async function saveHomepageAb(formData: FormData) {
  'use server';
  const raw = (await getSiteSetting<Record<string, any>>(HOMEPAGE_AB_KEY, {})) ?? {};
  const enabled = formData.get('enabled') === 'on';
  await setHomepageAb({
    ...raw,
    enabled,
    split_b: Number(formData.get('split_b') ?? 50),
    note: String(formData.get('note') ?? ''),
    started_at: enabled ? raw.started_at ?? new Date().toISOString() : raw.started_at ?? null,
    b: { video_url: String(formData.get('video_url') ?? '').trim(), poster_url: String(formData.get('poster_url') ?? '').trim(), headline: String(formData.get('headline') ?? '').trim(), subhead: String(formData.get('subhead') ?? '').trim(), has_audio: formData.get('has_audio') === 'on' },
  }, null);
  revalidatePath('/admin/ab');
  revalidatePath('/');
}

export async function saveSiteAb(formData: FormData) {
  'use server';
  const templateId = String(formData.get('template_id') ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(templateId)) return;
  const current = await getSiteAb(templateId);
  const enabled = formData.get('enabled') === 'on';
  await setSiteAb(templateId, {
    enabled,
    split_b: Number(formData.get('split_b') ?? 50),
    note: String(formData.get('note') ?? ''),
    started_at: enabled ? current.started_at ?? new Date().toISOString() : current.started_at ?? null,
    b: {
      hero: {
        video_url: String(formData.get('video_url') ?? '').trim(),
        poster_url: String(formData.get('poster_url') ?? '').trim(),
        image_url: String(formData.get('image_url') ?? '').trim(),
        headline: String(formData.get('headline') ?? '').trim(),
        subheadline: String(formData.get('subheadline') ?? '').trim(),
        cta_text: String(formData.get('cta_text') ?? '').trim(),
        layout_mode: String(formData.get('layout_mode') ?? 'background'),
        has_audio: formData.get('has_audio') === 'on',
      },
    },
  }, null);
  revalidatePath('/admin/ab');
}

const pct = (r: number | null) => (r == null ? '—' : `${(r * 100).toFixed(1)}%`);

function Results({ rows, buildLabel }: { rows: AbSummaryRow[]; buildLabel: string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Variant</TableHead>
          <TableHead className="text-right">Visitors shown</TableHead>
          <TableHead className="text-right">Clicked CTA</TableHead>
          <TableHead className="text-right">{buildLabel}</TableHead>
          <TableHead className="text-right">CTA rate</TableHead>
          <TableHead className="text-right">{buildLabel} rate</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const conv = buildLabel === 'Started a build' ? r.guest_build_started : r.form_submitted;
          const rate = buildLabel === 'Started a build' ? r.build_rate : r.form_rate;
          return (
            <TableRow key={r.variant}>
              <TableCell className="font-medium">{r.variant}</TableCell>
              <TableCell className="text-right">{r.exposures}</TableCell>
              <TableCell className="text-right">{r.cta_click}</TableCell>
              <TableCell className="text-right">{conv}</TableCell>
              <TableCell className="text-right">{pct(r.cta_rate)}</TableCell>
              <TableCell className="text-right">{pct(rate)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export default async function AbPage({ searchParams }: { searchParams: { template?: string } }) {
  const templateId = typeof searchParams.template === 'string' && /^[0-9a-f-]{36}$/i.test(searchParams.template) ? searchParams.template : null;

  if (templateId) {
    const [test, rows, tpl] = await Promise.all([getSiteAb(templateId), siteSummary(templateId), supabaseAdmin.from('templates').select('slug, business_name, template_name, custom_domain, published').eq('id', templateId).maybeSingle()]);
    const t: any = tpl.data ?? {};
    const { data: rawRow } = await supabaseAdmin.from('template_ab_tests').select('b, enabled').eq('template_id', templateId).maybeSingle();
    const h: any = (rawRow as any)?.b?.hero ?? {};
    const liveUrl = t.custom_domain ? `https://${t.custom_domain}/` : t.slug ? `https://www.quicksites.ai/sites/${t.slug}` : null;
    return (
      <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">A/B test — {t.business_name || t.template_name || templateId}</h1>
            <p className="text-sm text-muted-foreground">A is the home page as published. B is the same page with the hero swapped for what you set below. New visitors are split by the percentage and stay on their variant for 180 days. {t.published ? '' : 'This site is not published, so nobody will see B yet.'}</p>
            <p className="mt-1 text-xs text-muted-foreground">See either one yourself with <code>?ab=A</code> / <code>?ab=B</code> on any page, or <code>/a</code> and <code>/b</code> on the site. Previews are not counted and set no cookie.</p>
          </div>
          <div className="flex gap-2">
            <Link href={`/admin/templates/${templateId}`}><Button variant="outline">Editor</Button></Link>
            {liveUrl ? <a href={liveUrl} target="_blank" rel="noreferrer"><Button variant="outline">Open site</Button></a> : null}
            {liveUrl ? <a href={`${liveUrl}${liveUrl.includes('?') ? '&' : '?'}ab=A`} target="_blank" rel="noreferrer"><Button variant="outline">Preview A</Button></a> : null}
            {liveUrl ? <a href={`${liveUrl}${liveUrl.includes('?') ? '&' : '?'}ab=B`} target="_blank" rel="noreferrer"><Button variant="outline">Preview B</Button></a> : null}
            <Link href="/admin/ab"><Button variant="ghost">All tests</Button></Link>
          </div>
        </div>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Results</CardTitle>
            <CardDescription>{test.enabled ? `Running since ${test.started_at ?? '?'} · ${test.split_b}% of new visitors see B` : 'Off — everyone sees A'}{(rawRow as any)?.enabled && !test.b ? ' · B has no https video or image, so the test is OFF until it does.' : ''}</CardDescription>
          </CardHeader>
          <CardContent>
            <Results rows={rows} buildLabel="Submitted the form" />
            <p className="mt-3 text-xs text-muted-foreground">Unique visitors, automation dropped by user agent. Read nothing into a difference under a few hundred visitors per side.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Variant B hero</CardTitle>
            <CardDescription>Only the hero changes. Leave a field blank to keep A's value. URLs must be https; upload to the videos / site-images buckets first.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={saveSiteAb} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <input type="hidden" name="template_id" value={templateId} />
              <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" name="enabled" defaultChecked={(rawRow as any)?.enabled === true} /> Test is on</label>
              <div><Label htmlFor="split_b">Percent of new visitors who get B</Label><Input id="split_b" name="split_b" type="number" min={0} max={100} defaultValue={test.split_b} className="mt-1" /></div>
              <div>
                <Label htmlFor="layout_mode">Hero layout for B</Label>
                <select id="layout_mode" name="layout_mode" defaultValue={h.layout_mode ?? 'background'} className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm">
                  <option value="background">Video/image as background (boxed)</option>
                  <option value="full_bleed">Video/image full-bleed</option>
                  <option value="media_split">Media split (small image, tilted cards)</option>
                  <option value="inline">Inline image</option>
                </select>
              </div>
              <div className="md:col-span-2"><Label htmlFor="video_url">Background video URL (mp4, short, loops; muted)</Label><Input id="video_url" name="video_url" defaultValue={h.video_url ?? ''} className="mt-1" /></div>
              <div><Label htmlFor="poster_url">Video poster URL (first frame)</Label><Input id="poster_url" name="poster_url" defaultValue={h.poster_url ?? ''} className="mt-1" /></div>
              <div><Label htmlFor="image_url">Hero image URL (when no video)</Label><Input id="image_url" name="image_url" defaultValue={h.image_url ?? ''} className="mt-1" /></div>
              <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" name="has_audio" defaultChecked={h.has_audio === true} /> The video has an audio track (shows the "tap for sound" toggle)</label>
              <div><Label htmlFor="headline">Headline</Label><Input id="headline" name="headline" defaultValue={h.headline ?? ''} className="mt-1" /></div>
              <div><Label htmlFor="cta_text">Button text</Label><Input id="cta_text" name="cta_text" defaultValue={h.cta_text ?? ''} className="mt-1" /></div>
              <div className="md:col-span-2"><Label htmlFor="subheadline">Subheadline</Label><Input id="subheadline" name="subheadline" defaultValue={h.subheadline ?? ''} className="mt-1" /></div>
              <div className="md:col-span-2"><Label htmlFor="note">Note (what B is testing)</Label><Textarea id="note" name="note" defaultValue={test.note ?? ''} rows={2} className="mt-1" /></div>
              <div className="md:col-span-2"><Button type="submit">Save</Button></div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [settings, raw, rows, siteTests] = await Promise.all([getHomepageAb(), getSiteSetting<Record<string, any>>(HOMEPAGE_AB_KEY, {}), loadAbSummary(), listSiteAbTests()]);
  const b = raw?.b ?? {};
  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">A/B tests</h1>
        <p className="text-sm text-muted-foreground">One per site (open a site in the editor and press 🧪 A/B), plus the QuickSites homepage below. Counts are unique visitors.</p>
      </div>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Site tests</CardTitle><CardDescription>{siteTests.length ? `${siteTests.length} configured` : 'None yet — open a site in the editor and press 🧪 A/B.'}</CardDescription></CardHeader>
        <CardContent>
          {siteTests.length ? (
            <Table>
              <TableHeader><TableRow><TableHead>Site</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Split B</TableHead><TableHead>Note</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {siteTests.map((t) => (
                  <TableRow key={t.templateId}>
                    <TableCell className="font-medium">{t.name ?? t.slug ?? t.templateId}</TableCell>
                    <TableCell>{t.enabled ? 'Running' : 'Off'}</TableCell>
                    <TableCell className="text-right">{t.split_b}%</TableCell>
                    <TableCell className="max-w-[20rem] truncate text-muted-foreground">{t.note ?? ''}</TableCell>
                    <TableCell><Link href={`/admin/ab?template=${t.templateId}`}><Button size="sm" variant="outline">Open</Button></Link></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">QuickSites homepage</CardTitle>
          <CardDescription>{settings.enabled ? `Running since ${settings.started_at ?? '?'} · ${settings.split_b}% of new visitors see B` : 'Off — everyone sees A'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Results rows={rows} buildLabel="Started a build" />
          <form action={saveHomepageAb} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" name="enabled" defaultChecked={raw?.enabled === true} /> Test is on</label>
            <div><Label htmlFor="h_split_b">Percent of new visitors who get B</Label><Input id="h_split_b" name="split_b" type="number" min={0} max={100} defaultValue={settings.split_b} className="mt-1" /></div>
            <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" name="has_audio" defaultChecked={b.has_audio === true} /> The video has an audio track</label>
            <div className="md:col-span-2"><Label htmlFor="h_video_url">B video URL</Label><Input id="h_video_url" name="video_url" defaultValue={b.video_url ?? ''} className="mt-1" /></div>
            <div className="md:col-span-2"><Label htmlFor="h_poster_url">B poster image URL</Label><Input id="h_poster_url" name="poster_url" defaultValue={b.poster_url ?? ''} className="mt-1" /></div>
            <div><Label htmlFor="h_headline">B headline</Label><Input id="h_headline" name="headline" defaultValue={b.headline ?? ''} className="mt-1" /></div>
            <div><Label htmlFor="h_subhead">B subhead</Label><Input id="h_subhead" name="subhead" defaultValue={b.subhead ?? ''} className="mt-1" /></div>
            <div className="md:col-span-2"><Label htmlFor="h_note">Note</Label><Textarea id="h_note" name="note" defaultValue={settings.note ?? ''} rows={2} className="mt-1" /></div>
            <div className="md:col-span-2"><Button type="submit">Save</Button></div>
          </form>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">Experiments are named {siteExperimentId('<template id>')} and homepage_hero in ab_events.</p>
    </div>
  );
}
