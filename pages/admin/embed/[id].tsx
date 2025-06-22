// pages/embed/[id].tsx
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { supabase } from '@/admin/lib/supabaseClient';
import { createClient } from '@supabase/supabase-js';

// const PlaygroundFrame = dynamic(() => import('@/components/admin/zod-playground/PlaygroundFrame'), { ssr: false });

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const id = ctx.params?.id as string;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase
    .from('schema_links')
    .select('*')
    .eq('id', id)
    .eq('visibility', 'public')
    .single();

  if (error || !data) {
    return {
      notFound: true,
    };
  }

  return {
    props: {
      id,
    },
  };
};

export default function EmbedPage({ id }: { id: string }) {
  const url = `/admin/zod-playground?schema_id=${id}&embed=1`;
  return (
    <>
      <Head>
        <title>Embedded Schema</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="min-h-screen">
        <iframe
          src={url}
          width="100%"
          height="1000"
          style={{ border: 'none' }}
          title={`Zod Playground - ${id}`}
        />
      </div>
    </>
  );
}
