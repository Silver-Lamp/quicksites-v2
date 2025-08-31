'use client';
import { useState } from 'react';
import { estimateTemplateCost } from '@/lib/ai/cost/estimate';
import { ASSUMPTIONS } from '@/lib/ai/cost/assumptions';
import { Button } from '@/components/ui/button';

export function AiCostPreview({ template }: { template: any }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [profile, setProfile] = useState<'BASIC'|'RICH'|'MAX'>('RICH');

  async function calc() {
    setLoading(true);
    try {
      const r = await estimateTemplateCost({
        entityType: 'template',
        entityId: template?.id || 'tmp',
        provider: process.env.NEXT_PUBLIC_AI_PROVIDER || 'openai',
        model_code: process.env.NEXT_PUBLIC_AI_MODEL || 'gpt-4o-mini',
        template,
        profileCode: profile,
        // image defaults good for hero
        imageProvider: 'openai',
        imageModel: 'gpt-image-1:medium',
        heroImageWidth: 1536,
        heroImageHeight: 1024,
        heroImagesPerHeroBlock: 1,
      });
      setResult(r);
    } catch (e:any) {
      setResult({ error: e.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border p-3 text-sm">
      <div className="flex items-center gap-2">
        <select value={profile} onChange={(e)=>setProfile(e.target.value as any)} className="border rounded px-2 py-1">
          {Object.values(ASSUMPTIONS).map(p=> <option key={p.code} value={p.code}>{p.label}</option>)}
        </select>
        <Button size="sm" onClick={calc} disabled={loading}>{loading ? 'Calculating…' : 'Estimate cost'}</Button>
      </div>
      {result && !result.error && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div>Input tokens: {result.input_tokens.toLocaleString()}</div>
          <div>Output tokens: {result.output_tokens.toLocaleString()}</div>
          <div className="col-span-2 font-medium">${result.estimated_cost_usd.toFixed(4)} per run</div>
        </div>
      )}
      {result?.error && (
        <div className="mt-2 text-red-600">{String(result.error)}</div>
      )}
    </div>
  );
}
