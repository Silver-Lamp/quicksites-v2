// components/admin/templates/block-editors/hero.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Block } from '@/types/blocks';
import type { Template } from '@/types/template';
import type { BlockEditorProps } from './index';
import BlockPreviewToggle from '@/components/admin/ui/block-preview-toggle';
import {
  Sparkles,
  Image as ImageIcon,
  Loader2,
  Settings2,
  X,
  Briefcase,
  Newspaper,
  UserRound,
  ChevronRight,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import toast from 'react-hot-toast';
import { getIndustryOptions, resolveIndustryKey, toIndustryLabel } from '@/lib/industries';
import { uploadToStorage } from '@/lib/uploadToStorage';

/* ───────────────── helpers ───────────────── */

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

  const heading = local?.headline ?? local?.heading ?? 'Welcome to Your New Site';
  const subheading =
    local?.subheadline ?? local?.subheading ?? 'Start editing, and let the magic happen.';
  const ctaLabel = local?.cta_text ?? local?.ctaLabel ?? 'Get Started';

  const image =
    local?.image_url ||
    local?.heroImage ||
    local?.image ||
    local?.imageUrl ||
    local?.imageURL ||
    local?.backgroundImage ||
    '';

  const layout = (local?.layout_mode || local?.layout || 'inline') as
    | 'inline'
    | 'background'
    | 'full_bleed'
    | 'natural_height';

  const overlay = local?.overlay_level ?? local?.overlay ?? 'soft';

  const base = {
    heading,
    subheading,
    ctaLabel,
    ctaHref,
    heroImage: image,
    image_url: image,
    image,
    layout_mode: layout,
    layout,
    blur_amount: typeof local?.blur_amount === 'number' ? local.blur_amount : 0,
    image_position: local?.image_position ?? 'center',
    image_x: local?.image_x,
    image_y: local?.image_y,
    overlay_level: overlay,
    overlay,
    tone: local?.tone ?? 'neutral',
    tags: Array.isArray(local?.tags) ? local.tags : [],
  };

  return {
    ...base,
    headline: base.heading,
    subheadline: base.subheading,
    cta_text: base.ctaLabel,
    backgroundImage: image,
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

function normalizeSuggested(payload: any) {
  const h = payload?.headline ?? payload?.heading ?? payload?.title ?? '';
  const sh =
    payload?.subheadline ??
    payload?.subheading ??
    payload?.tagline ??
    payload?.description ??
    '';
  const cta = payload?.cta_text ?? payload?.ctaLabel ?? payload?.cta ?? '';
  return { headline: h, subheadline: sh, cta_text: cta };
}

function refreshPreview() {
  requestAnimationFrame(() => {
    try {
      window.dispatchEvent(
        new CustomEvent('qs:preview:refresh', { detail: { source: 'hero-editor' } }),
      );
    } catch {}
  });
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
    for (const k of ['image_position', 'layout_mode', 'layout', 'overlay_level', 'overlay']) {
      if (raw[k] != null && out[k] == null) out[k] = raw[k];
    }
    return out;
  };
  const P = toNew(propsRaw || {});
  const C = toNew(contentRaw || {});
  const isStr = (v: any) => typeof v === 'string' && v.trim().length > 0;
  const isDefault = (s: string) =>
    !isStr(s) || /^welcome to your new site$/i.test((s || '').trim());
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
    if (cur == null || cur === '' || (typeof cur === 'number' && Number.isNaN(cur)))
      (merged as any)[k] = v;
  }
  return {
    merged: normalizeCta(merged, template),
    chosenKey: (base === C ? 'content' : 'props') as 'props' | 'content',
  };
}

/* ───────────────── styles ───────────────── */
const selectDark =
  'w-full rounded-md border border-white/10 bg-neutral-950 px-2 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500';
const rangeDark = 'w-full accent-violet-500';

/* ───────────────── site type quick-picks ───────────────── */
const SITE_TYPES = [
  { key: 'small_business', label: 'Small Business', blurb: 'Pick your industry', Icon: Briefcase as any },
  { key: 'portfolio', label: 'Portfolio', blurb: 'Show your work', Icon: ImageIcon as any },
  { key: 'blog', label: 'Blog', blurb: 'Posts & updates', Icon: Newspaper as any },
  { key: 'about_me', label: 'About Me', blurb: 'Simple profile', Icon: UserRound as any },
] as const;
type SiteType = (typeof SITE_TYPES)[number]['key'];

/* ───────────────── component ───────────────── */
export default function HeroEditor({
  block,
  onSave,
  onClose,
  errors,
  template,
}: BlockEditorProps & { template: Template }) {
  if (block.type !== 'hero') return null;

  const [mode, setMode] = useState<'express' | 'advanced'>('express');

  // initial local
  const rawProps = (block as any)?.props;
  const rawContent = (block as any)?.content;
  const { merged: initialLocal, chosenKey } = useMemo(
    () => pickMostEdited(rawProps, rawContent, template),
    [(block as any)?._id, (block as any)?.id, rawProps, rawContent, template],
  );
  const fieldKey: 'props' | 'content' = useMemo(
    () => (rawProps && rawContent ? chosenKey : rawProps ? 'props' : 'content'),
    [rawProps, rawContent, chosenKey],
  );
  const altKey = fieldKey === 'props' ? 'content' : 'props';

  const [local, setLocal] = useState<any>(initialLocal);
  useEffect(() => setLocal(initialLocal), [initialLocal]);

  // preview nonce
  const [previewNonce, setPreviewNonce] = useState(0);
  const bumpPreview = () => {
    setPreviewNonce((n) => n + 1);
    requestAnimationFrame(() => {
      try {
        window.dispatchEvent(
          new CustomEvent('qs:preview:refresh', { detail: { source: 'hero-editor' } }),
        );
      } catch {}
    });
  };

  // industry/site type
  const industryOptions = useMemo(() => getIndustryOptions(), []);

  // Read current values from template meta/columns
  const metaAll = useMemo(() => ((template?.data as any)?.meta ?? {}), [template]);

  const currentIndustryKey = useMemo(() => {
    const raw = (metaAll?.industry ?? (template as any)?.industry ?? '').toString().trim();
    return raw ? resolveIndustryKey(raw) : '';
  }, [metaAll, template]);

  // Treat server-seeded "other" without text as UNSET in the UI
  const seededOtherByServer = useMemo(() => {
    return (
      currentIndustryKey === 'other' &&
      (!metaAll.industry_other || String(metaAll.industry_other).trim() === '') &&
      (!metaAll.site_type || metaAll.site_type === null) &&
      (metaAll.industry_label == null || metaAll.industry_label === 'Other')
    );
  }, [currentIndustryKey, metaAll]);

  const initialIndustryKey = useMemo(
    () => (seededOtherByServer ? '' : currentIndustryKey),
    [seededOtherByServer, currentIndustryKey],
  );

  // Initialize ONCE; do not re-stomp user changes
  const [industryKey, setIndustryKey] = useState<string>('');
  const didInitIndustry = useRef(false);
  useEffect(() => {
    if (didInitIndustry.current) return;
    setIndustryKey(initialIndustryKey); // '' when seeded other; otherwise existing key
    didInitIndustry.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialIndustryKey]);

  const [aiIndustryOther, setAiIndustryOther] = useState('');

  const initialSiteType: SiteType | null = useMemo(() => {
    if (metaAll?.site_type) return metaAll.site_type as SiteType;
    if (currentIndustryKey && currentIndustryKey !== 'other') return 'small_business';
    return null;
  }, [metaAll, currentIndustryKey]);

  const [siteType, setSiteType] = useState<SiteType | null>(initialSiteType);
  const [showMoreTypes, setShowMoreTypes] = useState(false);

  const nonBusinessLabel =
    siteType === 'portfolio'
      ? 'Portfolio'
      : siteType === 'blog'
      ? 'Blog'
      : siteType === 'about_me'
      ? 'About Me'
      : '';

  const promptIndustryLabel = useMemo(() => {
    if (siteType && siteType !== 'small_business') return nonBusinessLabel;
    if (!industryKey) return ''; // keep empty until the user picks
    return industryKey === 'other' && aiIndustryOther.trim()
      ? aiIndustryOther.trim()
      : toIndustryLabel(resolveIndustryKey(industryKey));
  }, [siteType, nonBusinessLabel, industryKey, aiIndustryOther]);

  // Effective signals for API prompts
  const effectiveIndustryKey = useMemo(
    () =>
      resolveIndustryKey(
        industryKey || (metaAll?.industry ?? (template as any)?.industry ?? ''),
      ),
    [industryKey, metaAll, template],
  );

  const effectiveIndustryLabel = useMemo(() => {
    if (promptIndustryLabel) return promptIndustryLabel;
    const other = String(metaAll?.industry_other || '').trim();
    if (other) return other;
    if (effectiveIndustryKey && effectiveIndustryKey !== 'other') {
      return toIndustryLabel(resolveIndustryKey(effectiveIndustryKey));
    }
    return '';
  }, [promptIndustryLabel, metaAll, effectiveIndustryKey]);

  // steps
  type Step = 1 | 2;
  const initialStep: Step =
    (siteType && siteType !== 'small_business') ||
    (currentIndustryKey && currentIndustryKey !== 'other')
      ? 2
      : 1;
  const [step, setStep] = useState<Step>(initialStep);

  const industryValid = useMemo(
    () => !!industryKey && (industryKey !== 'other' || aiIndustryOther.trim().length > 0),
    [industryKey, aiIndustryOther],
  );
  const step1Valid = siteType === 'small_business' ? industryValid : !!siteType;

  // AI / image gen state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);
  const [imgIncludePeople, setImgIncludePeople] = useState(false);
  const [imgSubjectTouched, setImgSubjectTouched] = useState(false);
  const [imgSubject, setImgSubject] = useState(
    local?.image_subject || `${promptIndustryLabel} website hero banner`,
  );
  const [imgStyle, setImgStyle] = useState<'photo' | 'illustration' | '3d' | 'minimal'>('photo');

  const update = <K extends keyof typeof local>(
    key: K,
    value: (typeof local)[K] | ((prev: any) => any),
  ) =>
    setLocal((prev: any) => ({
      ...prev,
      [key]: typeof value === 'function' ? (value as any)(prev[key]) : value,
    }));

  /* ---------- bridge: react to on-canvas chip events ---------- */
  useEffect(() => {
    const onGenericSet = (e: any) => {
      const d = e?.detail || {};
      setLocal((prev: any) => {
        const next = { ...prev };
        if (d.overlay_level) {
          next.overlay_level = d.overlay_level;
          next.overlay = d.overlay_level;
        }
        if (d.layout) {
          next.layout_mode = d.layout;
          next.layout = d.layout;
        }
        if (typeof d.blur_amount === 'number') next.blur_amount = d.blur_amount;
        return next;
      });
      bumpPreview();
    };
    const onLayout = (e: any) => {
      const layout = e?.detail?.layout as string | undefined;
      if (!layout) return;
      setLocal((p: any) => ({ ...p, layout_mode: layout, layout }));
      bumpPreview();
    };
    const onOverlay = (e: any) => {
      const step = Math.max(-1, Math.min(1, Number(e?.detail?.step) || 0));
      const order = ['none', 'soft', 'strong'] as const;
      setLocal((p: any) => {
        const cur = (p?.overlay_level ?? p?.overlay ?? 'soft') as (typeof order)[number];
        const idx = Math.max(0, Math.min(order.length - 1, order.indexOf(cur) + step));
        const lvl = order[idx];
        return { ...p, overlay_level: lvl, overlay: lvl };
      });
      bumpPreview();
    };
    const onAutoFix = () => {
      setLocal((p: any) => {
        const cur = (p?.overlay_level ?? p?.overlay ?? 'none') as 'none' | 'soft' | 'strong';
        const lvl = cur === 'none' ? 'soft' : 'strong';
        return {
          ...p,
          overlay_level: lvl,
          overlay: lvl,
          layout_mode:
            p?.layout_mode && p.layout_mode !== 'inline' ? p.layout_mode : 'background',
          layout: p?.layout && p.layout !== 'inline' ? p.layout : 'background',
        };
      });
      bumpPreview();
    };

    // Also reflect apply-patch from renderer (overlay/layout/image_x/y/blur)
    const onApplyPatch = (e: any) => {
      const patch = e?.detail;
      const id = (block as any)?._id || (block as any)?.id;
      const b = Array.isArray(patch?.blocks)
        ? patch.blocks.find((x: any) => x.id === id)
        : null;
      if (!b) return;
      const c = b.content || {};
      setLocal((p: any) => ({
        ...p,
        ...(c.overlay_level ? { overlay_level: c.overlay_level, overlay: c.overlay_level } : {}),
        ...(c.layout_mode || c.layout
          ? { layout_mode: c.layout_mode || c.layout, layout: c.layout || c.layout_mode }
          : {}),
        ...(c.image_x ? { image_x: c.image_x } : {}),
        ...(c.image_y ? { image_y: c.image_y } : {}),
        ...(typeof c.blur_amount === 'number' ? { blur_amount: c.blur_amount } : {}),
      }));
      bumpPreview();
    };

    window.addEventListener('qs:hero:set', onGenericSet as any);
    window.addEventListener('qs:hero:set-layout', onLayout as any);
    window.addEventListener('qs:hero:set-overlay', onOverlay as any);
    window.addEventListener('qs:hero:auto-fix', onAutoFix as any);
    window.addEventListener('qs:template:apply-patch', onApplyPatch as any);

    return () => {
      window.removeEventListener('qs:hero:set', onGenericSet as any);
      window.removeEventListener('qs:hero:set-layout', onLayout as any);
      window.removeEventListener('qs:hero:set-overlay', onOverlay as any);
      window.removeEventListener('qs:hero:auto-fix', onAutoFix as any);
      window.removeEventListener('qs:template:apply-patch', onApplyPatch as any);
    };
  }, [block]);

  /* ---------- save ---------- */
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
      window.dispatchEvent(
        new CustomEvent('qs:toolbar:save-now', { detail: { source: 'hero-editor' } }),
      );
    });
  };

  const errorText = (path: string) =>
    errors?.[path]?.length ? (
      <p className="text-xs text-red-400 mt-1">{errors[path][0].message}</p>
    ) : null;

  useEffect(() => {
    if (!imgSubjectTouched) {
      const s = `${promptIndustryLabel} website hero banner`;
      setImgSubject(s);
      update('image_subject', s as any);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptIndustryLabel]);

  // reflect meta live — build a minimal patch (do NOT clone existing meta)
  useEffect(() => {
    // Treat "other" without text as not chosen
    const effIndustryKey =
      industryKey === 'other' && !aiIndustryOther.trim() ? '' : industryKey;

    const patch: any = {};
    if (effIndustryKey) {
      patch.industry = effIndustryKey;
      patch.industry_label =
        effIndustryKey === 'other'
          ? 'Other'
          : toIndustryLabel(resolveIndustryKey(effIndustryKey));
      patch.industry_other = effIndustryKey === 'other' ? aiIndustryOther.trim() || null : null;
    }
    if (siteType) patch.site_type = siteType;

    try {
      if (Object.keys(patch).length) {
        window.dispatchEvent(new CustomEvent('qs:template:merge', { detail: { meta: patch } }));
        window.dispatchEvent(
          new CustomEvent('qs:template:apply-patch', {
            detail: {
              data: { ...(template?.data as any), meta: { ...(metaAll || {}), ...patch } },
              industry: effIndustryKey || undefined,
              site_type: siteType || undefined,
            } as any,
          }),
        );
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [industryKey, aiIndustryOther, siteType]);

  // --------- API helpers (now include industry_key) ----------
  async function requestSuggestions() {
    const res = await fetch('/api/hero/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_id: template?.id,
        industry: effectiveIndustryLabel,
        industry_key: effectiveIndustryKey,
        site_type: siteType || 'small_business',
        services: (template as any)?.services ?? [],
        business_name: (template as any)?.business_name,
        city: (template as any)?.city,
        state: (template as any)?.state,
      }),
    });
    if (!res.ok) throw new Error(`Suggest failed (${res.status})`);
    return (await res.json()) as any;
  }

  // Put this with the other helpers (above the component)
  function guessIndustryLabelFromCopy(headline: string, subheadline: string) {
    const text = `${headline || ''} ${subheadline || ''}`.toLowerCase();

    // quick exact/substring checks against your known labels
    for (const opt of getIndustryOptions()) {
      const lbl = String(opt.label || '').toLowerCase();
      if (!lbl) continue;
      if (text.includes(lbl)) return opt.label; // e.g., "Windshield Repair"
    }

    // minimal synonyms to cover common phrasing
    const synonyms: Record<string, string> = {
      'windshield repair': 'Windshield Repair',
      'auto glass': 'Windshield Repair',
      'auto-glass': 'Windshield Repair',
    };
    for (const [needle, label] of Object.entries(synonyms)) {
      if (text.includes(needle)) return label;
    }

    return ''; // unknown
  }

  async function suggestAll() {
    setAiLoading(true); setAiError(null);
    try {
      const raw = await requestSuggestions();
      const { headline, subheadline, cta_text } = normalizeSuggested(raw);
  
      const defaultsByType: Record<string, { h: string; sh: string; cta: string }> = {
        portfolio: { h: 'Work That Speaks For Itself', sh: 'A curated selection of recent projects and collaborations.', cta: 'View Portfolio' },
        blog: { h: 'Ideas, Notes & Updates', sh: 'Writing on craft, process, and what I’m exploring next.', cta: 'Read the Blog' },
        about_me: { h: 'Hi, I’m ___', sh: 'A simple page about who I am and what I do.', cta: 'Get In Touch' },
        small_business: { h: 'Your Trusted Local Service', sh: 'Fast, reliable solutions tailored to your needs.', cta: 'Get Started Today' },
      };
      const d = defaultsByType[siteType || 'small_business'];
  
      // 1) Apply copy
      const H = headline || d.h;
      const SH = subheadline || d.sh;
      const CTA = cta_text || d.cta;
  
      setLocal((prev: any) => ({ ...prev, headline: H, subheadline: SH, cta_text: CTA }));
  
      // 2) Ensure site_type defaults to small_business if unset
      if (!siteType) {
        setSiteType('small_business' as SiteType);
        requestAnimationFrame(() => {
          window.dispatchEvent(new CustomEvent('qs:template:merge', {
            detail: { meta: { site_type: 'small_business' } }
          }));
        });
      }
  
      // 3) If industry not chosen (''), or it's the seeded "other" w/o text, try to infer
      const seededOther = industryKey === 'other' && !aiIndustryOther.trim();
      if (!industryKey || seededOther) {
        // prefer whatever label we already computed; otherwise guess from the copy
        let label = effectiveIndustryLabel || (industryKey === 'other' ? aiIndustryOther.trim() : '');
        if (!label) label = guessIndustryLabelFromCopy(H, SH);
  
        if (label) {
          const key = resolveIndustryKey(label);
          if (key && key !== 'other') {
            // we have a concrete key → use canonical label
            const canonLabel = toIndustryLabel(key);
            setIndustryKey(key);
            setAiIndustryOther('');
            requestAnimationFrame(() => {
              window.dispatchEvent(new CustomEvent('qs:template:merge', {
                detail: { meta: { site_type: siteType || 'small_business', industry: key, industry_label: canonLabel, industry_other: null } }
              }));
            });
          } else {
            // we only have a free-text label → store as "other"
            setIndustryKey('other');
            setAiIndustryOther(label);
            requestAnimationFrame(() => {
              window.dispatchEvent(new CustomEvent('qs:template:merge', {
                detail: { meta: { site_type: siteType || 'small_business', industry: 'other', industry_label: 'Other', industry_other: label } }
              }));
            });
          }
        }
      }
  
      toast.success('Suggested copy applied');
      refreshPreview();
    } catch (e: any) {
      setAiError(e?.message || 'Failed to fetch suggestions');
      toast.error('Could not get AI suggestions');
    } finally {
      setAiLoading(false);
    }
  }
  
  async function generateHeroImage() {
    setImgLoading(true);
    setImgError(null);
    try {
      const base =
        `website hero (header/banner) image for a ${effectiveIndustryLabel || 'local small business'} small business. ` +
        `${imgSubject}. wide 16:9 composition with clear copy space for headline, clean modern background, high detail, no text, no watermarks, no logos.`;
      const negatives = imgIncludePeople
        ? 'no text, no watermark, no logo'
        : 'no people, no faces, no portraits, no hands, no superheroes, no text, no watermark, no logo';

      const res = await fetch('/api/hero/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: template?.id,
          industry: effectiveIndustryLabel,
          industry_key: effectiveIndustryKey,
          site_type: siteType || 'small_business',
          services: (template as any)?.services ?? [],
          business_name: (template as any)?.business_name,
          city: (template as any)?.city,
          state: (template as any)?.state,
          subject: imgSubject,
          style: imgStyle,
          aspect: 'wide',
          prompt: base,
          negative: negatives,
          include_people: imgIncludePeople,
          prompt_context: {
            purpose: 'website hero header',
            layout: 'wide 16:9 with copy space',
            include_people: imgIncludePeople,
          },
        }),
      });
      if (!res.ok) throw new Error(`Image generate failed (${res.status})`);
      const { image_base64 } = await res.json();
      if (!image_base64) throw new Error('No image returned');

      const clean = image_base64.replace(/^data:image\/\w+;base64,/, '');
      const byteChars = atob(clean);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'image/png' });
      const file = new File([blob], `hero-${Date.now()}.png`, { type: 'image/png' });

      const uploaded = (await uploadToStorage(file, `template-${template?.id}/hero`)) as any;
      const publicUrl =
        typeof uploaded === 'string'
          ? uploaded
          : uploaded?.publicUrl ||
            uploaded?.publicURL ||
            uploaded?.signedUrl ||
            uploaded?.data?.publicUrl ||
            uploaded?.data?.publicURL ||
            '';

      const nextUrl = publicUrl || `data:image/png;base64,${clean}`;

      setLocal((prev: any) => ({
        ...prev,
        image_url: nextUrl,
        image: nextUrl,
        heroImage: nextUrl,
        backgroundImage: nextUrl,
        layout_mode:
          prev?.layout_mode && prev.layout_mode !== 'inline' ? prev.layout_mode : 'background',
        layout: prev?.layout && prev.layout !== 'inline' ? prev.layout : 'background',
        overlay_level: prev?.overlay_level ?? 'soft',
        overlay: prev?.overlay ?? 'soft',
      }));

      console.log('[hero] uploaded image url →', publicUrl || '(data url fallback)');
      toast.success(publicUrl ? 'Hero image generated' : 'Image ready (inline preview)');

      bumpPreview();
    } catch (e: any) {
      setImgError(e?.message || 'Failed to generate image');
      toast.error('Could not generate image');
      console.error('generateHeroImage error', e);
    } finally {
      setImgLoading(false);
    }
  }

  // Close on Esc
  useEffect(() => {
    const onEsc = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

  /* ───────────────── UI ───────────────── */
  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Hero Editor"
    >
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

          {step === 2 && (
            <div className="inline-flex rounded-full border border-white/15 bg-neutral-900 p-1 text-xs">
              <button
                className={`px-3 py-1 rounded-full ${
                  mode === 'express' ? 'bg-white text-gray-900' : 'text-white/80'
                }`}
                onClick={() => setMode('express')}
              >
                Express
              </button>
              <button
                className={`px-3 py-1 rounded-full ${
                  mode === 'advanced' ? 'bg-white text-gray-900' : 'text-white/80'
                }`}
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
          {step === 2 && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-xs text-white/80 mt-3 mb-3">
              Hover the hero preview to edit ✎ or use ✨ for quick rewrites. Switch to Advanced for
              full form controls.
            </div>
          )}

          {/* Step 1: type pick */}
          {step === 1 && (
            <div className="space-y-3 mt-3">
              <div className="text-sm font-medium">What kind of site are you building?</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {SITE_TYPES.map(({ key, label, blurb, Icon }) => {
                  const active = siteType === key;
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setSiteType(key);
                        // NEW: broadcast site_type immediately so Identity reflects fast
                        requestAnimationFrame(() => {
                          window.dispatchEvent(
                            new CustomEvent('qs:template:merge', {
                              detail: { meta: { site_type: key } },
                            }),
                          );
                        });

                        if (key === 'small_business') {
                          setShowMoreTypes(true);
                        } else {
                          // Non-business types: set industry to "other" with friendly label
                          setIndustryKey('other');
                          const other = blurb === 'Show your work' ? 'Portfolio' : label;
                          setAiIndustryOther(other);

                          // NEW: immediate broadcast for Identity panel
                          requestAnimationFrame(() => {
                            window.dispatchEvent(
                              new CustomEvent('qs:template:merge', {
                                detail: {
                                  meta: {
                                    site_type: key,
                                    industry: 'other',
                                    industry_label: 'Other',
                                    industry_other: other,
                                  },
                                },
                              }),
                            );
                          });

                          setTimeout(() => setStep(2), 0);
                        }
                      }}
                      className={[
                        'group relative rounded-xl border bg-gray-50 dark:bg-neutral-900 p-4 text-left',
                        'hover:bg-white dark:hover:bg-neutral-800 transition',
                        active
                          ? 'border-purple-500 ring-2 ring-purple-500/40'
                          : 'border-gray-300 dark:border-neutral-700 hover:border-purple-400',
                      ].join(' ')}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={[
                            'h-11 w-11 rounded-lg flex items-center justify-center',
                            'bg-white dark:bg-neutral-950 border',
                            active ? 'border-purple-500' : 'border-gray-200 dark:border-neutral-700',
                          ].join(' ')}
                        >
                          <Icon className="h-6 w-6 text-gray-700 dark:text-gray-200" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white truncate">
                            {label}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{blurb}</div>
                        </div>
                        <ChevronRight className="ml-auto h-4 w-4 text-gray-400 group-hover:text-purple-500" />
                      </div>
                    </button>
                  );
                })}
              </div>

              {!showMoreTypes ? (
                <div className="px-1">
                  <button
                    className="w-full rounded-md px-3 py-2 text-sm bg-white/10 hover:bg-white/20 text-white"
                    onClick={() => setShowMoreTypes(true)}
                  >
                    More site types…
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {/* Industry chooser */}
          {step === 1 && showMoreTypes && (
            <div className="rounded border border-white/10 bg-neutral-900 p-3 space-y-2 mt-3">
              <div className="grid md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-neutral-300">Industry</label>
                  <select
                    className={selectDark}
                    value={industryKey}
                    onChange={(e) => {
                      const val = e.target.value;
                      setIndustryKey(val);

                      // NEW: immediate broadcast
                      const k = resolveIndustryKey(val);
                      const meta =
                        k === 'other'
                          ? {
                              industry: 'other',
                              industry_label: 'Other',
                              industry_other: aiIndustryOther.trim() || null,
                            }
                          : { industry: k, industry_label: toIndustryLabel(k), industry_other: null };

                      requestAnimationFrame(() => {
                        window.dispatchEvent(
                          new CustomEvent('qs:template:merge', {
                            detail: {
                              meta: { ...meta, site_type: siteType || 'small_business' },
                            },
                          }),
                        );
                      });
                    }}
                  >
                    <option value="">{'— Select —'}</option>
                    {industryOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-neutral-300">Other (if not in the list)</label>
                  <input
                    className={selectDark}
                    value={aiIndustryOther}
                    onChange={(e) => {
                      const v = e.target.value;
                      setAiIndustryOther(v);

                      // NEW: mirror when typing "Other"
                      if (industryKey === 'other') {
                        requestAnimationFrame(() => {
                          window.dispatchEvent(
                            new CustomEvent('qs:template:merge', {
                              detail: {
                                meta: {
                                  site_type: siteType || 'small_business',
                                  industry: 'other',
                                  industry_label: 'Other',
                                  industry_other: v.trim() || null,
                                },
                              },
                            }),
                          );
                        });
                      }
                    }}
                    placeholder="e.g., Mobile Windshield Repair"
                    disabled={industryKey !== 'other'}
                  />
                </div>
              </div>
              <p className="text-xs text-neutral-400 pt-1">
                Choose an industry (or enter your own) to continue.
              </p>
            </div>
          )}

          {/* Step 2 */}
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
                    {aiLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {aiLoading ? 'Working…' : 'Suggest All'}
                  </button>
                </div>
                {aiError && <div className="text-xs text-red-300">{aiError}</div>}
              </div>

              {/* Express */}
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
                        {imgLoading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ImageIcon className="h-3.5 w-3.5" />
                        )}{' '}
                        Generate
                      </button>
                    </div>
                    <input
                      className={selectDark}
                      value={imgSubject}
                      onChange={(e) => {
                        setImgSubject(e.target.value);
                        setImgSubjectTouched(true);
                        update('image_subject', e.target.value as any);
                      }}
                      placeholder={`${promptIndustryLabel} website hero banner`}
                    />
                    {imgError && <div className="text-xs text-red-300 mt-1">{imgError}</div>}

                    {/* Thumb + actions */}
                    {local?.image_url && (
                      <div className="mt-2 flex items-start gap-3">
                        <img
                          src={local.image_url}
                          alt="Hero"
                          className="h-20 w-36 object-cover rounded border border-white/10"
                        />
                        <div className="flex flex-wrap gap-2">
                          <a
                            href={local.image_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs px-2 py-1 rounded border border-white/15 hover:bg-white/10"
                          >
                            Open
                          </a>
                          <button
                            className="text-xs px-2 py-1 rounded border border-white/15 hover:bg-white/10"
                            onClick={() => {
                              setLocal((p: any) => ({
                                ...p,
                                layout_mode: 'background',
                                layout: 'background',
                                overlay_level: p?.overlay_level ?? 'soft',
                                overlay: p?.overlay ?? 'soft',
                              }));
                              bumpPreview();
                            }}
                          >
                            Use as Background
                          </button>
                          <button
                            className="text-xs px-2 py-1 rounded border border-white/15 hover:bg-white/10"
                            onClick={() => {
                              setLocal((p: any) => ({
                                ...p,
                                image_url: '',
                                image: '',
                                heroImage: '',
                                backgroundImage: '',
                              }));
                              bumpPreview();
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Quick Controls (overlay) */}
                    <div className="rounded border border-white/10 bg-neutral-900 p-3 mt-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">Quick Controls</div>
                        <button
                          onClick={() => {
                            setLocal((p: any) => {
                              const cur = (p?.overlay_level ?? p?.overlay ?? 'none') as
                                | 'none'
                                | 'soft'
                                | 'strong';
                              const next = cur === 'none' ? 'soft' : 'strong';
                              return {
                                ...p,
                                overlay_level: next,
                                overlay: next,
                                layout_mode:
                                  p?.layout_mode && p.layout_mode !== 'inline'
                                    ? p.layout_mode
                                    : 'background',
                                layout:
                                  p?.layout && p.layout !== 'inline' ? p.layout : 'background',
                              };
                            });
                            // also notify renderer listeners
                            window.dispatchEvent(new CustomEvent('qs:hero:auto-fix'));
                            bumpPreview();
                          }}
                          className="inline-flex items-center gap-1.5 rounded border border-white/15 px-2 py-1 text-xs hover:bg-white/10"
                          title="Increase overlay for better contrast"
                        >
                          Auto-fix
                        </button>
                      </div>
                      <div className="mt-2 inline-flex rounded-lg border border-white/15 bg-neutral-900 p-1 text-xs">
                        {(['none', 'soft', 'strong'] as const).map((lvl) => (
                          <button
                            key={lvl}
                            onClick={() => {
                              setLocal((p: any) => ({ ...p, overlay_level: lvl, overlay: lvl }));
                              window.dispatchEvent(
                                new CustomEvent('qs:hero:set', { detail: { overlay_level: lvl } }),
                              );
                              bumpPreview();
                            }}
                            className={`px-3 py-1 rounded-md ${
                              (local?.overlay_level ?? local?.overlay ?? 'soft') === lvl
                                ? 'bg-white text-gray-900'
                                : 'text-white/80'
                            }`}
                          >
                            {lvl}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-neutral-300">Style</label>
                    <select
                      className={selectDark}
                      value={imgStyle}
                      onChange={(e) => setImgStyle(e.target.value as any)}
                    >
                      <option value="photo">Photo</option>
                      <option value="illustration">Illustration</option>
                      <option value="3d">3D Render</option>
                      <option value="minimal">Minimal</option>
                    </select>
                  </div>

                  <div className="md:col-span-3 flex items-center justify-between">
                    <label className="text-xs text-neutral-300">Include people in image</label>
                    <Switch
                      checked={imgIncludePeople}
                      onCheckedChange={(v) => setImgIncludePeople(!!v)}
                    />
                  </div>
                </div>
              )}

              {/* Advanced */}
              {mode === 'advanced' && (
                <>
                  <div className="grid md:grid-cols-3 gap-3 mt-3">
                    <div>
                      <label className="text-xs text-neutral-300">Headline</label>
                      <input
                        className={selectDark}
                        value={local?.headline || ''}
                        onChange={(e) => update('headline', e.target.value as any)}
                        placeholder="Fast, Reliable Service"
                      />
                      {errorText(`${fieldKey}.headline`)}
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs text-neutral-300">Subheadline</label>
                      <input
                        className={selectDark}
                        value={local?.subheadline || ''}
                        onChange={(e) => update('subheadline', e.target.value as any)}
                        placeholder="24/7 local help with transparent pricing."
                      />
                      {errorText(`${fieldKey}.subheadline`)}
                    </div>
                    <div>
                      <label className="text-xs text-neutral-300">CTA Text</label>
                      <input
                        className={selectDark}
                        value={local?.cta_text || ''}
                        onChange={(e) => update('cta_text', e.target.value as any)}
                        placeholder="Get Started"
                      />
                      {errorText(`${fieldKey}.cta_text`)}
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs text-neutral-300">CTA Action</label>
                      <div className="grid grid-cols-3 gap-2">
                        <select
                          className={selectDark}
                          value={local?.cta_action || 'go_to_page'}
                          onChange={(e) => update('cta_action', e.target.value as any)}
                        >
                          <option value="jump_to_contact">Jump to Contact</option>
                          <option value="go_to_page">Go to Page</option>
                          <option value="call_phone">Call Phone</option>
                        </select>
                        {(local?.cta_action || 'go_to_page') === 'go_to_page' && (
                          <input
                            className={selectDark}
                            value={local?.cta_link ?? '/contact'}
                            onChange={(e) => update('cta_link', e.target.value as any)}
                            placeholder="/contact"
                          />
                        )}
                        {local?.cta_action === 'jump_to_contact' && (
                          <input
                            className={selectDark}
                            value={local?.contact_anchor_id ?? 'contact'}
                            onChange={(e) => update('contact_anchor_id', e.target.value as any)}
                            placeholder="contact"
                          />
                        )}
                        {local?.cta_action === 'call_phone' && (
                          <input
                            className={selectDark}
                            value={local?.cta_phone ?? ''}
                            onChange={(e) => update('cta_phone', e.target.value as any)}
                            placeholder="enter 10-digit phone"
                          />
                        )}
                      </div>
                      <div className="mt-1">
                        <label className="inline-flex items-center gap-2 text-xs">
                          <Switch
                            checked={!!local?.cta_show_phone_below}
                            onCheckedChange={(v) => update('cta_show_phone_below', v as any)}
                          />
                          <span>Show phone number under CTA</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-2 grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="text-xs text-neutral-300">Layout Mode</label>
                      <select
                        value={local?.layout || local?.layout_mode || 'inline'}
                        onChange={(e) => {
                          update('layout_mode', e.target.value as any);
                          update('layout', e.target.value as any);
                          bumpPreview();
                        }}
                        className={selectDark}
                      >
                        <option value="inline">Inline Image</option>
                        <option value="background">Image as Background</option>
                        <option value="full_bleed">Full-Bleed Image</option>
                        <option value="natural_height">Natural Height</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-neutral-300">Blur Amount (0–30px)</label>
                      <input
                        type="range"
                        min={0}
                        max={30}
                        step={1}
                        value={local?.blur_amount ?? 8}
                        onChange={(e) => {
                          update('blur_amount', Number(e.target.value) as any);
                          bumpPreview();
                        }}
                        className={rangeDark}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-neutral-300">Image X</label>
                      <input
                        className={selectDark}
                        value={local?.image_x || ''}
                        onChange={(e) => {
                          update('image_x', e.target.value as any);
                          bumpPreview();
                        }}
                        placeholder="center"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-neutral-300">Image Y</label>
                      <input
                        className={selectDark}
                        value={local?.image_y || ''}
                        onChange={(e) => {
                          update('image_y', e.target.value as any);
                          bumpPreview();
                        }}
                        placeholder="bottom"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-neutral-300">Overlay Level</label>
                      <div className="mt-1 inline-flex rounded-lg border border-white/15 bg-neutral-900 p-1 text-xs">
                        {(['none', 'soft', 'strong'] as const).map((lvl) => (
                          <button
                            key={lvl}
                            onClick={() => {
                              update('overlay_level', lvl as any);
                              update('overlay', lvl as any);
                              bumpPreview();
                            }}
                            className={`px-3 py-1 rounded-md ${
                              (local?.overlay_level ?? local?.overlay ?? 'soft') === lvl
                                ? 'bg-white text-gray-900'
                                : 'text-white/80'
                            }`}
                          >
                            {lvl}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Live preview bridge */}
              <div className="mt-3">
                <BlockPreviewToggle
                  key={previewNonce}
                  block={{
                    ...block,
                    type: 'hero',
                    [fieldKey]: {
                      ...(block as any)[fieldKey],
                      ...toCanonicalHeroProps(local, template),
                    },
                    [altKey]: {
                      ...(block as any)[altKey],
                      ...toCanonicalHeroProps(local, template),
                    },
                  }}
                  template={template as Template}
                />
              </div>
            </>
          )}
        </div>

        {/* sticky footer */}
        <div className="sticky bottom-0 z-10 border-t border-white/10 bg-neutral-950/90 backdrop-blur px-4 py-3 flex justify-end gap-2">
          <button
            onClick={() => onClose?.()}
            className="text-sm px-3 py-1.5 border border-white/10 rounded bg-neutral-900 hover:bg-neutral-800"
          >
            Cancel
          </button>

          {step === 1 ? (
            <button
              onClick={() => setStep(2)}
              disabled={!step1Valid}
              className="text-sm px-3 py-1.5 rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60"
              title={
                step1Valid
                  ? 'Continue'
                  : 'Choose a site type (and industry if Small Business) to continue'
              }
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSave}
              className="text-sm px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              Save
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
