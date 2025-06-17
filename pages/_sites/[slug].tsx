// pages/_sites/[slug].tsx
import { GetServerSideProps } from 'next';
import { createClient } from '@supabase/supabase-js';

export default function PublicSite({ siteData }: any) {
  if (!siteData) {
    return (
      <main className="min-h-screen flex items-center justify-center text-white">
        <h1 className="text-xl font-semibold">404: Site not found</h1>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-4">{siteData.business_name}</h1>
      <p className="text-zinc-400 mb-2">{siteData.location}</p>
      <p className="text-zinc-400 mb-6">
        Welcome to {siteData.slug}.quicksites.ai
      </p>

      <pre className="bg-zinc-800 p-4 rounded border border-zinc-700 text-xs overflow-auto">
        {JSON.stringify(siteData, null, 2)}
      </pre>
    </main>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const slug = context.params?.slug as string;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: siteData, error } = await supabase
    .from('sites')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error || !siteData || siteData.published !== true) {
    return {
      props: { siteData: null },
    };
  }

  return {
    props: { siteData },
  };
};
