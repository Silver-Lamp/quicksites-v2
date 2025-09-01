#!/usr/bin/env tsx
/**
 * Backfill missing template.industry and template.services.
 *
 * Usage:
 *   pnpm tsx scripts/maintenance/backfill-industry-services.ts
 *   DRY=1 pnpm tsx scripts/maintenance/backfill-industry-services.ts
 *   LIMIT=500 pnpm tsx scripts/maintenance/backfill-industry-services.ts
 *
 * Env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   TEMPLATES_TABLE (optional; default "templates")
 */

import { createClient } from '@supabase/supabase-js';
import { generateServices } from '@/lib/generateServices';

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kcwruliugwidsdgsrthy.supabase.co';
const KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtjd3J1bGl1Z3dpZHNkZ3NydGh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0Nzg5NzQ3MiwiZXhwIjoyMDYzNDczNDcyfQ.FEkCeVDvPay56cVlWCltQcsS7V9Cx5I-Q-yI9QuGSLU';
const TBL  = process.env.TEMPLATES_TABLE || 'templates';
const DRY       = process.env.DRY === '1';
const LIMIT     = Number(process.env.LIMIT || '0');         // 0 = no cap
const PAGE_SIZE = Math.max(10, Number(process.env.PAGE_SIZE || '500'));

if (!URL || !KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

type RowLite = {
  id: string;
  slug?: string | null;
  template_name?: string | null;
  industry?: string | null;
  services?: any; // jsonb, text, or null
};

type RowDataOnly = { data?: any } | null;

const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

/* ------------------------------- helpers ---------------------------------- */

function detectIndustryKey(s?: string | null): string {
  const x = (s || '').toLowerCase();
  if (x.includes('tow')) return 'towing';
  if (x.includes('plumb')) return 'plumbing';
  if (x.includes('bak')) return 'bakery';
  if (x.includes('roof')) return 'roofing';
  if (x.includes('clean')) return 'cleaning';
  if (x.includes('lawn') || x.includes('landsc')) return 'lawncare';
  if (x.includes('auto')) return 'autorepair';
  return 'generic';
}

function coalesceStr(v: any): string {
  return (typeof v === 'string' ? v : '').trim();
}

function isEmptyServices(v: any): boolean {
  if (v == null) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'string') {
    try { const arr = JSON.parse(v); return !Array.isArray(arr) || arr.length === 0; }
    catch { return v.trim() === '' || v.trim() === '[]'; }
  }
  return false;
}

function hasServicesBlockInData(dataVal: any): boolean {
  try {
    const d = typeof dataVal === 'string' ? JSON.parse(dataVal) : (dataVal || {});
    const pages = Array.isArray(d?.pages) ? d.pages : [];
    return pages.some((p: any) =>
      Array.isArray(p?.content_blocks) &&
      p.content_blocks.some((b: any) => String(b?.type) === 'services'));
  } catch {
    return false;
  }
}

async function fetchDataOnly(id: string): Promise<any | null> {
  const { data, error } = await supabase
    .from(TBL)
    .select('data')
    .eq('id', id)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn('[backfill] fetch data failed for', id, error.message);
    return null;
  }
  return (data as RowDataOnly)?.data ?? null;
}

async function patchTemplate(templateId: string, patch: any) {
  if (DRY) return { error: null };
  const { error } = await supabase.from(TBL).update(patch).eq('id', templateId);
  return { error };
}

async function patchIndustryServices(templateId: string, industry: string | null, serviceNames: string[]) {
  if (!industry && serviceNames.length === 0) return;

  // 1) try json/array update for services
  const p1: any = {};
  if (industry != null) p1.industry = industry;
  if (serviceNames.length) p1.services = serviceNames;

  let up = Object.keys(p1).length ? await patchTemplate(templateId, p1) : { error: null as any };
  if (!up.error) return;

  const s = `${up.error?.message || ''} ${up.error?.details || ''}`.toLowerCase();

  // 2) If services column is TEXT, write JSON string
  if (/invalid input.*json/i.test(s) || /type.*json/i.test(s)) {
    const p2: any = {};
    if (industry != null) p2.industry = industry;
    if (serviceNames.length) p2.services = JSON.stringify(serviceNames);
    up = await patchTemplate(templateId, p2);
    if (!up.error) return;
  }

  // 3) If services column missing, try just industry
  if (/column .*services.* does not exist/i.test(s) && industry != null) {
    const p3: any = { industry };
    up = await patchTemplate(templateId, p3);
    if (!up.error) return;
  }

  console.warn('[backfill] patch warning:', templateId, up.error);
}

/* ------------------------------- main loop -------------------------------- */

async function run() {
  let processed = 0, updated = 0;
  let from = 0;

  console.log(`Backfill industry/services on ${TBL} (DRY=${DRY ? 'yes' : 'no'}, PAGE_SIZE=${PAGE_SIZE})`);

  while (true) {
    const to = from + PAGE_SIZE - 1;

    // 🚫 Do NOT select "data" in the main scan — too big and causes JSON parse errors.
    const { data, error } = await supabase
      .from(TBL)
      .select('id, slug, template_name, industry, services')
      .range(from, to);

    if (error) throw error;
    const rows: RowLite[] = (data ?? []) as any[];
    if (rows.length === 0) break;

    for (const r of rows) {
      if (LIMIT && processed >= LIMIT) break;

      processed++;

      const id          = r.id;
      const slug        = coalesceStr(r.slug) || coalesceStr(r.template_name);
      const curIndustry = coalesceStr(r.industry);
      const inferred    = detectIndustryKey(slug);
      const wantIndustry= curIndustry || inferred;
      const needIndustry= !curIndustry && !!wantIndustry;

      // Decide whether we need services:
      //  A) services empty AND we already know an industry -> yes (generate by industry)
      //  B) services empty AND no industry yet -> fetch data only for THIS row to see if a Services block exists
      let needServices = isEmptyServices(r.services) && !!wantIndustry;

      if (isEmptyServices(r.services) && !wantIndustry) {
        // on-demand fetch for a single row (cheap) to avoid huge responses
        const dataOnly = await fetchDataOnly(id);
        if (hasServicesBlockInData(dataOnly)) {
          needServices = true;
        }
      }

      if (!needIndustry && !needServices) continue;

      const serviceNames = needServices
        ? generateServices({ template: { slug, id }, industryLabel: wantIndustry }).map(s => s.name)
        : [];

      await patchIndustryServices(id, needIndustry ? wantIndustry : null, serviceNames);
      updated++;

      if (updated % 50 === 0) {
        console.log(`updated ${updated} / processed ${processed}…`);
      }
    }

    if (LIMIT && processed >= LIMIT) break;
    from += PAGE_SIZE;
  }

  console.log(`Done. processed=${processed}, updated=${updated}, DRY=${DRY ? 'yes' : 'no'}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});