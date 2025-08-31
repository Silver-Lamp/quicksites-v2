// components/admin/dev/seeder/sections/IndustryPromptRow.tsx
'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles } from 'lucide-react';
import { INDUSTRIES } from '../industries';

export function IndustryPromptRow({
  industry, setIndustry,
  seed, setSeed,
  aiPrompt, setAiPrompt,
  onSuggest,
}: {
  industry: string; setIndustry: (v: string) => void;
  seed: string; setSeed: (v: string) => void;
  aiPrompt: string; setAiPrompt: (v: string) => void;
  onSuggest: () => void;
}) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <Label>Industry</Label>
          <select
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-white dark:bg-neutral-900"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
          >
            {INDUSTRIES.map((ind) => (
              <option key={ind} value={ind}>{ind}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>Global Seed (optional)</Label>
          <Input value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="fixture-XYZ" />
        </div>
        <div className="flex items-end">
          <Button type="button" variant="secondary" onClick={onSuggest} className="w-full">
            <Sparkles className="mr-2 h-4 w-4" /> AI Suggest (use industry)
          </Button>
        </div>
      </div>

      <div>
        <Label>AI Prompt (theme / style)</Label>
        <Input
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          placeholder="Brand voice, offers, product focus…"
        />
      </div>
    </>
  );
}
