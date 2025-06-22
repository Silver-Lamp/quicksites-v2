import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { supabase } from '@/admin/lib/supabaseClient';
import { Template } from '@/types/template';

export default function TemplateFields({
  template,
  onChange,
}: {
  template: Template;
  onChange: (t: Template) => void;
}) {
  const [industries, setIndustries] = useState<string[]>([]);
  const colorSchemes: { name: string; hex: string }[] = [
    { name: 'blue', hex: '#3b82f6' },
    { name: 'green', hex: '#22c55e' },
    { name: 'yellow', hex: '#eab308' },
    { name: 'red', hex: '#ef4444' },
  ];
  const themes = ['dark', 'light'];
  const brands = ['blue', 'green', 'red'];

  useEffect(() => {
    supabase
      .from('industries')
      .select('name')
      .then(({ data }) => {
        if (data) setIndustries(data.map((i) => i.name));
      });
  }, []);

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div>
        <Label>Industry</Label>
        <select
          value={template.industry || ''}
          onChange={(e) => onChange({ ...template, industry: e.target.value })}
          className="w-full bg-gray-800 text-white border border-gray-700 px-2 py-1 rounded"
        >
          <option value="">Select Industry</option>
          {industries.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label>Layout</Label>
        <Input
          value={template.layout || ''}
          onChange={(e) => onChange({ ...template, layout: e.target.value })}
          className="bg-gray-800 text-white border border-gray-700"
        />
      </div>

      <div>
        <Label>Color Scheme</Label>
        <div className="flex gap-2 mt-1">
          {colorSchemes.map(({ name, hex }) => (
            <button
              key={name}
              onClick={() => onChange({ ...template, color_scheme: name })}
              className={`w-6 h-6 rounded-full border-2 ${
                template.color_scheme === name ? 'border-white' : 'border-transparent'
              }`}
              style={{ backgroundColor: hex }}
              title={name}
            />
          ))}
        </div>
      </div>

      <div>
        <Label>Theme</Label>
        <select
          value={template.theme || ''}
          onChange={(e) => onChange({ ...template, theme: e.target.value })}
          className="w-full bg-gray-800 text-white border border-gray-700 px-2 py-1 rounded"
        >
          <option value="">Select Theme</option>
          {themes.map((t) => (
            <option key={t} value={t}>
              {t === 'dark' ? '🌙 Dark' : '☀️ Light'}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label>Brand</Label>
        <select
          value={template.brand || ''}
          onChange={(e) => onChange({ ...template, brand: e.target.value })}
          className="w-full bg-gray-800 text-white border border-gray-700 px-2 py-1 rounded"
        >
          <option value="">Select Brand</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label>Commit Message</Label>
        <Input
          value={template.commit || ''}
          onChange={(e) => onChange({ ...template, commit: e.target.value })}
          className="bg-gray-800 text-white border border-gray-700"
        />
      </div>
    </div>
  );
}
