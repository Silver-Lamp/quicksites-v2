// app/admin/templates/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import TemplateEditor from '@/components/admin/templates/template-editor';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Template = {
  template_name: string;
  updated_at: string;
  industry: string | null;
};

export default function TemplatesPage() {
  const [templateList, setTemplateList] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('templates')
      .select('template_name, updated_at, industry')
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        if (data) setTemplateList(data);
      });
  }, []);

  const grouped = templateList.reduce<Record<string, Template[]>>((acc, t) => {
    const key = t.industry || 'Uncategorized';
    acc[key] = acc[key] || [];
    acc[key].push(t);
    return acc;
  }, {});

  const fetchTemplates = () =>
    supabase
      .from('templates')
      .select('template_name, updated_at, industry')
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        if (data) setTemplateList(data);
      });
  
  useEffect(() => {
    fetchTemplates();
  }, []);
  

  return (
    <div className="p-6 space-y-10">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Template Manager</h1>
        <Link href="/admin/templates/new">
          <Button>Create New Template</Button>
        </Link>
      </div>

      {Object.entries(grouped).map(([industry, templates]) => (
        <div key={industry} className="space-y-3">
          <h2 className="text-xl font-bold text-muted-foreground">{industry}</h2>
          <div className="overflow-auto border rounded-lg shadow-sm">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-2">Template Name</th>
                  <th className="px-4 py-2">Updated</th>
                  <th className="px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr
                    key={t.template_name}
                    className={`border-t ${selectedTemplate === t.template_name ? 'bg-muted/40' : ''}`}
                  >
                    <td className="px-4 py-2 font-medium">{t.template_name}</td>
                    <td className="px-4 py-2">{new Date(t.updated_at).toLocaleString()}</td>
                    <td className="px-4 py-2 space-x-2">
                      <Link href={`/edit/${t.template_name}`}><Button size="sm" variant="default">Edit</Button></Link>
                      <Link href={`/admin/templates/new?copy=${t.template_name}`}>
                        <Button size="sm" variant="secondary">
                          Duplicate
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {selectedTemplate && (
        <div className="border rounded overflow-hidden mt-10">
          <TemplateEditor 
            templateName={selectedTemplate}
            onRename={(newName) => {
              fetchTemplates();
              setSelectedTemplate(newName);
            }}
          />
        </div>
      )}
    </div>
  );
}
