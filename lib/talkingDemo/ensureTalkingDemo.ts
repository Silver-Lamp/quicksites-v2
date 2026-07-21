// lib/talkingDemo/ensureTalkingDemo.ts
//
// Idempotent, flag-gated, best-effort "make sure this site has a Talking Demo" — the reusable
// primitive behind auto-generation (on rebuild, or when an outreach postcard is created). Renders
// the tour + MP4 reel via HJ once and persists it to templates.data.meta.talking_demo, then returns
// the public watch URL + a scannable QR. Cheap on repeat: HJ caches by instance_ref (the template id),
// and this skips entirely if a reel is already saved.
//
// SAFE BY DEFAULT: OFF unless TALKING_DEMO_AUTOGEN_ENABLED=1, no-op when the render rails aren't
// configured, and swallows every error (never blocks a rebuild/mailing). MP4 render is billed, so
// keep this behind the flag + trigger it only for sites you'll actually reach out about.

import QRCode from 'qrcode';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { commitTemplatePatch } from '@/lib/templates/commitTemplatePatch';
import { buildTalkingDemoScript } from '@/lib/talkingDemo/buildTourScript';
import { renderTalkingDemo, pollTalkingDemo, talkingDemoRenderConfigured } from '@/lib/talkingDemo/renderClient';

const str = (v: any): string => (typeof v === 'string' ? v.trim() : '');

export function talkingDemoAutogenEnabled(): boolean {
  return process.env.TALKING_DEMO_AUTOGEN_ENABLED === '1' || process.env.TALKING_DEMO_AUTOGEN_ENABLED === 'true';
}

export type EnsureResult = { watch_url: string; qr_data_url: string; mp4_url: string | null } | null;

/**
 * Ensure a Talking Demo exists for a template (by id or slug). Returns the watch URL + QR, or null
 * if disabled / not configured / no slug / any failure. Pass { force:true } to re-render even if one
 * exists; { actorId } for the commit actor. Never throws.
 */
export async function ensureTalkingDemo(
  ref: string,
  opts: { force?: boolean; actorId?: string | null; wantMp4?: boolean } = {},
): Promise<EnsureResult> {
  try {
    if (!talkingDemoAutogenEnabled() || !talkingDemoRenderConfigured()) return null;
    const id = str(ref);
    if (!id) return null;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const sel = (supabaseAdmin as any).from('templates').select('id, slug, rev, data, business_name, template_name');
    const { data: tpl, error } = await (isUuid ? sel.eq('id', id) : sel.eq('slug', id)).maybeSingle();
    if (error || !tpl || !str(tpl.slug)) return null;

    const base = (process.env.NEXT_PUBLIC_APP_BASE_URL || 'https://www.quicksites.ai').replace(/\/+$/, '');
    const watch_url = `${base}/watch/${str(tpl.slug)}`;

    // Already have one? Reuse it (idempotent) unless forced.
    const existing = tpl?.data?.meta?.talking_demo;
    if (!opts.force && existing?.mp4_url) {
      const qr_data_url = await QRCode.toDataURL(watch_url, { width: 640, margin: 1, errorCorrectionLevel: 'M' });
      return { watch_url, qr_data_url, mp4_url: str(existing.mp4_url) };
    }

    const businessName = str(tpl.business_name) || str(tpl.template_name) || 'this business';
    const blocks: any[] = tpl?.data?.pages?.[0]?.blocks ?? tpl?.data?.blocks ?? [];
    const wantMp4 = opts.wantMp4 !== false;
    const script = buildTalkingDemoScript({
      instanceRef: str(tpl.id),
      businessName,
      blocks,
      wantMp4,
      pageUrl: `${base}/sites/${str(tpl.slug)}`,
    });

    let render: any = await renderTalkingDemo(script);
    for (let i = 0; wantMp4 && i < 30 && render.mp4_status === 'rendering'; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      render = await pollTalkingDemo(render.instance_id);
    }

    const talking_demo = {
      mp4_url: str(render.mp4_url) || null,
      poster_url: str(render.poster_url) || null,
      steps: Array.isArray(render.steps) ? render.steps : [],
      instance_id: str(render.instance_id) || null,
      generated_at: new Date().toISOString(),
    };
    const newData = { ...(tpl.data ?? {}), meta: { ...(tpl.data?.meta ?? {}), talking_demo } };
    const err = await commitTemplatePatch(tpl.id, tpl.rev ?? 0, { data: newData }, opts.actorId ?? null);
    if (err) return null;

    const qr_data_url = await QRCode.toDataURL(watch_url, { width: 640, margin: 1, errorCorrectionLevel: 'M' });
    return { watch_url, qr_data_url, mp4_url: talking_demo.mp4_url };
  } catch {
    return null; // best-effort — never block the caller
  }
}
