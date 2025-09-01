import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';

import { assertAdmin } from '../_lib/auth';
import { supabaseAdmin } from '../_lib/clients';
import { buildIndustryPrompt } from '../_lib/industries';
import { ideateBrandAndProducts, generateDataUrlPNG } from '../_lib/openaiIdeation';
import { uploadDataUrlPNG } from '../_lib/storage';
import { slugify, ensureUniqueBatchSlugs } from '../_lib/slugs';
import { ensureChefForUser, ensureMerchantForUser } from '../_lib/dbEnsure';
import { T_MERCHANTS, T_PRODUCTS, T_TEMPLATES } from '../_lib/env';
import { buildTemplatePreview, swapHeroInTemplate } from '../_lib/templates';
import { hydrateHeroBlocks } from '../_lib/heroHydrate';

// NEW: pre-save upgrader to kill legacy props-shape & map hero keys
import { upgradeLegacyBlocksDeep } from '../_lib/upgradeLegacyBlocks';

// modular persist helpers
import {
  ensureUniqueTemplateSubdomain,
  getOrCreateCanonicalTemplate,
  upsertTemplateAdaptive,
  patchTemplateIndustryServices,
} from '../_lib/templatePersist';

// modular builder
import { buildTemplateFromOptions } from '@/lib/seeding/templateBuilder';
import type { SeedTemplateOptions } from '@/lib/seeding/types';

// industry/services helpers
import { generateServices } from '@/lib/generateServices';
import { resolveIndustry } from '@/lib/industries';

// server-safe normalize
import { normalizeTemplate as normalizeTemplateServer } from '@/admin/utils/normalizeTemplate';

type StageKey =
  | 'auth' | 'user' | 'merchant' | 'chef'
  | 'ideate'
  | 'logo_preview' | 'product_previews'
  | 'template_preview'
  | 'clear_products' | 'upload_logo' | 'upload_product_images'
  | 'upsert_products' | 'save_template' | 'attach_template' | 'publish_site'
  | 'result';

const PREVIEW_WEIGHTS: Record<StageKey, number> = {
  auth: 2, user: 3, merchant: 5, chef: 0, ideate: 25,
  logo_preview: 10, product_previews: 40, template_preview: 10,
  clear_products: 0, upload_logo: 0, upload_product_images: 0,
  upsert_products: 0, save_template: 0, attach_template: 0, publish_site: 0,
  result: 5,
};
const SAVE_WEIGHTS: Record<StageKey, number> = {
  auth: 2, user: 3, merchant: 5, chef: 3, ideate: 0,
  logo_preview: 0, product_previews: 0, template_preview: 0,
  clear_products: 5, upload_logo: 8, upload_product_images: 35,
  upsert_products: 25, save_template: 10, attach_template: 2, publish_site: 5,
  result: 0,
};
const STAGE_LABEL: Record<StageKey, string> = {
  auth: 'Check admin', user: 'Prepare/Find user', merchant: 'Ensure merchant', chef: 'Ensure chef',
  ideate: 'Ideate brand & products',
  logo_preview: 'Logo preview', product_previews: 'Product previews',
  template_preview: 'Template preview',
  clear_products: 'Clear products', upload_logo: 'Upload logo', upload_product_images: 'Upload images',
  upsert_products: 'Upsert products', save_template: 'Save template', attach_template: 'Attach template', publish_site: 'Publish site',
  result: 'Finalize',
};

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: any) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      const stage = (key: StageKey, status: 'start' | 'done', extra: any = {}) => {
        console.log(`[seed/stream] ${STAGE_LABEL[key]}: ${status}`);
        send({ type: 'stage', key, status, ...extra });
      };
      let pulse: any = null;
      const end = (payload?: any) => {
        try {
          if (payload) send(payload);
        } catch {}
        clearInterval(pulse);
        controller.close();
      };

      try {
        const body = (await req.json()) as any;
        const isPreview = !!body?.dryRun || body?.mode === 'preview';
        const weights = isPreview ? PREVIEW_WEIGHTS : SAVE_WEIGHTS;
        const totalW = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
        let acc = 0;
        const bump = (k: StageKey) => {
          acc += weights[k] || 0;
          send({ type: 'progress', percent: Math.min(99, Math.round((acc / totalW) * 100)) });
        };
        pulse = setInterval(() => send({ type: 'pulse', t: Date.now() }), 5000);

        // ===== auth =====
        stage('auth', 'start');
        const gate = await assertAdmin();
        const adminUserId = gate?.adminUserId ?? null;
        if (!gate.ok) {
          send({ type: 'error', message: gate.error });
          return end();
        }
        stage('auth', 'done'); bump('auth');

        const seedTag = slugify(body.seed || '') || Math.random().toString(36).slice(2, 10);
        const targetEmail = (body.targetEmail || `seed+${seedTag}@demo.local`).toLowerCase();

        // ===== user =====
        stage('user', 'start');
        let authUser: any;
        if (isPreview) authUser = { id: randomUUID(), email: targetEmail };
        else {
          const list = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
          if (list.error) throw list.error;
          authUser =
            (list.data.users || []).find((u) => u.email?.toLowerCase() === targetEmail) ??
            (await supabaseAdmin.auth.admin.createUser({
              email: targetEmail,
              email_confirm: true,
              user_metadata: { name: 'Seed Merchant' },
            })).data.user;
        }
        const userId = authUser.id as string;
        stage('user', 'done'); bump('user');

        // ===== merchant/chef =====
        stage('merchant', 'start');
        const merchantNameBase = 'Seed ' + ((body.aiPrompt || '').split(/\W+/)?.[0] || 'Merchant');
        const merchantId = isPreview
          ? randomUUID()
          : await ensureMerchantForUser(supabaseAdmin as any, userId, merchantNameBase);
        stage('merchant', 'done'); bump('merchant');

        let chefId: string | null = null;
        if (!isPreview && body.seedMode !== 'merchant_products') {
          stage('chef', 'start');
          chefId = await ensureChefForUser(
            supabaseAdmin as any,
            userId,
            merchantId,
            merchantNameBase.replace(/^Seed\s+/, 'Chef '),
          );
          stage('chef', 'done'); bump('chef');
        }

        // ===== PREVIEW =====
        if (isPreview) {
          stage('ideate', 'start');
          const eff = buildIndustryPrompt(
            body.industry,
            body.aiPrompt,
            body.productsProductType ?? 'meal',
          );
          const count = Math.max(1, Math.min(48, Number(body.productsCount ?? body.mealsCount ?? 8)));
          const productType = body.productsProductType ?? 'meal';
          const ideated = await ideateBrandAndProducts({
            aiPrompt: eff,
            count,
            productType,
            seed: seedTag,
            industry: body.industry,
          });
          const brand: any = {
            ...ideated.brand,
            logo_data_url: null as string | null,
            hero_data_url: ideated.brand?.hero_data_url ?? null,
          };
          const products = ideated.products;
          stage('ideate', 'done'); bump('ideate');

          if (body.merchantAvatar) {
            stage('logo_preview', 'start');
            const styleAdj =
              body.merchantAvatarStyle === 'illustration'
                ? 'flat vector logo, clean, simple, high contrast'
                : 'professional brand photo logo, minimal';
            const logoPrompt = `Logo for ${brand?.name || merchantNameBase}, ${styleAdj}. Minimal, legible.`;
            brand.logo_data_url = await generateDataUrlPNG(
              logoPrompt,
              body.merchantAvatarSize || '1024x1024',
            );
            stage('logo_preview', 'done'); bump('logo_preview');
          }

          // Optional custom blocks selection for preview
          let previewData;
          const picks: SeedTemplateOptions | undefined = body?.templateBlocks;
          if (picks && picks.order) {
            const { key: industryKey, label: industryLabel } = resolveIndustry(body.industry, undefined);
            const serviceNames = generateServices({ industryKey }).map((s) => s.name);
            previewData = buildTemplateFromOptions({
              ...picks,
              theme: body.templateTheme ?? 'light',
              layout: body.templateLayout ?? 'standard',
              siteName: brand?.name || merchantNameBase,
              industryLabel,
              serviceNames: picks.picks?.services?.enabled ? serviceNames : [],
            });
          }

          stage('template_preview', 'start');
          if (!brand.hero_data_url) {
            brand.hero_data_url = await generateDataUrlPNG(
              `${brand?.name || merchantNameBase} hero, lifestyle product flatlay, soft studio light`,
              '1024x1024',
            );
          }
          let tplPrev = buildTemplatePreview({
            brand,
            products,
            industry: body.industry,
            layout: body.templateLayout ?? 'standard',
            theme: body.templateTheme ?? 'light',
            nameSeed: merchantNameBase,
          });

          if (previewData?.pages?.length) {
            tplPrev = { ...tplPrev, data: { ...(tplPrev.data || {}), pages: previewData.pages } };
          }

          try {
            // quick normalize for preview render
            const norm = normalizeTemplateServer({
              slug: tplPrev.slug,
              template_name: tplPrev.name,
              color_mode: body.templateTheme ?? 'light',
              data: tplPrev.data,
            } as any);
            tplPrev = { ...tplPrev, data: norm.data };
            send({ type: 'note', message: 'preview template normalized' });
          } catch (err: any) {
            send({ type: 'note', message: `preview normalize error: ${err?.message || String(err)}` });
          }

          stage('template_preview', 'done'); bump('template_preview');

          stage('result', 'start');
          send({
            type: 'result',
            mode: 'preview',
            payload: {
              ok: true,
              mode: 'preview',
              merchant: {
                ok: true,
                preview: {
                  merchant_id: merchantId,
                  brand,
                  logo_url: null,
                  logo_data_url: brand.logo_data_url || null,
                },
              },
              products: { ok: true, count: products.length, items: products },
              template: { ok: true, preview: tplPrev },
              suggestedSiteSlug: tplPrev.slug || slugify(brand?.name || merchantNameBase),
            },
          });
          stage('result', 'done');
          send({ type: 'progress', percent: 100 });
          return end();
        }

        // ===== SAVE =====
        if (body.productsClearExisting) {
          stage('clear_products', 'start');
          await supabaseAdmin.from(T_PRODUCTS).delete().eq('merchant_id', merchantId);
          stage('clear_products', 'done'); bump('clear_products');
        }

        if (body.merchantAvatar && body.previewLogoDataUrl) {
          stage('upload_logo', 'start');
          const path = `seed/${seedTag}/logo_${Date.now()}.png`;
          const logoUrl = await uploadDataUrlPNG(body.previewLogoDataUrl, path);
          const basePatch: any = {
            name: body.previewBrand?.name || merchantNameBase,
            display_name: body.previewBrand?.name || merchantNameBase,
          };
          const withLogo = logoUrl ? { ...basePatch, logo_url: logoUrl } : basePatch;
          let up = await supabaseAdmin.from(T_MERCHANTS).update(withLogo).eq('id', merchantId);
          if (up.error && /logo_url/.test(`${up.error.message} ${up.error.details ?? ''}`)) {
            up = await supabaseAdmin.from(T_MERCHANTS).update(basePatch).eq('id', merchantId);
          }
          stage('upload_logo', 'done'); bump('upload_logo');
        }

        const previewItems = (body.previewItems as any[]) || [];
        if (body.productsGenerateImages && previewItems.length) {
          stage('upload_product_images', 'start');
          for (let i = 0; i < previewItems.length; i++) {
            const item = previewItems[i];
            if (item.image_data_url) {
              const path = `seed/${seedTag}/products/${slugify(item.title || 'item')}_${Math.random()
                .toString(36)
                .slice(2, 7)}.png`;
              const url = await uploadDataUrlPNG(item.image_data_url, path);
              previewItems[i] = { ...item, image_url: url, image_data_url: null };
            }
            send({ type: 'note', message: `upload ${i + 1}/${previewItems.length}` });
          }
          stage('upload_product_images', 'done'); bump('upload_product_images');
        }

        stage('upsert_products', 'start');
        const items = previewItems as any[];
        const titles = items.map((p: any) => p.title || 'Item');
        const slugs = await ensureUniqueBatchSlugs(titles, new Set());
        const rows = items.map((p: any, i: number) => ({
          id: randomUUID(),
          merchant_id: merchantId,
          title: p.title || 'Item',
          price_cents: Math.round(Number(p.price_usd) * 100),
          qty_available: 10,
          image_url: p.image_url ?? null,
          product_type: p.type || 'physical',
          slug: p.slug || slugs[i],
          blurb: p.blurb ?? null,
          status: 'active',
        }));
        await supabaseAdmin.from(T_PRODUCTS).upsert(rows, { onConflict: 'merchant_id,slug' }).select('id');
        stage('upsert_products', 'done'); bump('upsert_products');

        // === SAVE TEMPLATE =========================================================
        stage('save_template', 'start');

        // Optional custom block selection from admin
        const picks: SeedTemplateOptions | undefined = body?.templateBlocks;
        let customBuild;
        if (picks && picks.order) {
          const { key: industryKey, label: industryLabel } = resolveIndustry(body.industry, undefined);
          const serviceNames = generateServices({ industryKey }).map((s) => s.name);
          customBuild = buildTemplateFromOptions({
            ...picks,
            theme: body.templateTheme ?? 'light',
            layout: body.templateLayout ?? 'standard',
            siteName: body?.previewBrand?.name || merchantNameBase,
            industryLabel,
            serviceNames: picks.picks?.services?.enabled ? serviceNames : [],
          });
        }

        let tplPrev = body.previewTemplate ?? buildTemplatePreview({
          brand: body.previewBrand ?? { name: 'Demo' },
          products: items,
          industry: body.industry,
          layout: body.templateLayout ?? 'standard',
          theme: body.templateTheme ?? 'light',
          nameSeed: merchantNameBase,
        });
        if (customBuild?.pages?.length) {
          tplPrev = { ...tplPrev, data: { ...(tplPrev.data || {}), pages: customBuild.pages } };
        }
        if (tplPrev.hero_data_url) {
          const path = `seed/${seedTag}/templates/${(tplPrev.slug || slugify(tplPrev.name))}_hero_${Date.now()}.png`;
          const heroUrl = await uploadDataUrlPNG(tplPrev.hero_data_url, path);
          tplPrev = swapHeroInTemplate(tplPrev, heroUrl);
        }

        // 0) FIRST: upgrade legacy -> content so we never save props-shape
        let upgraded = upgradeLegacyBlocksDeep(tplPrev.data);

        // 1) normalize once to make sure pages/blocks are in modern shape
        let normalizedData = upgraded;
        try {
          const norm = normalizeTemplateServer({
            slug: tplPrev.slug,
            template_name: tplPrev.name,
            layout: body.templateLayout ?? 'standard',
            color_scheme: 'neutral',
            theme: body.templateTheme ?? 'light',
            color_mode: body.templateTheme ?? 'light',
            data: upgraded,
          } as any);
          normalizedData = norm.data || {};
        } catch (err: any) {
          send({ type: 'note', message: `normalize error (pre): ${err?.message || String(err)}` });
        }

        // 2) ensure the hero block always has required fields; optionally hydrate AI copy/image
        const wantAICopy = body?.templateBlocks?.picks?.hero?.config?.aiCopy !== false; // default ON
        const wantAIImage = body?.templateBlocks?.picks?.hero?.config?.aiImage === true; // default OFF
        try {
          normalizedData = await hydrateHeroBlocks({
            data: normalizedData,
            templateId: tplPrev.slug || 'temp',
            siteName: body?.previewBrand?.name || 'Demo',
            autoCopy: wantAICopy,
            autoImage: wantAIImage,
            industry: body?.industry,
            services: Array.isArray(body?.services) ? body.services : undefined,
            businessName: body?.previewBrand?.name,
            city: (body as any)?.city,
            state: (body as any)?.state,
          }) || {};
          send({ type: 'note', message: 'hero hydrated' });
        } catch (err: any) {
          send({ type: 'note', message: `hero hydrate error: ${err?.message || String(err)}` });
        }

        // 3) FINAL SAFETY: upgrade again right before save (guards against any reintroduced props)
        normalizedData = upgradeLegacyBlocksDeep(normalizedData);

        // Resolve industry (label for DB; key for generators)
        const { label: industryLabel, key: industryKey } = resolveIndustry(body.industry, tplPrev.slug);

        // Insert version with industry at INSERT time
        const tplRes = await upsertTemplateAdaptive(
          merchantId,
          { name: tplPrev.name, slug: tplPrev.slug, data: normalizedData, industry: industryLabel },
          { ownerId: adminUserId },
        );
        const templateId = tplRes.id;

        // Generate + persist services (version row)
        const serviceSeeds = generateServices({ industryKey });
        const serviceNames = serviceSeeds.map((s) => s.name);
        await patchTemplateIndustryServices(templateId, {
          industry: industryLabel,
          services: serviceNames,
        });

        stage('save_template', 'done'); bump('save_template');

        // attach template
        stage('attach_template', 'start');
        const att = await supabaseAdmin.from(T_MERCHANTS).update({ template_id: templateId }).eq('id', merchantId);
        if (att.error && !/template_id/.test(`${att.error.message} ${att.error.details ?? ''}`))
          throw att.error;
        stage('attach_template', 'done'); bump('attach_template');

        // publish canonical
        stage('publish_site', 'start');

        const { id: canonicalId, baseSlug } = await getOrCreateCanonicalTemplate({
          templateName: tplPrev.name,
          versionSlug: tplPrev.slug || slugify(tplPrev.name),
          merchantId,
          dataForNew: { ...normalizedData, industry: industryLabel },
          ownerId: adminUserId,
        });

        // mirror industry + services on canonical
        await patchTemplateIndustryServices(canonicalId, {
          industry: industryLabel,
          services: serviceNames,
        });

        let defaultSub = (body.siteSubdomain || baseSlug).toString();
        try {
          defaultSub = await ensureUniqueTemplateSubdomain(defaultSub);
        } catch {}

        const pubPatchBase: any = {
          published: true,
          published_version_id: templateId,
          published_at: new Date().toISOString(),
          published_by: adminUserId ?? null,
        };
        const withSub = { ...pubPatchBase, default_subdomain: defaultSub };

        let pub = await supabaseAdmin.from(T_TEMPLATES).update(withSub).eq('id', canonicalId);
        if (pub.error) {
          const s = `${pub.error.message} ${pub.error.details ?? ''}`.toLowerCase();
          if (/could not find the 'default_subdomain' column/.test(s)) {
            pub = await supabaseAdmin.from(T_TEMPLATES).update(pubPatchBase).eq('id', canonicalId);
            if (pub.error) throw new Error(pub.error.message);
          } else {
            throw new Error(pub.error.message);
          }
        }

        stage('publish_site', 'done'); bump('publish_site');

        stage('result', 'start');
        send({
          type: 'result',
          mode: 'save',
          payload: {
            ok: true,
            mode: 'saved',
            merchant: { ok: true, merchant_id: merchantId },
            products: { ok: true, count: rows.length },
            template: { ok: true, template_id: templateId, name: tplPrev.name, slug: tplPrev.slug },
            site: { ok: true, site_id: canonicalId, slug: defaultSub },
          },
        });
        stage('result', 'done');
        send({ type: 'progress', percent: 100 });
        return end();

      } catch (e: any) {
        console.error('[seed/stream] error:', e);
        try {
          controller.enqueue(
            encoder.encode(JSON.stringify({ type: 'error', message: e?.message || 'Server error' }) + '\n'),
          );
        } catch {}
        return end();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
