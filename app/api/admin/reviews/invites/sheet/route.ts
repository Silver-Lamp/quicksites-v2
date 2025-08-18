import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import PDFDocument from 'pdfkit';
import QR from 'qrcode';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { PassThrough } from 'stream';
import { Database } from '@/types/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Supa = ReturnType<typeof createServerClient<Database>>;

const pt = (inches: number) => inches * 72;
const mm = (n: number) => (n / 25.4) * 72;

type AveryTemplate = {
  name: string;
  page: 'letter' | 'a4';
  cols: number;
  rows: number;
  label_w: number;  // points
  label_h: number;  // points
  margin_left: number; // points
  margin_top: number;  // points
  h_pitch: number;     // points between left edges
  v_pitch: number;     // points between top edges
  round?: boolean;     // draw a circle border (22806)
};

// Common Avery presets (measured; minor printers vary → use offsets below if needed)
const AVERY_TEMPLATES: Record<string, AveryTemplate> = {
  // Avery 5160 — Address Labels, 1" x 2-5/8", 3×10 = 30/sheet
  avery_5160: {
    name: 'Avery 5160 (1" × 2⅝", 30/sheet)',
    page: 'letter',
    cols: 3, rows: 10,
    label_w: pt(2.625), label_h: pt(1),
    margin_left: pt(0.1875), margin_top: pt(0.5),
    h_pitch: pt(2.75), v_pitch: pt(1),
  },
  // Avery 5163 — Shipping, 2" x 4", 2×5 = 10/sheet
  avery_5163: {
    name: 'Avery 5163 (2" × 4", 10/sheet)',
    page: 'letter',
    cols: 2, rows: 5,
    label_w: pt(4), label_h: pt(2),
    margin_left: pt(0.1875), margin_top: pt(0.5),
    h_pitch: pt(4.125), v_pitch: pt(2),
  },
  // Avery 5164 — Shipping, 3⅓" x 4", 2×3 = 6/sheet
  avery_5164: {
    name: 'Avery 5164 (3⅓" × 4", 6/sheet)',
    page: 'letter',
    cols: 2, rows: 3,
    label_w: pt(4), label_h: pt(3 + 1/3), // 3.333…"
    margin_left: pt(0.1875), margin_top: pt(0.5),
    h_pitch: pt(4.125), v_pitch: pt(3 + 1/3),
  },
  // Avery 5167 — Return Address, ½" x 1¾", 4×20 = 80/sheet
  avery_5167: {
    name: 'Avery 5167 (½" × 1¾", 80/sheet)',
    page: 'letter',
    cols: 4, rows: 20,
    label_w: pt(1.75), label_h: pt(0.5),
    margin_left: pt(0.1875), margin_top: pt(0.5),
    h_pitch: pt(2), v_pitch: pt(0.5),
  },
  // Avery L7160 — A4 Address, 63.5 mm × 38.1 mm, 3×7 = 21/sheet
  avery_l7160: {
    name: 'Avery L7160 (63.5×38.1mm, 21/sheet, A4)',
    page: 'a4',
    cols: 3, rows: 7,
    label_w: mm(63.5), label_h: mm(38.1),
    margin_left: mm(5.0), margin_top: mm(12.0),
    h_pitch: mm(70.0), v_pitch: mm(38.1),
  },
  // Avery 22806 — Round, 2" diameter, 3×4 = 12/sheet (approx grid)
  avery_22806_round: {
    name: 'Avery 22806 (2" round, 12/sheet)',
    page: 'letter',
    cols: 3, rows: 4,
    label_w: pt(2), label_h: pt(2),
    margin_left: pt(0.5), margin_top: pt(0.5),
    h_pitch: pt(2.5), v_pitch: pt(2.5),
    round: true,
  },
};

async function assertAdmin() {
  const store = await cookies();
  const supa = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieEncoding: 'base64url',
      cookies: {
        getAll() {
          return store.getAll().map(({ name, value }) => ({ name, value }));
        },
        setAll(cookies) {
          for (const c of cookies) {
            store.set(c.name, c.value, c.options as CookieOptions | undefined);
          }
        },
      },
    }
  );
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return { code: 401 as const, error: 'Not signed in' };
  const { data: admin } = await supa.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
  if (!admin) return { code: 403 as const, error: 'Forbidden' };
  return { code: 200 as const, supa, user };
}

async function resolveMeal({ supa, meal_id, meal_slug, email }:{
  supa: Supa; meal_id?: string; meal_slug?: string; email?: string;
}) {
  if (meal_id) {
    const { data } = await supa.from('meals')
      .select('id, site_id, chef_id, merchant_id, title, slug')
      .eq('id', meal_id).maybeSingle();
    return data;
  }
  if (meal_slug) {
    const { data } = await supa.from('meals')
      .select('id, site_id, chef_id, merchant_id, title, slug')
      .eq('slug', meal_slug).maybeSingle();
    return data;
  }
  if (email) {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const u = list?.users?.find(x => x.email?.toLowerCase() === email.toLowerCase());
    if (!u) return null;
    const { data: chef } = await supa.from('chefs').select('id').eq('user_id', u.id).maybeSingle();
    if (!chef) return null;
    const { data: meal } = await supa
      .from('meals')
      .select('id, site_id, chef_id, merchant_id, title, slug')
      .eq('chef_id', chef.id as string)
      .order('created_at', { ascending: false })
      .maybeSingle();
    return meal ?? null;
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureInvites(supa: Supa, meal: any, count: number, expiresInDays: number) {
  const base = (process.env.APP_BASE_URL || '').replace(/\/+$/,'');
  const { data: existing } = await supa.from('review_invites')
    .select('id, token, expires_at, status')
    .eq('meal_id', meal.id)
    .in('status', ['active','queued'])
    .limit(count);

  let invites = existing ?? [];
  const need = Math.max(0, count - invites.length);

  if (need > 0) {
    const now = Date.now();
    const exp = new Date(now + Math.max(1, expiresInDays) * 24*3600*1000).toISOString();
    const rows = Array.from({ length: need }, () => ({
      id: randomUUID(),
      token: randomUUID(),
      meal_id: meal.id,
      chef_id: meal.chef_id,
      site_id: meal.site_id,
      status: 'active',
      created_at: new Date().toISOString(),
      expires_at: exp,
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supa.from('review_invites').insert(rows as any);
    if (!error) invites = [...invites, ...rows];
  }

  return invites.map(r => ({
    token: r.token,
    url: meal.slug
      ? `${base}/reviews/start?t=${r.token}&s=${encodeURIComponent(meal.slug)}`
      : `${base}/reviews/start?t=${r.token}&m=${meal.id}`
  }));
}

export async function POST(req: NextRequest) {
  const gate = await assertAdmin();
  if (gate.code !== 200) return NextResponse.json({ error: gate.error }, { status: gate.code });
  const supa = gate.supa! as ReturnType<typeof createServerClient<Database>>;

  const body = await req.json().catch(() => ({}));
  const {
    meal_id, meal_slug, email,

    // NEW — template-driven layout (overrides rows/cols/paper/label sizes)
    template,                       // e.g., 'avery_5160'

    // Fine-tuning
    offset_x_pt = 0,                // shift all labels horizontally (points)
    offset_y_pt = 0,                // shift vertically (points)
    scale = 1.0,                    // scale within each label (0.9..1.1)

    // Fallbacks for custom layout (used if no template is provided)
    paper = 'letter',
    margin_pt,
    rows = 10,
    cols = 3,

    // How many stickers (defaults: template rows*cols or rows*cols)
    count,

    expires_in_days = 90,
    brand = 'delivered.menu',
    title = 'Scan to review',
    chef_label,
    border = false,
  } = body || {};

  const meal = await resolveMeal({ supa, meal_id, meal_slug, email });
  if (!meal) return NextResponse.json({ error: 'meal not found' }, { status: 404 });

  // Chef label
  let chefName = chef_label;
  if (!chefName) {
    const { data: chef } = await supa.from('chefs').select('display_name').eq('id', meal.chef_id).maybeSingle();
    chefName = chef?.display_name || undefined;
  }

  // Layout from template or generic grid
  let colsN = cols, rowsN = rows;
  let pageSize: [number, number] = [612, 792]; // US Letter
  let marginLeft = typeof margin_pt === 'number' ? margin_pt : 36;
  let marginTop  = typeof margin_pt === 'number' ? margin_pt : 36;
  let labelW = 0, labelH = 0, hPitch = 0, vPitch = 0, isRound = false;

  if (template && AVERY_TEMPLATES[template]) {
    const t = AVERY_TEMPLATES[template];
    colsN = t.cols; rowsN = t.rows;
    pageSize = t.page === 'a4' ? [mm(210), mm(297)] : [612, 792];
    marginLeft = t.margin_left; marginTop = t.margin_top;
    labelW = t.label_w; labelH = t.label_h;
    hPitch = t.h_pitch; vPitch = t.v_pitch;
    isRound = !!t.round;
  } else {
    // Generic even grid (previous behavior)
    const docW = pageSize[0], docH = pageSize[1];
    const innerW = docW - marginLeft * 2;
    const innerH = docH - marginTop * 2;
    labelW = innerW / colsN;
    labelH = innerH / rowsN;
    hPitch = labelW; vPitch = labelH;
  }

  const howMany = Math.max(1, Number(count ?? (colsN * rowsN)));
  const invites = await ensureInvites(supa, meal, howMany, Number(expires_in_days) || 90);

  // PDF & stream setup
  const stream = new PassThrough();
  const doc = new PDFDocument({ size: pageSize, margin: 0, bufferPages: true });
  doc.pipe(stream);
  doc.font('Helvetica');

  const pad = 8; // internal padding inside label
  const baseHost = (process.env.APP_BASE_URL || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');

  async function drawStickerRect(x: number, y: number, w: number, h: number, url: string) {
    const inset = 0; // no bleed
    const cx = x + inset + offset_x_pt;
    const cy = y + inset + offset_y_pt;
    const cw = w - inset * 2;
    const ch = h - inset * 2;

    if (border) doc.save().roundedRect(cx + 0.5, cy + 0.5, cw - 1, ch - 1, 6).stroke('#DDDDDD').restore();

    const qrSize = Math.min(ch - pad * 2, cw * 0.5) * scale;
    const qx = cx + pad;
    const qy = cy + (ch - qrSize) / 2;

    // QR
    const dataUrl = await QR.toDataURL(url, { margin: 0, scale: 6 });
    const png = Buffer.from(dataUrl.split(',')[1], 'base64');
    doc.image(png, qx, qy, { fit: [qrSize, qrSize] });

    // Text to the right
    const tx = qx + qrSize + pad;
    const tw = Math.max(0, cw - (qrSize + pad * 3));
    const ty = cy + pad;

    doc.fillColor('#111').fontSize(9).text(brand, tx, ty, { width: tw, height: 12, ellipsis: true });
    doc.fontSize(12).fillColor('#111').text(title, tx, ty + 12, { width: tw });
    const subtitle = chefName ? `${meal?.title} — ${chefName}` : meal?.title;
    doc.fontSize(9).fillColor('#555').text(subtitle, tx, ty + 28, { width: tw, ellipsis: true });

    doc.fontSize(8).fillColor('#777')
      .text(baseHost ? baseHost + '/reviews' : 'Scan to review', tx, cy + ch - pad - 10, { width: tw, align: 'left' });
  }

  async function drawStickerRound(x: number, y: number, d: number, url: string) {
    const r = d / 2;
    const cx = x + offset_x_pt + r;
    const cy = y + offset_y_pt + r;

    if (border) doc.save().circle(cx, cy, r - 0.5).stroke('#DDDDDD').restore();

    // Layout: QR at top, text stacked below inside circle
    const qrSize = d * 0.6 * scale;
    const qx = cx - qrSize / 2;
    const qy = cy - qrSize * 0.75;

    const dataUrl = await QR.toDataURL(url, { margin: 0, scale: 6 });
    const png = Buffer.from(dataUrl.split(',')[1], 'base64');
    doc.image(png, qx, qy, { fit: [qrSize, qrSize] });

    const tw = d * 0.9;
    const tx = cx - tw / 2;
    let ty = cy + qrSize * 0.05;

    doc.fillColor('#111').fontSize(8).text(brand, tx, ty, { width: tw, align: 'center' }); ty += 10;
    doc.fontSize(11).fillColor('#111').text(title, tx, ty, { width: tw, align: 'center' }); ty += 14;
    const subtitle = chefName ? `${meal?.title} — ${chefName}` : meal?.title;
    doc.fontSize(7.5).fillColor('#555').text(subtitle, tx, ty, { width: tw, align: 'center', ellipsis: true });
  }

  for (let i = 0; i < invites.length; i++) {
    if (i > 0 && i % (colsN * rowsN) === 0) doc.addPage({ size: pageSize, margin: 0 });
    const pageIndex = Math.floor(i / (colsN * rowsN));
    const local = i - pageIndex * colsN * rowsN;

    const r = Math.floor(local / colsN);
    const c = local % colsN;

    const x = marginLeft + c * hPitch;
    const y = marginTop  + r * vPitch;

    if (isRound) {
      // Use the smaller of w/h as diameter (templates set w = h)
      await drawStickerRound(x, y, Math.min(labelW, labelH), invites[i].url);
    } else {
      await drawStickerRect(x, y, labelW, labelH, invites[i].url);
    }
  }

  doc.end();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new NextResponse(stream as any, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="review-stickers-${meal.slug || meal.id}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
