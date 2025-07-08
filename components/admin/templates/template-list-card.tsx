// components/admin/templates/template-list-card.tsx
import QueryLink from '@/components/query-link';
import { z } from 'zod';

export default function TemplateListCard({
  template,
}: {
  template: { id: string; slug: string; template_name: string; updated_at: string; industry?: string };
}) {
  return (
    <QueryLink
      pathname={`/admin/templates/${template.slug}`}
      params={{}}
      schema={z.object({})} // or remove if params are unused
      className="block border rounded px-4 py-3 hover:bg-white/5 transition"
    >
      <div className="text-sm font-semibold text-white">{template.template_name}</div>
      <div className="text-xs text-zinc-400">
        {template.industry || 'General'} • Updated{' '}
        {new Date(template.updated_at).toLocaleDateString()}
      </div>
    </QueryLink>
  );
}
