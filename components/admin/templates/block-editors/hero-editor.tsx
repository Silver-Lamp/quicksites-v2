'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Block } from '@/types/blocks';
import type { Template } from '@/types/template';
import type { BlockEditorProps } from './index';
import BlockPreviewToggle from '@/components/admin/ui/block-preview-toggle';
import { Sparkles, Image as ImageIcon, Loader2, Settings2, X } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import toast from 'react-hot-toast';
import { getIndustryOptions, resolveIndustryKey, toIndustryLabel } from '@/lib/industries';
import { uploadToStorage } from '@/lib/uploadToStorage';

/* ───────── helpers (same as before) ───────── */

function toCanonicalHeroProps(local: any, template?: any) {
  const digits = (s: string) => (s || '').replace(/\D/g, '');
  const action = local?.cta_action || 'go_to_page';
  let ctaHref = '/contact';
  if (action === 'go_to_page') ctaHref = local?.cta_link || '/contact';
  else if (action === 'jump_to_contact')
    ctaHref = `#${String(local?.contact_anchor_id || 'contact').replace(/^#/, '')}`;
  else if (action === 'call_phone') {
    const d = digits(local?.cta_phone) || digits((template?.phone as string) || '');
    ctaHref = d ? `tel:${d}` : 'tel:';
  }
  return {
    heading: local?.headline ?? local?.heading ?? 'Welcome to Your New Site',
    subheading: local?.subheadline ?? local?.subheading ?? 'Start editing, and let the magic happen.',
    ctaLabel: local?.cta_text ?? local?.ctaLabel ?? 'Get Started',
    ctaHref,
    heroImage: local?.image_url ?? local?.heroImage ?? '',
    blur_amount: typeof local?.blur_amount === 'number' ? local.blur_amount : 0,
    image_position: local?.image_position ?? 'center',
    layout_mode: local?.layout_mode ?? 'inline',
    overlay_level: local?.overlay_level ?? 'soft',
    tone: local?.tone ?? 'neutral',
    tags: Array.isArray(local?.tags) ? local.tags : [],
  };
}

function normalizeCta(local: any, template?: any) {
  const out = { ...(local || {}) };
  const digits = (s: string) => (s || '').replace(/\D/g, '');
  if (!out.cta_action && typeof out.cta_link === 'string') {
    const link = out.cta_link;
    if (link.startsWith('#')) {
      out.cta_action = 'jump_to_contact';
      out.contact_anchor_id = link.slice(1) || 'contact';
    } else if (link.startsWith('tel:')) {
      out.cta_action = 'call_phone';
      out.cta_phone = digits(link.slice(4));
    } else out.cta_action = 'go_to_page';
  }
  if (out.cta_action === 'jump_to_contact')
    out.contact_anchor_id = String(out.contact_anchor_id || 'contact').replace(/^#/, '');
  else if (out.cta_action === 'call_phone')
    out.cta_phone = digits(out.cta_phone || (template?.phone as string) || '');
  else out.cta_link = out.cta_link || '/contact';
  return out;
}

function pickMostEdited(propsRaw: any, contentRaw: any, template?: any) {
  const toNew = (raw: any = {}) => {
    const out: any = { ...raw };
    if (!out.headline && raw.heading) out.headline = raw.heading;
    if (!out.subheadline && raw.subheading) out.subheadline = raw.subheading;
    if (!out.cta_text && raw.ctaLabel) out.cta_text = raw.ctaLabel;
    if (!out.image_url && raw.heroImage) out.image_url = raw.heroImage;
    if (!out.cta_link && typeof raw.ctaHref === 'string') out.cta_link = raw.ctaHref;
    if (raw.blur_amount != null && out.blur_amount == null) out.blur_amount = raw.blur_amount;
    if (raw.image_position && !out.image_position) out.image_position = raw.image_position;
    if (raw.layout_mode && !out.layout_mode) out.layout_mode = raw.layout_mode;
    if (raw.overlay_level && !out.overlay_level) out.overlay_level = raw.overlay_level;
    return out;
  };
  const P = toNew(propsRaw || {});
  const C = toNew(contentRaw || {});
  const isStr = (v: any) => typeof v === 'string' && v.trim().length > 0;
  const isDefault = (s: string) => !isStr(s) || /^welcome to your new site$/i.test((s || '').trim());
  const score = (c: any) => {
    let s = 0;
    if (!isDefault(c.headline ?? '')) s += 3;
    if (isStr(c.subheadline)) s += 1;
    if (isStr(c.cta_text)) s += 1;
    return s;
  };
  const base = score(C) >= score(P) ? C : P;
  const other = base === C ? P : C;
  const merged: any = { ...base };
  for (const [k, v] of Object.entries(other)) {
    const cur = (merged as any)[k];
    if (cur == null || cur === '' || (typeof cur === 'number' && Number.isNaN(cur))) (merged as any)[k] = v;
  }
  return { merged: normalizeCta(merged, template), chosenKey: (base === C ? 'content' : 'props') as 'props' | 'content' };
}

/* ───────── styles ───────── */
const selectDark =
  'w-full rounded-md border border-white/10 bg-neutral-950 px-2 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500';
const rangeDark = 'w-full accent-violet-500';

/* ───────── component ───────── */
export default function HeroEditor({
  block,
  onSave,
  onClose,
  errors,
  template,
}: BlockEditorProps & { template: Template }) {
  if (block.type !== 'hero') return null;

  // Express vs Advanced
  const [mode, setMode] = useState<'express' | 'advanced'>('express');

  // init from most-edited side
  const rawProps = (block as any)?.props;
  const rawContent = (block as any)?.content;
  const { merged: initialLocal, chosenKey } = useMemo(
    () => pickMostEdited(rawProps, rawContent, template),
    [(block as any)?._id, (block as any)?.id, rawProps, rawContent, template]
  );
  const fieldKey: 'props' | 'content' = useMemo(
    () => (rawProps && rawContent ? chosenKey : rawProps ? 'props' : 'content'),
    [rawProps, rawContent, chosenKey]
  );
  const altKey = fieldKey === 'props' ? 'content' : 'props';

  const [local, setLocal] = useState<any>(initialLocal);
  useEffect(() => setLocal(initialLocal), [initialLocal]);

  // industry
  const industryOptions = useMemo(() => getIndustryOptions(), []);
  const currentIndustryKey = useMemo(() => {
    const meta = (template?.data as any)?.meta ?? {};
    const raw = meta?.industry ?? (template as any)?.industry ?? '';
    return resolveIndustryKey(raw);
  }, [template]);
  const [industryKey, setIndustryKey] = useState<string>(currentIndustryKey);
  useEffect(() => setIndustryKey(currentIndustryKey), [currentIndustryKey]);
  const [aiIndustryOther, setAiIndustryOther] = useState('');

  // label used downstream (after step 2)
  const promptIndustryLabel = useMemo(
    () =>
      industryKey === 'other' && aiIndustryOther.trim()
        ? aiIndustryOther.trim()
        : toIndustryLabel(resolveIndustryKey(industryKey)),
    [industryKey, aiIndustryOther]
  );

  // Step control: gate the rest of the form until industry is chosen
  type Step = 1 | 2;
  const initialStep: Step = (currentIndustryKey && currentIndustryKey !== 'other') ? 2 : 1;
  const [step, setStep] = useState<Step>(initialStep);
  const industryValid = useMemo(
    () => !!industryKey && (industryKey !== 'other' || aiIndustryOther.trim().length > 0),
    [industryKey, aiIndustryOther]
  );

  // AI + image gen
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);
  const [imgIncludePeople, setImgIncludePeople] = useState(false);
  const [imgSubjectTouched, setImgSubjectTouched] = useState(false);
  const [imgSubject, setImgSubject] = useState(
    local?.image_subject || `${promptIndustryLabel} website hero banner`
  );
  const [imgStyle, setImgStyle] = useState<'photo' | 'illustration' | '3d' | 'minimal'>('photo');

  const update = <K extends keyof typeof local>(key: K, value: (typeof local)[K]) =>
    setLocal((prev: any) => ({ ...prev, [key]: value as (typeof local)[K] }));

  const handleSave = () => {
    const mergedLocal = normalizeCta({ ...local }, template);
    const canon = toCanonicalHeroProps(mergedLocal, template);
    const finalPayload = { ...mergedLocal, ...canon };

    const nextBlock: Block = {
      ...(block as any),
      industry: industryKey,
      [fieldKey]: finalPayload,
      [altKey]: finalPayload,
    } as any;

    onSave(nextBlock);
    onClose?.();

    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent('qs:toolbar:save-now', { detail: { source: 'hero-editor' } }));
    });
  };

  const errorText = (path: string) =>
    errors?.[path]?.length ? <p className="text-xs text-red-400 mt-1">{errors[path][0].message}</p> : null;

  useEffect(() => {
    if (!imgSubjectTouched) {
      const s = `${promptIndustryLabel} website hero banner`;
      setImgSubject(s);
      update('image_subject', s as any);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptIndustryLabel]);

  // reflect industry in template meta live (works in both steps)
  useEffect(() => {
    (block as any).industry = industryKey;
    const meta = ((template?.data as any)?.meta ?? {});
    try {
      window.dispatchEvent(new CustomEvent('qs:template:merge', { detail: { meta: { ...meta, industry: industryKey } } }));
      window.dispatchEvent(new CustomEvent('qs:template:apply-patch', {
        detail: { data: { ...(template?.data as any), meta: { ...meta, industry: industryKey } }, industry: industryKey } as any,
      }));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [industryKey]);

  async function requestSuggestions() {
    const res = await fetch('/api/hero/suggest', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_id: template?.id,
        industry: promptIndustryLabel,
        services: (template as any)?.services ?? [],
        business_name: (template as any)?.business_name,
        city: (template as any)?.city,
        state: (template as any)?.state,
      }),
    });
    if (!res.ok) throw new Error(`Suggest failed (${res.status})`);
    return (await res.json()) as { headline?: string; subheadline?: string; cta_text?: string };
  }
  async function suggestAll() {
    setAiLoading(true); setAiError(null);
    try {
      const data = await requestSuggestions();
      if (data.headline) update('headline', data.headline);
      if (data.subheadline) update('subheadline', data.subheadline);
      if (data.cta_text) update('cta_text', data.cta_text);
      toast.success('Suggested copy applied');
    } catch (e: any) { setAiError(e?.message || 'Failed to fetch suggestions'); toast.error('Could not get AI suggestions'); }
    finally { setAiLoading(false); }
  }

  async function generateHeroImage() {
    setImgLoading(true); setImgError(null);
    try {
      const base =
        `website hero (header/banner) image for a ${promptIndustryLabel} small business. ` +
        `${imgSubject}. wide 16:9 composition with clear copy space for headline, clean modern background, high detail, no text, no watermarks, no logos.`;
      const negatives = imgIncludePeople ? 'no text, no watermark, no logo' :
        'no people, no faces, no portraits, no hands, no superheroes, no text, no watermark, no logo';

      const res = await fetch('/api/hero/generate-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: template?.id, industry: promptIndustryLabel,
          services: (template as any)?.services ?? [], business_name: (template as any)?.business_name,
          city: (template as any)?.city, state: (template as any)?.state,
          subject: imgSubject, style: imgStyle, aspect: 'wide',
          prompt: base, negative: negatives, include_people: imgIncludePeople,
          prompt_context: { purpose: 'website hero header', layout: 'wide 16:9 with copy space', include_people: imgIncludePeople },
        }),
      });
      if (!res.ok) throw new Error(`Image generate failed (${res.status})`);
      const { image_base64 } = await res.json();
      if (!image_base64) throw new Error('No image returned');
      const file = new File([Uint8Array.from(atob(image_base64), c => c.charCodeAt(0))], `hero-${Date.now()}.png`, { type: 'image/png' });
      const url = await uploadToStorage(file, `template-${template?.id}/hero`);
      update('image_url', url as any);
      toast.success('Hero image generated');
    } catch (e: any) { setImgError(e?.message || 'Failed to generate image'); toast.error('Could not generate image'); }
    finally { setImgLoading(false); }
  }

  // Close on Esc
  useEffect(() => {
    const onEsc = (ev: KeyboardEvent) => { if (ev.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

  /* ───────── Modal layout: overlay + scrollable content + sticky footer ───────── */
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center" role="dialog" aria-modal="true" aria-label="Hero Editor">
      {/* overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => onClose?.()} />

      {/* panel */}
      <div
        className="relative mt-6 w-full max-w-4xl rounded-xl border border-white/10 bg-neutral-950 shadow-xl
                   max-h-[min(92vh,100svh-2rem)] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* sticky header */}
        <div className="sticky top-0 z-10 px-4 py-3 border-b border-white/10 bg-neutral-950/90 backdrop-blur flex items-center justify-between">
          <div className="text-sm font-medium flex items-center gap-2">
            <Settings2 className="w-4 h-4" /> Hero Settings
          </div>

          {/* Hide mode toggle until Step 2 */}
          {step === 2 && (
            <div className="inline-flex rounded-full border border-white/15 bg-neutral-900 p-1 text-xs">
              <button
                className={`px-3 py-1 rounded-full ${mode === 'express' ? 'bg-white text-gray-900' : 'text-white/80'}`}
                onClick={() => setMode('express')}
              >
                Express
              </button>
              <button
                className={`px-3 py-1 rounded-full ${mode === 'advanced' ? 'bg-white text-gray-900' : 'text-white/80'}`}
                onClick={() => setMode('advanced')}
              >
                Advanced
              </button>
            </div>
          )}

          <button
            aria-label="Close editor"
            onClick={() => onClose?.()}
            className="ml-3 rounded-md px-2 py-1 text-sm text-white/80 hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 pb-24 [scrollbar-gutter:stable]">
          {/* tip only visible in Step 2 */}
          {step === 2 && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-xs text-white/80 mt-3 mb-3">
              Hover the hero preview to edit ✎ or use ✨ for quick rewrites. Switch to Advanced for full form controls.
            </div>
          )}

          {/* Industry (Step 1 content, also shown in Step 2 at the top) */}
          <div className="rounded border border-white/10 bg-neutral-900 p-3 space-y-2">
            <div className="text-sm font-medium">What kind of site are you building?</div>
            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-neutral-300">Industry</label>
                <select
                  className={selectDark}
                  value={industryKey}
                  onChange={(e) => setIndustryKey(e.target.value)}
                >
                  {industryOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-neutral-300">Other (if not in the list)</label>
                <input
                  className={selectDark}
                  value={aiIndustryOther}
                  onChange={(e) => setAiIndustryOther(e.target.value)}
                  placeholder="e.g., Mobile Windshield Repair"
                  disabled={industryKey !== 'other'}
                />
              </div>
            </div>
            {step === 1 && (
              <p className="text-xs text-neutral-400 pt-1">
                Choose an industry (or enter your own) to continue.
              </p>
            )}
          </div>

          {/* Everything below is hidden until Step 2 */}
          {step === 2 && (
            <>
              {/* AI Assist */}
              <div className="rounded border border-white/10 bg-neutral-900 p-3 space-y-2 mt-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-300" />
                    <div className="text-sm font-medium">AI Assist</div>
                  </div>
                  <button
                    onClick={suggestAll}
                    disabled={aiLoading}
                    className="inline-flex items-center gap-2 rounded bg-purple-600 hover:bg-purple-500 px-3 py-1.5 text-sm text-white disabled:opacity-60"
                  >
                    {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {aiLoading ? 'Working…' : 'Suggest All'}
                  </button>
                </div>
                {aiError && <div className="text-xs text-red-300">{aiError}</div>}
              </div>

              {/* Express content */}
              {mode === 'express' && (
                <div className="grid md:grid-cols-3 gap-3 mt-3">
                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-neutral-300">Image Subject</label>
                      <button
                        onClick={generateHeroImage}
                        disabled={imgLoading}
                        className="inline-flex items-center gap-1.5 rounded border-2 border-purple-500/70 text-purple-300 px-2 py-1 text-xs hover:bg-purple-500/10"
                      >
                        {imgLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />} Generate
                      </button>
                    </div>
                    <input
                      className={selectDark}
                      value={imgSubject}
                      onChange={(e) => { setImgSubject(e.target.value); setImgSubjectTouched(true); update('image_subject', e.target.value as any); }}
                      placeholder={`${promptIndustryLabel} website hero banner`}
                    />
                    {imgError && <div className="text-xs text-red-300 mt-1">{imgError}</div>}
                  </div>
                  <div>
                    <label className="text-xs text-neutral-300">Style</label>
                    <select className={selectDark} value={imgStyle} onChange={(e) => setImgStyle(e.target.value as any)}>
                      <option value="photo">Photo</option>
                      <option value="illustration">Illustration</option>
                      <option value="3d">3D Render</option>
                      <option value="minimal">Minimal</option>
                    </select>
                  </div>
                  <div className="md:col-span-3 flex items-center justify-between">
                    <label className="text-xs text-neutral-300">Include people in image</label>
                    <Switch checked={imgIncludePeople} onCheckedChange={(v) => setImgIncludePeople(!!v)} />
                  </div>
                </div>
              )}

              {/* Advanced content */}
              {mode === 'advanced' && (
                <>
                  <div className="grid md:grid-cols-3 gap-3 mt-3">
                    <div>
                      <label className="text-xs text-neutral-300">Headline</label>
                      <input className={selectDark} value={local?.headline || ''} onChange={(e) => update('headline', e.target.value as any)} placeholder="Fast, Reliable Service" />
                      {errorText(`${fieldKey}.headline`)}
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs text-neutral-300">Subheadline</label>
                      <input className={selectDark} value={local?.subheadline || ''} onChange={(e) => update('subheadline', e.target.value as any)} placeholder="24/7 local help with transparent pricing." />
                      {errorText(`${fieldKey}.subheadline`)}
                    </div>
                    <div>
                      <label className="text-xs text-neutral-300">CTA Text</label>
                      <input className={selectDark} value={local?.cta_text || ''} onChange={(e) => update('cta_text', e.target.value as any)} placeholder="Get Started" />
                      {errorText(`${fieldKey}.cta_text`)}
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs text-neutral-300">CTA Action</label>
                      <div className="grid grid-cols-3 gap-2">
                        <select className={selectDark} value={local?.cta_action || 'go_to_page'} onChange={(e) => update('cta_action', e.target.value as any)}>
                          <option value="jump_to_contact">Jump to Contact</option>
                          <option value="go_to_page">Go to Page</option>
                          <option value="call_phone">Call Phone</option>
                        </select>
                        {(local?.cta_action || 'go_to_page') === 'go_to_page' && (
                          <input className={selectDark} value={local?.cta_link ?? '/contact'} onChange={(e) => update('cta_link', e.target.value as any)} placeholder="/contact" />
                        )}
                        {local?.cta_action === 'jump_to_contact' && (
                          <input className={selectDark} value={local?.contact_anchor_id ?? 'contact'} onChange={(e) => update('contact_anchor_id', e.target.value as any)} placeholder="contact" />
                        )}
                        {local?.cta_action === 'call_phone' && (
                          <input className={selectDark} value={local?.cta_phone ?? ''} onChange={(e) => update('cta_phone', e.target.value as any)} placeholder="enter 10-digit phone" />
                        )}
                      </div>
                      <div className="mt-1">
                        <label className="inline-flex items-center gap-2 text-xs">
                          <Switch checked={!!local?.cta_show_phone_below} onCheckedChange={(v) => update('cta_show_phone_below', v as any)} />
                          <span>Show phone number under CTA</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-3 mt-3">
                    <div>
                      <label className="text-xs text-neutral-300">Image</label>
                      {local?.image_url && <img src={local.image_url} alt="Hero" className="mb-2 rounded shadow max-w-xs" />}
                      <input
                        type="file"
                        accept="image/*"
                        className="text-sm text-gray-300 file:bg-purple-600 file:text-white file:rounded file:border-0 file:px-4 file:py-1 file:mr-2"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const url = await uploadToStorage(file, `template-${template?.id}/hero`);
                            update('image_url', url as any);
                            toast.success('Image uploaded');
                          } catch (err: any) {
                            toast.error(err.message || 'Upload failed');
                          }
                        }}
                      />
                    </div>
                    <div className="md:col-span-2 grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-neutral-300">Layout Mode</label>
                        <select value={local?.layout_mode || 'inline'} onChange={(e) => update('layout_mode', e.target.value as any)} className={selectDark}>
                          <option value="inline">Inline Image</option>
                          <option value="background">Image as Background</option>
                          <option value="full_bleed">Full-Bleed Image</option>
                          <option value="natural_height">Natural Height</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-neutral-300">Blur Amount (0–30px)</label>
                        <input type="range" min={0} max={30} step={1} value={local?.blur_amount ?? 8} onChange={(e) => update('blur_amount', Number(e.target.value) as any)} className={rangeDark} />
                      </div>
                      <div>
                        <label className="text-xs text-neutral-300">Image X</label>
                        <input className={selectDark} value={local?.image_x || ''} onChange={(e) => update('image_x', e.target.value as any)} placeholder="center" />
                      </div>
                      <div>
                        <label className="text-xs text-neutral-300">Image Y</label>
                        <input className={selectDark} value={local?.image_y || ''} onChange={(e) => update('image_y', e.target.value as any)} placeholder="bottom" />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-neutral-300">Overlay Level</label>
                        <div className="mt-1 inline-flex rounded-lg border border-white/15 bg-neutral-900 p-1 text-xs">
                          {(['none', 'soft', 'strong'] as const).map((lvl) => (
                            <button key={lvl} onClick={() => update('overlay_level', lvl as any)} className={`px-3 py-1 rounded-md ${(local?.overlay_level ?? 'soft') === lvl ? 'bg-white text-gray-900' : 'text-white/80'}`}>
                              {lvl}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Live preview bridge */}
              <div className="mt-3">
                <BlockPreviewToggle
                  block={{
                    ...block,
                    type: 'hero',
                    [fieldKey]: { ...(block as any)[fieldKey], ...toCanonicalHeroProps(local, template) },
                    [altKey]: { ...(block as any)[altKey], ...toCanonicalHeroProps(local, template) },
                  }}
                  template={template as Template}
                />
              </div>
            </>
          )}
        </div>

        {/* sticky footer */}
        <div className="sticky bottom-0 z-10 border-t border-white/10 bg-neutral-950/90 backdrop-blur px-4 py-3 flex justify-end gap-2">
          <button onClick={() => onClose?.()} className="text-sm px-3 py-1.5 border border-white/10 rounded bg-neutral-900 hover:bg-neutral-800">
            Cancel
          </button>

          {step === 1 ? (
            <button
              onClick={() => setStep(2)}
              disabled={!industryValid}
              className="text-sm px-3 py-1.5 rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60"
              title={industryValid ? 'Continue' : 'Choose an industry (or fill “Other”) to continue'}
            >
              Next
            </button>
          ) : (
            <button onClick={handleSave} className="text-sm px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700">
              Save
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
