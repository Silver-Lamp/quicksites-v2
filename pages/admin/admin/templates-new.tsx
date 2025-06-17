'use client';
import { useEffect, useState } from 'react';
import { json } from '@/lib/api/json';
import { useRouter } from 'next/router';
import { Input } from '@/components/admin/ui/input';
import { Button } from '@/components/admin/ui/button';
import { Label } from '@/components/admin/ui/label';
import { Textarea } from '@/components/admin/ui/textarea';

export default function NewTemplatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [template, setTemplate] = useState({
    template_name: '',
    industry: '',
    layout: 'default',
    color_scheme: 'blue-yellow',
    data: `{
  "pages": [
    {
      "slug": "index",
      "title": "{{business_name}}",
      "meta_description": "",
      "content_blocks": []
    }
  ]
}`,
  });

  // Load existing template if ?copy=template_name
  useEffect(() => {
    const { copy } = router.query;
    if (copy && typeof copy === 'string') {
      fetch(`/api/templates/${copy}`)
        .then((res) => json())
        .then((data) => {
          setTemplate({
            template_name: `${data.template_name}-copy`,
            industry: data.industry,
            layout: data.layout,
            color_scheme: data.color_scheme,
            data: JSON.stringify(data.data, null, 2),
          });
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [router.query]);

  const handleChange = (field: string, value: string) => {
    setTemplate((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async () => {
    try {
      const payload = {
        ...template,
        data: JSON.parse(template.data),
      };

      const res = await fetch('/api/templates/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        router.push('/admin/templates');
      } else {
        const err = await json();
        alert('Error: ' + err.error);
      }
    } catch (e: any) {
      alert('Invalid JSON: ' + e.message);
    }
  };

  if (loading) return <p className="p-6">Loading template...</p>;

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <h2 className="text-xl font-bold">Create New Template</h2>

      <div className="grid gap-4">
        <div>
          <Label>Template Name</Label>
          <Input
            value={template.template_name}
            onChange={(e) => handleChange('template_name', e.target.value)}
          />
        </div>

        <div>
          <Label>Industry</Label>
          <Input
            value={template?.industry || ''}
            onChange={(e) => handleChange('industry', e.target.value)}
          />
        </div>

        <div>
          <Label>Layout</Label>
          <Input
            value={template.layout}
            onChange={(e) => handleChange('layout', e.target.value)}
          />
        </div>

        <div>
          <Label>Color Scheme</Label>
          <Input
            value={template.color_scheme}
            onChange={(e) => handleChange('color_scheme', e.target.value)}
          />
        </div>

        <div>
          <Label>Template JSON (data)</Label>
          <Textarea
            rows={12}
            className="font-mono text-sm"
            value={template.data}
            onChange={(e) => handleChange('data', e.target.value)}
          />
        </div>

        <Button onClick={handleCreate}>Save Template</Button>
      </div>
    </div>
  );
}
