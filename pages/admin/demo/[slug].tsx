import { GetServerSideProps } from 'next';
import { createClient } from '@supabase/supabase-js';
import TemplatePreview from '../../components/templates/TemplatePreview';
import { ScrollArea } from '../../components/ui/scroll-area';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function DemoTemplate({ data, slug }: { data: any; slug: string }) {
  if (!data) return <p className="p-6">No template found for: {slug}</p>;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-xl font-semibold mb-4">Preview: {slug}</h1>
      <ScrollArea className="h-[600px] border rounded bg-white">
        <TemplatePreview data={data} colorScheme={data.color_scheme || 'slate'} />
      </ScrollArea>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const slug = context.params?.slug;
  const { data, error } = await supabase
    .from('templates')
    .select('data')
    .eq('template_name', slug)
    .single();

  return {
    props: {
      slug,
      data: data?.data || null
    }
  };
};
