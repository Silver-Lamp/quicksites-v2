// pages/embed/[id].tsx
import { useSearchParams } from 'next/navigation';
import Head from 'next/head';

export default async function Page() {
  const searchParams = useSearchParams();
  const id = searchParams?.get('id') as string;
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
