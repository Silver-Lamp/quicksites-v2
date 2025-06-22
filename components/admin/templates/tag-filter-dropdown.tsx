import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Checkbox } from '../../ui/checkbox';
import { Label } from '../../ui/label';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type TagFilterDropdownProps = {
  selected: string[];
  onChange: (tags: string[]) => void;
};

export default function TagFilterDropdown({ selected, onChange }: TagFilterDropdownProps) {
  const [available, setAvailable] = useState<string[]>([]);

  useEffect(() => {
    supabase
      .from('templates')
      .select('tags')
      .then(({ data }) => {
        const all = new Set<string>();
        data?.forEach((t: any) => {
          (t.tags || []).forEach((tag: string) => all.add(tag));
        });
        setAvailable(Array.from(all));
      });
  }, []);

  const toggle = (tag: string) => {
    if (selected.includes(tag)) {
      onChange(selected.filter((t) => t !== tag));
    } else {
      onChange([...selected, tag]);
    }
  };

  return (
    <div className="bg-muted p-4 rounded border shadow-sm max-w-sm">
      <p className="text-sm font-medium mb-2">Filter by Tags</p>
      <div className="space-y-2">
        {available.map((tag) => (
          <div key={tag} className="flex items-center gap-2">
            <Checkbox
              id={`tag-${tag}`}
              checked={selected.includes(tag)}
              onCheckedChange={() => toggle(tag)}
            />
            <Label htmlFor={`tag-${tag}`} className="text-sm">
              {tag}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}
