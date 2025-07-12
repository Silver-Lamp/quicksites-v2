// import { GetServerSideProps } from 'next';
import TemplatePreview from '@/components/admin/templates/template-preview';
import { ScrollArea } from '@/components/ui';
// import { supabase } from '@/admin/lib/supabaseClient';

export default function DemoTemplate({ data, slug }: { data: any; slug: string }) {
  if (!data) return <p className="p-6">No template found for: {slug}</p>;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-xl font-semibold mb-4">Preview: {slug}</h1>
      <ScrollArea className="h-[600px] border rounded bg-white">
        <TemplatePreview data={data} colorScheme={data.color_scheme || 'slate'} onBlockClick={(block) => {
          console.log('block: ', block);
        }} showJsonFallback={true} />
      </ScrollArea>
    </div>
  );
}
