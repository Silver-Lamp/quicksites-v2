import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui';
import { Button } from '@/components/ui';
import TemplateEditor from '@/components/admin/templates/template-editor';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function TemplatesPage() {
  const [templateList, setTemplateList] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('templates')
      .select('template_name')
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setTemplateList(data);
          setSelectedTemplate(data[0].template_name);
        }
      });
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <Label>Select Template</Label>
          <Select
            value={selectedTemplate ?? ''}
            onValueChange={(value) => setSelectedTemplate(value)}
          >
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {templateList.map((t) => (
                <SelectItem key={t.template_name} value={t.template_name}>
                  {t.template_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-3 items-end">
          {typeof window !== 'undefined' && selectedTemplate ? (
            <Link href={`/admin/templates/new?copy=${selectedTemplate}`}>
              <Button variant="secondary">Duplicate</Button>
            </Link>
          ) : (
            <Button variant="secondary" disabled title="Waiting for hydration...">
              Duplicate
            </Button>
          )}
          <Link href="/admin/templates/new">
            <Button>Create New</Button>
          </Link>
        </div>
      </div>

      {selectedTemplate && (
        <div className="border rounded overflow-hidden mt-4">
          <TemplateEditor templateName={selectedTemplate} />
        </div>
      )}
    </div>
  );
}
