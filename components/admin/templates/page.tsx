// components/admin/templates/page.tsx
import { fetchAllTemplates } from '@/lib/supabase/fetchTemplates';
import TemplateListCard from '@/components/admin/templates/template-list-card';

export default async function TemplatesIndexPage() {
  const templates = await fetchAllTemplates();

  return (
    <div className="max-w-screen-md mx-auto px-6 py-8 space-y-4">
      <h1 className="text-xl font-bold text-white">Your Templates</h1>
      {templates.length === 0 ? (
        <p className="text-sm text-muted-foreground">No templates found.</p>
      ) : (
        <div className="grid gap-3">
          {templates.map((t) => (
            <TemplateListCard key={t.id} template={t} />
          ))}
        </div>
      )}
    </div>
  );
}
