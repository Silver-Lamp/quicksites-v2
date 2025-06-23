import { createClient } from '@supabase/supabase-js';
import { GetServerSideProps } from 'next';
import { Button } from '@/components/ui/button';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Trash({ templates }: { templates: any[] }) {
  const restoreTemplate = async (template_name: string) => {
    const toast = (await import('react-hot-toast')).default;

    const res = await fetch('/api/templates/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_name }),
    });

    if (res.ok) {
      toast.success('Template restored.');
      setTimeout(() => window.location.reload(), 1000);
    } else {
      toast.error('Restore failed.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold mb-4">Deleted Templates</h1>
      {templates.map((t) => (
        <div
          key={t.template_name}
          className="flex justify-between items-center border p-4 rounded bg-white shadow-sm"
        >
          <div>
            <h2 className="text-lg font-semibold">{t.template_name}</h2>
            <p className="text-sm text-muted-foreground">Industry: {t.industry}</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => restoreTemplate(t.template_name)}>
            Restore
          </Button>
        </div>
      ))}
    </div>
  );
}
