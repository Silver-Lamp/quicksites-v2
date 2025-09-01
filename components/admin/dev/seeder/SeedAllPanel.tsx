// components/admin/dev/seeder/SeedAllPanel.tsx
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Loader } from 'lucide-react';

import type { SeedMode, SeedParams } from './types';
import { buildIndustryPrompt } from './industries';
import { useSeedApi } from './hooks/useSeedApi';
import { useSeedProgress } from './hooks/useSeedProgress';
import { ProgressSteps } from './ui/ProgressSteps';

import { HeaderBar } from './ui/HeaderBar';
import { PreviewResults } from './ui/PreviewResults';
import { IndustryPromptRow } from './sections/IndustryPromptRow';
import { MerchantsProductsSection } from './sections/MerchantsProductsSection';
import { TemplatesSection } from './sections/TemplatesSection';
import { LegacySection } from './sections/LegacySection';
import { DangerZoneSection } from './sections/DangerZoneSection';
import RunCostEstimate from '../../seed/RunCostEstimate';
import TemplateJsonEditor from './TemplateJsonEditor';
import { BlocksPicker } from './BlocksPicker';

// Progress models
const PREVIEW_MODEL = [
  { key: 'auth',             label: 'Check admin' },
  { key: 'user',             label: 'Prepare demo user' },
  { key: 'merchant',         label: 'Ensure merchant' },
  { key: 'ideate',           label: 'Ideate brand & products' },
  { key: 'logo_preview',     label: 'Logo preview' },
  { key: 'product_previews', label: 'Product previews' },
  { key: 'template_preview', label: 'Template preview' },
  { key: 'result',           label: 'Finalize preview' },
];

const SAVE_MODEL = [
  { key: 'auth',                   label: 'Check admin' },
  { key: 'user',                   label: 'Find user' },
  { key: 'merchant',               label: 'Ensure merchant' },
  { key: 'clear_products',         label: 'Clear products' },
  { key: 'upload_logo',            label: 'Upload logo' },
  { key: 'upload_product_images',  label: 'Upload images' },
  { key: 'upsert_products',        label: 'Upsert products' },
  { key: 'save_template',          label: 'Save template' },
  { key: 'attach_template',        label: 'Attach template' },
  { key: 'publish_site',           label: 'Publish site' },
  { key: 'result',                 label: 'Finalize save' },
];

type BlockPick = { enabled: boolean; config?: Record<string, any> };
type Picks = Partial<Record<
  'header' | 'hero' | 'services' | 'faq' | 'testimonial' | 'contact_form' | 'service_areas' | 'footer',
  BlockPick
>>;

export default function SeedAllPanel() {
  // ===== global =====
  const [seed, setSeed] = React.useState('');
  const [seedMode, setSeedMode] = React.useState<SeedMode>('merchant_products');
  const [industry, setIndustry] = React.useState<string>('Retail - Boutique');
  const [aiPrompt, setAiPrompt] = React.useState('Neighborhood artisan brand; friendly, trustworthy, quality-first.');

  // ===== legacy =====
  const [profileOverwrite, setProfileOverwrite] = React.useState(true);
  const [avatar, setAvatar] = React.useState(true);
  const [avatarStyle, setAvatarStyle] = React.useState<'photo'|'illustration'>('photo');
  const [avatarSize, setAvatarSize] = React.useState<'256x256'|'512x512'|'1024x1024'>('1024x1024');
  const [mealsCount, setMealsCount] = React.useState(8);
  const [genMealImages, setGenMealImages] = React.useState(true);
  const [mealImgStyle, setMealImgStyle] = React.useState<'photo'|'illustration'>('photo');
  const [mealImgSize, setMealImgSize] = React.useState<'256x256'|'512x512'|'1024x1024'>('1024x1024');

  // ===== merchants/products =====
  const [merchantOverwrite, setMerchantOverwrite] = React.useState(true);
  const [merchantLogo, setMerchantLogo]         = React.useState(true);
  const [merchantLogoStyle, setMerchantLogoStyle] = React.useState<'photo'|'illustration'>('illustration');
  const [merchantLogoSize, setMerchantLogoSize] = React.useState<'256x256'|'512x512'|'1024x1024'>('1024x1024');

  const [productsCount, setProductsCount] = React.useState(4);
  const [productsProductType, setProductsProductType] = React.useState<'meal'|'physical'|'digital'|'service'|'mixed'>('physical');
  const [productsGenerateImages, setProductsGenerateImages] = React.useState(true);
  const [productsImageStyle, setProductsImageStyle] = React.useState<'photo'|'illustration'>('photo');
  const [productsImageSize, setProductsImageSize] = React.useState<'256x256'|'512x512'|'1024x1024'>('1024x1024');

  // ===== templates / site =====
  const [templateGenerate, setTemplateGenerate] = React.useState(true);
  const [templateLayout, setTemplateLayout]     = React.useState<'standard'|'onepage'>('standard');
  const [templateTheme, setTemplateTheme]       = React.useState<'light'|'dark'>('light');
  const [templateAttachToMerchant, setTemplateAttachToMerchant] = React.useState(true);
  const [templatePublishSite, setTemplatePublishSite]           = React.useState(true);
  const [siteSubdomain, setSiteSubdomain]       = React.useState('');

  // ===== ui state =====
  const [productsOpen, setProductsOpen] = React.useState(true);
  const [legacyOpen, setLegacyOpen]     = React.useState(false);
  const [merchantProfileOpen, setMerchantProfileOpen] = React.useState(false);
  const [templateOpen, setTemplateOpen] = React.useState(true);
  const [dangerOpen, setDangerOpen]     = React.useState(false);
  const [templateIdFromContext, setTemplateIdFromContext] = React.useState<string | null>(null);
  const [_danger, _setDanger] = React.useState({ clearProductsFirst: true, clearMealsFirst: true });

  // ===== template blocks (admin-configurable) =====
  const [blockPicks, setBlockPicks] = React.useState<Picks>({
    header:        { enabled: true },
    hero:          { enabled: true,  config: { headline: '' } },
    services:      { enabled: true,  config: { columns: 3 } },
    faq:           { enabled: false },
    testimonial:   { enabled: false },
    contact_form:  { enabled: true },
    service_areas: { enabled: false },
    footer:        { enabled: true },
  });
  const [blockOrder, setBlockOrder] = React.useState<ReadonlyArray<keyof Picks>>(
    ['header','hero','services','faq','contact_form','footer']
  );

  const handleEstimateReady = React.useCallback((ready: boolean) => {
    setSeedDisabled(!ready);
  }, []);

  // Result/error container (for PreviewResults)
  const { pending, error, result, setResult } = useSeedApi();

  // streaming progress
  const seedProgress = useSeedProgress();
  const [runMode, setRunMode] = React.useState<'preview'|'save'|null>(null);
  const [lastCompletedMode, setLastCompletedMode] = React.useState<'preview'|'save'|null>(null);

  // finished when result or error present or percent >= 100
  const finished  = !!seedProgress.result || !!seedProgress.error || seedProgress.percent >= 100;
  const streaming = runMode !== null && !finished;
  const busy      = pending || streaming;

  React.useEffect(() => {
    setProductsOpen(seedMode !== 'chef_meals');
    setLegacyOpen(seedMode !== 'merchant_products');
  }, [seedMode]);

  function suggestPrompt() { setAiPrompt(buildIndustryPrompt(industry, aiPrompt, productsProductType)); }

  function collectParams(): SeedParams {
    // Shape for server: templateBlocks (order, picks, theme/layout)
    const templateBlocks = {
      order: blockOrder as string[],
      picks: blockPicks,
      theme: templateTheme,
      layout: templateLayout,
    };

    return {
      // global
      seed: seed || undefined,
      seedMode, industry, aiPrompt,

      // legacy
      profileOverwrite, avatar, avatarStyle, avatarSize,
      mealsCount, mealsGenerateImages: genMealImages, mealsImageStyle: mealImgStyle, mealsImageSize: mealImgSize,
      mealsClearExisting: _danger.clearMealsFirst,

      // merchants/products
      merchantOverwrite, merchantAvatar: merchantLogo, merchantAvatarStyle: merchantLogoStyle, merchantAvatarSize: merchantLogoSize,
      productsCount, productsProductType, productsGenerateImages, productsImageStyle, productsImageSize,
      productsClearExisting: _danger.clearProductsFirst,

      // templates
      templateGenerate, templateLayout, templateTheme, templateAttachToMerchant,
      templatePublishSite, siteSubdomain: siteSubdomain || undefined,

      // NEW: pass the admin’s block selection
      templateBlocks,
    } as any;
  }

  // === Streaming Preview/Save ===
  async function onPreview() {
    setRunMode('preview');
    await seedProgress.start('preview', collectParams());
    setRunMode(null);
  }

  async function onSave() {
    setRunMode('save');
    await seedProgress.start('save', {
      ...collectParams(),
      previewBrand:       result?.merchant?.preview?.brand ?? null,
      previewLogoDataUrl: result?.merchant?.preview?.logo_data_url ?? null,
      previewItems:       result?.products?.items ?? [],
      previewTemplate:    (result as any)?.template?.preview ?? null,
    });
    setRunMode(null);
  }

  function onClearPreview()  { setResult(null); }

  // Mirror streamed result + remember which mode just finished
  React.useEffect(() => {
    if (!seedProgress.result) return;
    setResult(seedProgress.result);
    const suggested =
      (seedProgress.result as any)?.suggestedSiteSlug ||
      seedProgress.result?.template?.preview?.slug;
    if (suggested && !siteSubdomain) setSiteSubdomain(suggested);

    setLastCompletedMode(
      seedProgress.result.mode === 'saved' ? 'save' : 'preview'
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedProgress.result]);

  // choose model: if we're running, use runMode; else use the last completed mode; default preview
  const uiMode: 'preview'|'save' =
    (runMode ?? lastCompletedMode ?? 'preview');

  const combinedError = seedProgress.error || error;
  const progressModel = uiMode === 'save' ? SAVE_MODEL : PREVIEW_MODEL;

  // ===== Cost estimator integration =====
  const [seedDisabled, setSeedDisabled] = React.useState(false);
  const [productsImagesPerItem, setProductsImagesPerItem] = React.useState(1);

  // Use the live preview template (when present) to price hero images/text more accurately
  const templateDraft = React.useMemo(
    () => (result as any)?.template?.preview ?? null,
    [result]
  );

  const onCancel = () => {
    if (streaming) seedProgress.cancel();
    else setResult(null);
  };

  return (
    <div className="rounded-xl border p-4 space-y-5">
      {/* Header + Mode */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-base font-semibold">Seed: Merchant + Products (AI)</div>
          <p className="text-xs text-muted-foreground">Generate merchant, products, template and publish a demo site.</p>
        </div>
        <div className="inline-flex rounded-lg border bg-background p-0.5">
          {(['merchant_products','chef_meals','both'] as SeedMode[]).map(opt => (
            <button
              key={opt}
              onClick={() => setSeedMode(opt)}
              className={[
                'px-3 py-1 text-xs rounded-md border',
                seedMode === opt ? 'border-primary/40 bg-primary/10 text-primary' : 'border-transparent hover:bg-muted'
              ].join(' ')}
            >
              {opt === 'merchant_products' ? 'Merchants + Products' : opt === 'chef_meals' ? 'Chefs + Meals' : 'Both'}
            </button>
          ))}
        </div>
      </div>

      {combinedError && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {combinedError}
        </div>
      )}

      {/* Industry + Prompt */}
      <IndustryPromptRow
        industry={industry} setIndustry={setIndustry}
        seed={seed} setSeed={setSeed}
        aiPrompt={aiPrompt} setAiPrompt={setAiPrompt}
        onSuggest={suggestPrompt}
      />

      {/* Merchants + Products */}
      {seedMode !== 'chef_meals' && (
        <Collapsible open={productsOpen} onOpenChange={setProductsOpen} className="rounded-lg border">
          <HeaderBar title="Merchants + Products" open={productsOpen} />
          <CollapsibleContent className="px-3 pb-3 pt-1 space-y-4">
            <MerchantsProductsSection
              productsCount={productsCount} setProductsCount={setProductsCount}
              productsProductType={productsProductType} setProductsProductType={setProductsProductType}
              productsGenerateImages={productsGenerateImages} setProductsGenerateImages={setProductsGenerateImages}
              productsImageStyle={productsImageStyle} setProductsImageStyle={setProductsImageStyle}
              productsImageSize={productsImageSize} setProductsImageSize={setProductsImageSize}
              merchantProfileOpen={merchantProfileOpen} setMerchantProfileOpen={setMerchantProfileOpen}
              merchantOverwrite={merchantOverwrite} setMerchantOverwrite={setMerchantOverwrite}
              merchantLogo={merchantLogo} setMerchantLogo={setMerchantLogo}
              merchantLogoStyle={merchantLogoStyle} setMerchantLogoStyle={setMerchantLogoStyle}
              merchantLogoSize={merchantLogoSize} setMerchantLogoSize={setMerchantLogoSize}
            />
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Template + Site */}
      <Collapsible open={templateOpen} onOpenChange={setTemplateOpen} className="rounded-lg border">
        <HeaderBar title="Template & Site" open={templateOpen} />
        <CollapsibleContent className="px-3 pb-3 pt-1 space-y-4">
          <TemplatesSection
            templateGenerate={templateGenerate} setTemplateGenerate={setTemplateGenerate}
            templateLayout={templateLayout} setTemplateLayout={setTemplateLayout}
            templateTheme={templateTheme} setTemplateTheme={setTemplateTheme}
            templateAttachToMerchant={templateAttachToMerchant} setTemplateAttachToMerchant={setTemplateAttachToMerchant}
            templatePublishSite={templatePublishSite} setTemplatePublishSite={setTemplatePublishSite}
            siteSubdomain={siteSubdomain} setSiteSubdomain={setSiteSubdomain}
          />

          {/* NEW: Block picker to control which blocks get added on seed */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Blocks to include on Home</div>
            <BlocksPicker value={blockPicks} onChange={setBlockPicks} />
            {/* If you want to expose custom order later, add a drag/sort UI and update blockOrder */}
          </div>
        </CollapsibleContent>

        {/* Advanced JSON editor */}
        <Collapsible className="rounded-lg border">
          <HeaderBar title="Template JSON (advanced)" open={templateOpen} />
          <CollapsibleContent className="px-3 pb-3 pt-1 space-y-4">
            <TemplateJsonEditor
              defaultTemplateId={result?.template?.template_id || templateIdFromContext || undefined}
            />
          </CollapsibleContent>
        </Collapsible>
      </Collapsible>

      {/* Legacy */}
      {seedMode !== 'merchant_products' && (
        <Collapsible open={legacyOpen} onOpenChange={setLegacyOpen} className="rounded-lg border">
          <HeaderBar title="Legacy: Chefs + Meals (advanced)" open={legacyOpen} />
          <CollapsibleContent className="px-3 pb-3 pt-1 space-y-4">
            <LegacySection
              profileOverwrite={profileOverwrite} setProfileOverwrite={setProfileOverwrite}
              avatar={avatar} setAvatar={setAvatar}
              avatarStyle={avatarStyle} setAvatarStyle={setAvatarStyle}
              avatarSize={avatarSize} setAvatarSize={setAvatarSize}
              mealsCount={mealsCount} setMealsCount={setMealsCount}
            />
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Danger Zone */}
      <Collapsible open={dangerOpen} onOpenChange={setDangerOpen} className="rounded-lg border">
        <HeaderBar title="Data Removal (danger zone)" open={dangerOpen} />
        <DangerZoneSection
          clearProductsFirst={_danger.clearProductsFirst} setClearProductsFirst={(v)=>_setDanger(s=>({...s, clearProductsFirst:v}))}
          clearMealsFirst={_danger.clearMealsFirst} setClearMealsFirst={(v)=>_setDanger(s=>({...s, clearMealsFirst:v}))}
        />
      </Collapsible>

      {/* Progress (streaming) */}
      <div className="rounded-xl border p-4 space-y-3">
        <div className="text-sm font-medium">Progress</div>
        <ProgressSteps
          model={uiMode === 'save' ? SAVE_MODEL : PREVIEW_MODEL}
          active={seedProgress.active}
          done={seedProgress.done}
          percent={seedProgress.percent}
          notes={seedProgress.notes}
        />
      </div>

      {/* Primary actions */}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={busy} onClick={onPreview}>
          {!busy || runMode !== 'preview'
            ? 'Preview (no save)'
            : (<><Loader className="mr-2 h-4 w-4 animate-spin" />Running…</>)}
        </Button>
        <Button disabled={busy} onClick={onSave}>
          {!busy || runMode !== 'save'
            ? 'Seed All'
            : (<><Loader className="mr-2 h-4 w-4 animate-spin" />Saving…</>)}
        </Button>
        {streaming && (
          <Button variant="secondary" onClick={seedProgress.cancel}>
            Cancel
          </Button>
        )}
      </div>

      {/* Cost + CTA row */}
      <div className="flex items-center justify-between gap-3">
        <RunCostEstimate
          productsCount={productsCount}
          productPhotosAi={productsGenerateImages}
          productImageSize={productsImageSize}            // "1024x1024"
          productImagesPerItem={productsImagesPerItem}    // default 1; add a UI control later if you want
          generateTemplate={templateGenerate}
          templateDraft={templateDraft}
          providerChat={process.env.NEXT_PUBLIC_AI_PROVIDER}
          modelChat={process.env.NEXT_PUBLIC_AI_MODEL}
          imageProviderHero="openai"
          imageModelHero="gpt-image-1:medium"
          imageProviderProduct="openai"
          imageModelProduct="gpt-image-1:medium"
          onReadyChange={handleEstimateReady}
        />
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button disabled={busy || seedDisabled} onClick={onSave} className="font-semibold">Seed All</Button>
        </div>
      </div>

      {/* Results */}
      <PreviewResults res={result} pending={busy} onSave={onSave} onClear={onClearPreview} />
    </div>
  );
}
