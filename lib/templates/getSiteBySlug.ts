// lib/templates/getSiteBySlug.ts
import { headers } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/admin';

const norm = (s?: string | null) => (s ?? '').trim().toLowerCase();

export async function getSiteBySlug(slug: string) {
  const s = norm(slug);
  let { data } = await supabaseAdmin.from('templates').select('*').eq('slug', s).eq('is_site', true).limit(1).maybeSingle();
  if (!data) {
    const r2 = await supabaseAdmin.from('templates').select('*').eq('base_slug', s).eq('is_site', true).limit(1).maybeSingle();
    data = r2.data ?? null;
  }
  if (!data) {
    try {
      const h = await headers();
      const host = norm(h.get('x-forwarded-host') ?? h.get('host')).replace(/^www\./, '');
      if (host) {
        const r3 = await supabaseAdmin.from('templates')
          .select('*')
          .in('domain_lc', [host, `www.${host}`])
          .eq('is_site', true)
          .limit(1)
          .maybeSingle();
        data = r3.data ?? null;
      }
    } catch {}
  }
  return data ?? null;
}
