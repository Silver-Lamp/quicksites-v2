// app/api/admin/prospects/mail-postcards/route.ts
//
// Mail the competition poster (+ QR claim link) to every competing business in a
// geo-industry campaign via Lob. GATED behind POSTCARD_MAIL_ENABLED + LOB_API_KEY —
// it spends money per piece. Marks each prospect postcard_sent_at.

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { getGeoCampaign } from '@/lib/outreach/geoCampaigns';
import { listProspectsByCampaign, markOutreachSent } from '@/lib/outreach/prospects';
import { buildPosterModel, renderPosterHtml, publicBaseUrl } from '@/lib/outreach/competitionPoster';
import { sendPostcard, parseUsAddress, postcardMailEnabled, lobConfigured } from '@/lib/outreach/mail/lob';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_PIECES = 25;

function backHtml(domain: string, claimUrl: string): string {
  // Keep the lower-right clear for Lob's address block.
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box;margin:0;padding:0}
    .b{width:9in;height:6in;padding:.4in;font-family:ui-sans-serif,system-ui,sans-serif;color:#0b1020}
    h2{font-size:16pt} p{margin-top:.12in;font-size:11pt;max-width:5in;color:#334155}
    .u{margin-top:.16in;font-size:10pt;color:#0f766e;word-break:break-all}
  </style></head><body><div class="b">
    <h2>Your website for ${domain} is already built.</h2>
    <p>We built a free, ready-to-launch website for your business. Scan the QR on the front (or visit the link below) to preview it and claim it before a competitor does.</p>
    <div class="u">${claimUrl}</div>
  </div></body></html>`;
}

export async function POST(req: Request) {
  const operator = await getAdminUser();
  if (!operator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (!lobConfigured()) {
    return NextResponse.json({ error: 'Lob is not configured (LOB_API_KEY + LOB_FROM_* required).', code: 'not_configured' }, { status: 501 });
  }
  if (!postcardMailEnabled()) {
    return NextResponse.json({ error: 'Postcard mail is disabled. Set POSTCARD_MAIL_ENABLED=1 to send.', code: 'disabled' }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const campaignId = String(body.campaignId ?? '');
  if (!campaignId) return NextResponse.json({ error: 'A campaignId is required.' }, { status: 400 });

  const campaign = await getGeoCampaign(campaignId);
  if (!campaign) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });

  const prospects = await listProspectsByCampaign(campaignId);
  const model = await buildPosterModel(campaign, prospects);
  if (!model) return NextResponse.json({ error: 'Campaign has no pitch site.' }, { status: 400 });

  const frontHtml = renderPosterHtml(model);
  const back = backHtml(campaign.domain, `${publicBaseUrl()}/r/${campaign.id}`);

  const results: Array<Record<string, unknown>> = [];
  const mailedIds: string[] = [];
  for (const p of prospects.slice(0, MAX_PIECES)) {
    const to = parseUsAddress(p.address, p.city, p.region);
    if (!to) {
      results.push({ prospectId: p.id, ok: false, error: 'unparseable_address' });
      continue;
    }
    try {
      const r = await sendPostcard({
        to: { name: p.business_name, ...to },
        frontHtml,
        backHtml: back,
        description: `Geo-competition ${campaign.domain}`,
      });
      mailedIds.push(p.id);
      results.push({ prospectId: p.id, ok: true, lobId: r.id });
    } catch (e: any) {
      results.push({ prospectId: p.id, ok: false, error: e?.message || 'send_failed' });
    }
  }
  if (mailedIds.length) await markOutreachSent(mailedIds, 'postcard');

  return NextResponse.json({ ok: true, mailed: mailedIds.length, results });
}
