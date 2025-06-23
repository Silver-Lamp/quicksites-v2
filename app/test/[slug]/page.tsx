// app/test/[slug]/page.tsx

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function Page(
  props: Promise<{ params: { slug: string } }>
) {
  const { params } = await props;
  return <div>slug: {params.slug}</div>;
}
