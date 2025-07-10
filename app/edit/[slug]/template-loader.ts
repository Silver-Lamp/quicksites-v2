// app/edit/[slug]/template-loader.ts
'use server';

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies as nextCookies } from 'next/headers';
import type { Database } from '@/types/supabase';

export async function fetchTemplateBySlug(slug: string) {
  const cookieStore = nextCookies(); // This is fine — `cookies()` returns a store, no need to await anymore in latest Next.js (as of v14+).
  
  const supabase = createServerComponentClient<Database>({
    cookies: () => cookieStore, // ⬅️ wrap it like this
  });

  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !data) {
    console.error('.:. Supabase fetchTemplateBySlug error:', error);
    return null;
  }

  return data;
}
