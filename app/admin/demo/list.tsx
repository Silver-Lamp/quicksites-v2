import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { GetServerSideProps } from 'next';
import { Button } from '@/components/ui/button';
import { supabase } from '@/admin/lib/supabaseClient';

export default function DemoList({ templates }: { templates: any[] }) {
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold mb-4">Available Public Demos</h1>
      {templates.map((t) => (
        <div
          key={t.template_name}
          className="flex justify-between items-center border p-4 rounded bg-white shadow-sm flex-wrap gap-4"
        >
          <div>
            <h2 className="text-lg font-semibold">{t.template_name}</h2>
            <p className="text-sm text-muted-foreground">Industry: {t.industry}</p>
            {t.tags?.length && (
              <div className="text-xs text-muted-foreground mt-1 italic">
                Tags: {t.tags.join(', ')}
              </div>
            )}
            {t.featured && <span className="text-xs text-yellow-600 font-bold">★ Featured</span>}
          </div>
          <Link href={`/demo/${t.template_name}`} target="_blank">
            <Button size="sm" variant="outline">
              View Preview
            </Button>
          </Link>
        </div>
      ))}
    </div>
  );
}
