'use client';
import { useEffect, useMemo, useState } from 'react';
import { estimateTemplateCost } from '@/lib/ai/cost/estimate';
import { ASSUMPTIONS } from '@/lib/ai/cost/assumptions';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

export default function AiCostEstimatorCard({ sampleTemplate }: { sampleTemplate?: any }) {
  const [profile, setProfile] = useState<'BASIC'|'RICH'|'MAX'>('RICH');
  const [variants, setVariants] = useState(1);
  const [servicesPer, setServicesPer] = useState(4);

  // NEW: image gen knobs
  const [imageModel, setImageModel] = useState('gpt-image-1:medium');
  const [imageProvider, setImageProvider] = useState('openai');
  const [heroW, setHeroW] = useState(1536);
  const [heroH, setHeroH] = useState(1024);
  const [heroPerBlock, setHeroPerBlock] = useState(1);

  const [estimate, setEstimate] = useState<null | {
    usd: number; inTok: number; outTok: number; images: number; breakdown: Record<string,number>
  }>(null);

  async function run() {
    try {
      const res = await estimateTemplateCost({
        entityType: 'template',
        entityId: 'preview',
        provider: process.env.NEXT_PUBLIC_AI_PROVIDER || 'openai',
        model_code: process.env.NEXT_PUBLIC_AI_MODEL || 'gpt-4o-mini',
        template: sampleTemplate || { pages: [] },
        profileCode: profile,
        servicesCountPerPage: servicesPer,
        variantCount: variants,
        // image bits
        imageProvider,
        imageModel,
        heroImageWidth: heroW,
        heroImageHeight: heroH,
        heroImagesPerHeroBlock: heroPerBlock,
      });
      setEstimate({ usd: res.estimated_cost_usd, inTok: res.input_tokens, outTok: res.output_tokens, images: res.images, breakdown: res.breakdown });
    } catch (e:any) {
      setEstimate(null);
      alert(e?.message || 'Failed to estimate. Ensure model pricing rows exist (chat + image).');
    }
  }

  useEffect(() => { run(); }, []);

  return (
    <Card className="max-w-xl">
      <CardHeader><CardTitle>AI Cost Forecast</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {/* Text gen controls */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Assumptions</Label>
            <select value={profile} onChange={(e)=>setProfile(e.target.value as any)} className="w-full border rounded px-2 py-1">
              {Object.values(ASSUMPTIONS).map(p=> (<option key={p.code} value={p.code}>{p.label}</option>))}
            </select>
          </div>
          <div>
            <Label>Hero/Testimonial Variants</Label>
            <Input type="number" min={1} value={variants} onChange={e=>setVariants(parseInt(e.target.value||'1'))}/>
          </div>
          <div>
            <Label>Services per page</Label>
            <Input type="number" min={0} value={servicesPer} onChange={e=>setServicesPer(parseInt(e.target.value||'0'))}/>
          </div>
        </div>

        <Separator />

        {/* NEW: Image gen controls */}
        <div className="space-y-2">
          <div className="font-medium">Hero images</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Image provider</Label>
              <Input value={imageProvider} onChange={e=>setImageProvider(e.target.value)} placeholder="openai"/>
            </div>
            <div>
              <Label>Image model</Label>
              <Input value={imageModel} onChange={e=>setImageModel(e.target.value)} placeholder="gpt-image-1:medium"/>
            </div>
            <div>
              <Label>Hero width (px)</Label>
              <Input type="number" min={64} value={heroW} onChange={e=>setHeroW(parseInt(e.target.value||'0'))}/>
            </div>
            <div>
              <Label>Hero height (px)</Label>
              <Input type="number" min={64} value={heroH} onChange={e=>setHeroH(parseInt(e.target.value||'0'))}/>
            </div>
            <div>
              <Label>Images per hero</Label>
              <Input type="number" min={0} value={heroPerBlock} onChange={e=>setHeroPerBlock(parseInt(e.target.value||'0'))}/>
            </div>
          </div>
        </div>

        <Button onClick={run}>Recalculate</Button>

        {estimate && (
          <div className="mt-2 text-sm space-y-1">
            <div className="font-medium">Estimated: ${estimate.usd.toFixed(4)} per full generation</div>
            <div>Tokens in/out: {estimate.inTok.toLocaleString()} / {estimate.outTok.toLocaleString()}</div>
            <div>Hero images: {estimate.images}</div>
            {estimate.breakdown?.hero_images != null && (
              <div>Hero images cost: ${estimate.breakdown.hero_images.toFixed(4)}</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
