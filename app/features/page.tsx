// app/features/page.tsx
import Link from 'next/link';
import Image from 'next/image';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import FeatureGalleryClient from './client-gallery';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const revalidate = 60;

type FeatureRow = {
  id: string;
  title: string;
  blurb: string;
  category: string;
  video_url?: string | null;
  doc_href?: string | null;
  badge?: string | null;
  featured?: boolean | null;
  feature_order?: number | null;
  created_at?: string | null;
};

export default async function FeaturesPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // using the deprecated interface in older @supabase/ssr builds
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options?: any) {
          cookieStore.set({ name, value, ...(options ?? {}) });
        },
        remove(name: string, options?: any) {
          cookieStore.set({ name, value: '', ...(options ?? {}) });
        },
      },
    }
  );

  const { data, error } = await supabase
    .from('features')
    .select('*')
    .order('featured', { ascending: false })
    .order('feature_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    return (
      <div className="relative">
        {/* Top header */}
        <header className="sticky top-0 z-40 border-b border-zinc-800/40 backdrop-blur bg-black/10">
          <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/favicon.ico" alt="QuickSites" width={24} height={24} className="rounded" />
              <span className="text-sm text-zinc-300">QuickSites</span>
            </Link>
            <Link href="/" className="inline-flex">
              <Button variant="ghost" size="sm">← Back home</Button>
            </Link>
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-6 py-10">
          <Card className="border-zinc-800/50">
            <CardContent className="py-10 text-center text-red-500">
              Failed to load features: {error.message}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Top header */}
      <header className="border-b border-zinc-800/40">
        <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/favicon.ico" alt="QuickSites" width={24} height={24} className="rounded" />
            <span className="text-sm text-zinc-300">QuickSites</span>
          </Link>
          <Link href="/" className="inline-flex">
            <Button variant="ghost" size="sm">← Back home</Button>
          </Link>
        </div>
      </header>

      <FeatureGalleryClient initialRows={(data ?? []) as FeatureRow[]} />
    </div>
  );
}
