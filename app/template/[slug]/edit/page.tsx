// app/template/[slug]/edit/page.tsx
import EditWrapper from '@/components/admin/templates/edit-wrapper';

export default function EditPage({ params }: { params: { slug: string } }) {
  return <EditWrapper slug={params.slug} />;
}
