import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

import { supabaseAdmin } from './_lib/clients';
import { assertAdmin } from './_lib/auth';
import { buildIndustryPrompt } from './_lib/industries';
import { ideateBrandAndProducts, generateDataUrlPNG } from './_lib/openaiIdeation';
import { uploadDataUrlPNG } from './_lib/storage';
import { slugify, ensureUniqueBatchSlugs } from './_lib/slugs';
import { ensureChefForUser, ensureMerchantForUser } from './_lib/dbEnsure';
import { buildTemplatePreview, swapHeroInTemplate } from './_lib/templates';
import { ensureUniqueSubdomain, upsertSite } from './_lib/_deprecated_sites';
import type { Body, SeedMode } from './_lib/types';

async function findOrCreateUser(seedTag: string, isPreview: boolean, targetEmail?: string) {
  const email = (targetEmail || `seed+${seedTag}@demo.local`).toLowerCase();
  if (isPreview) return { id: randomUUID(), email } as any;
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw new Error(error.message);
  const u = (data.users || []).find(x => x.email?.toLowerCase() === email);
  if (u) return u;
  const created = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { name: 'Seed Merchant' },
  });
  if (created.error) throw new Error(created.error.message);
  return created.data.user!;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const gate = await assertAdmin();
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const body = (await req.json()) as Body;
    const seedMode: SeedMode = body.seedMode ?? 'merchant_products';
    const isPreview = !!body.dryRun;
    const seedTag = slugify(body.seed || '') || Math.random().toString(36).slice(2, 10);

    // Target user
    const authUser = await findOrCreateUser(seedTag, isPreview, body.targetEmail);
    const userId = authUser.id as string;

    // Ensure merchant/chef
    const merchantNameBase = 'Seed ' + ((body.aiPrompt || '').split(/\W+/)?.[0] || 'Merchant');
    const merchantId = isPreview ? randomUUID() : await ensureMerchantForUser(supabaseAdmin, userId, merchantNameBase);
    const chefId =
      !isPreview && seedMode !== 'merchant_products'
        ? await ensureChefForUser(
            supabaseAdmin,
            userId,
            merchantId,
            merchantNameBase.replace(/^Seed\s+/, 'Chef ')
          )
        : null;

    // PREVIEW re-use vs IDEATE vs STRUCTURED INPUTS
    const effectivePrompt = buildIndustryPrompt(body.industry, body.aiPrompt, body.productsProductType ?? 'meal');
    const count = Math.max(1, Math.min(48, Number(body.productsCount ?? body.mealsCount ?? 8)));
    const productType = body.productsProductType ?? 'meal';

    let brand: any;
    let products: any[];

    const hasStructured =
      !!body.merchant || (Array.isArray(body.products) && body.products.length > 0);

    if (hasStructured) {
      // Map structured fields to the preview/legacy shape used downstream
      const m = body.merchant ?? {};
      brand = {
        name: m?.name ?? merchantNameBase,
        tagline: m?.tagline ?? null,
        about: m?.about ?? null,
        logo_url: m?.logo_url ?? null,
        city: m?.city ?? null,
        state: m?.state ?? null,
        hero_data_url: m?.images?.hero ?? null,
      };
      products = (body.products ?? []).map((p) => ({
        title: p.name,
        type: 'physical',
        price_usd:
          typeof p.price === 'number'
            ? p.price
            : typeof p.price === 'string'
            ? Number(p.price)
            : undefined,
        blurb: p.description ?? null,
        slug: p.href ? String(p.href).replace(/^\//, '') : null,
        image_url: p.image ?? null,
        image_data_url: null,
      }));
    } else if (!isPreview && Array.isArray(body.previewItems) && body.previewItems.length) {
      // SAVE: reuse the preview payload
      brand = body.previewBrand ?? null;
      products = body.previewItems.map((p) => ({ ...p }));
    } else {
      // PREVIEW: ask the model to ideate
      const ideated = await ideateBrandAndProducts({
        aiPrompt: effectivePrompt,
        count,
        productType,
        seed: seedTag,
        industry: body.industry,
      });
      brand = ideated.brand;
      products = ideated.products;
    }

    // IMAGES
    let logoUrl: string | null = null;
    let logoDataUrl: string | null = null;

    if (body.merchantAvatar) {
      if (!isPreview && body.previewLogoDataUrl) {
        const path = `seed/${seedTag}/logo_${Date.now()}.png`;
        logoUrl = await uploadDataUrlPNG(body.previewLogoDataUrl, path);
      } else if (isPreview) {
        const styleAdj =
          body.merchantAvatarStyle === 'illustration'
            ? 'flat vector logo, clean, simple, high contrast'
            : 'professional brand photo logo, minimal';
        const logoPrompt = `Logo for ${brand?.name || merchantNameBase}, ${styleAdj}. Minimal, legible.`;
        logoDataUrl = await generateDataUrlPNG(
          logoPrompt,
          body.merchantAvatarSize || '1024x1024'
        );
      }
    }

    if (body.productsGenerateImages) {
      for (const p of products) {
        if (!isPreview && p.image_data_url) {
          const path = `seed/${seedTag}/products/${slugify(p.title || 'item')}_${Math.random()
            .toString(36)
            .slice(2, 7)}.png`;
          p.image_url = await uploadDataUrlPNG(p.image_data_url, path);
          delete p.image_data_url;
        } else if (isPreview) {
          const base = p.image_prompt || `${p.type || 'product'} display, studio lighting`;
          const style =
            body.productsImageStyle === 'illustration' ? 'vector illustration' : 'photo';
          const prompt = `${base}; ${style}; ${brand?.name ? `brand: ${brand.name}` : ''}${
            body.industry ? `; industry: ${body.industry}` : ''
          }`;
          p.image_data_url = await generateDataUrlPNG(
            prompt,
            body.productsImageSize || '1024x1024'
          );
          p.image_url = null;
        }
      }
    } else {
      for (const p of products) {
        p.image_url = null;
        if (isPreview) delete p.image_data_url;
      }
    }

    // TEMPLATE (preview vs save)
    const templateGenerate = body.templateGenerate ?? true;
    const templateLayout = body.templateLayout ?? 'standard';
    const templateTheme = body.templateTheme ?? 'light';
    const templateAttachToMerchant = body.templateAttachToMerchant ?? true;
    const templatePublishSite = body.templatePublishSite ?? true;
    const siteSubdomainReq = (body.siteSubdomain || '').toString();

    let templatePreview = body.previewTemplate ?? null;

    if (!templatePreview && templateGenerate) {
      // Prefer provided hero; else generate one for preview
      if (!brand.hero_data_url) {
        const heroDataUrl = await generateDataUrlPNG(
          `${brand?.name || merchantNameBase} hero, lifestyle product flatlay, soft studio light`,
          '1024x1024'
        );
        brand.hero_data_url = heroDataUrl || null;
      }

      // NOTE: buildTemplatePreview now uses the Blocks API internally (aliases + validation)
      templatePreview = buildTemplatePreview({
        brand,
        products,
        industry: body.industry,
        layout: templateLayout,
        theme: templateTheme,
        nameSeed: merchantNameBase,
      });
    }

    // RESPONSE SKELETON
    const result: any = { ok: true, mode: isPreview ? 'preview' : 'saved' };

    // MERCHANT RESP
    if (seedMode !== 'chef_meals') {
      if (isPreview) {
        result.merchant = {
          ok: true,
          preview: {
            merchant_id: merchantId,
            brand,
            logo_url: logoUrl,
            logo_data_url: logoDataUrl,
          },
        };
      } else {
        if (body.merchantOverwrite) {
          const basePatch: any = {
            name: brand?.name || merchantNameBase,
            display_name: brand?.name || merchantNameBase,
          };

          // First try including logo_url; if the column doesn't exist, retry without it.
          const withLogo = logoUrl ? { ...basePatch, logo_url: logoUrl } : basePatch;
          let up = await supabaseAdmin.from('merchants').update(withLogo).eq('id', merchantId);

          if (
            up.error &&
            /could not find the 'logo_url' column/i.test(
              `${up.error.message} ${up.error.details ?? ''}`
            )
          ) {
            up = await supabaseAdmin.from('merchants').update(basePatch).eq('id', merchantId);
          }
          if (up.error) {
            return NextResponse.json(
              { error: up.error.message, details: up.error.details, code: up.error.code },
              { status: 500 }
            );
          }
        }

        result.merchant = {
          ok: true,
          merchant_id: merchantId,
          name: brand?.name || merchantNameBase,
          logo_url: logoUrl ?? null,
        };
      }
    }

    // PRODUCTS RESP (include upsert path on save)
    if (seedMode !== 'chef_meals') {
      if (isPreview) {
        result.products = {
          ok: true,
          count: products.length,
          items: products.map((p: any) => ({
            title: p.title,
            type: p.type,
            price_usd: p.price_usd,
            image_url: p.image_url ?? null,
            image_data_url: p.image_data_url ?? null,
            blurb: p.blurb ?? null,
          })),
        };
      } else {
        const titles = products.map((p: any) => p.title || 'Item');
        const slugs = await ensureUniqueBatchSlugs(titles, new Set());
        const rows = products.map((p: any, i: number) => ({
          id: randomUUID(),
          merchant_id: merchantId,
          title: p.title || 'Item',
          price_cents: Math.round(Number(p.price_usd || 0) * 100),
          qty_available: 10,
          image_url: p.image_url ?? null,
          product_type: p.type || 'physical',
          slug: p.slug || slugs[i],
          blurb: p.blurb ?? null,
          status: 'active',
        }));

        const up = await supabaseAdmin
          .from('products')
          .upsert(rows, { onConflict: 'merchant_id,slug' })
          .select('id');
        if (up.error) {
          return NextResponse.json(
            { error: up.error.message, details: up.error.details, code: up.error.code },
            { status: 500 }
          );
        }
        result.products = { ok: true, count: up.data?.length ?? rows.length };
      }
    }

    // TEMPLATE SAVE + SITE PUBLISH
    if (templateGenerate) {
      if (isPreview) {
        result.template = { ok: true, preview: templatePreview };
        if (isPreview && templatePreview) {
          // Prefer the template slug; fall back to brand name
          result.suggestedSiteSlug = templatePreview.slug || slugify(brand?.name || merchantNameBase);
        }
      } else {
        let tpl = templatePreview!;
        let heroUrl: string | null = null;
        if (tpl.hero_data_url) {
          const path = `seed/${seedTag}/templates/${tpl.slug}_hero_${Date.now()}.png`;
          heroUrl = await uploadDataUrlPNG(tpl.hero_data_url, path);
          tpl = swapHeroInTemplate(tpl, heroUrl);
        }

        const tplRow = {
          id: randomUUID(),
          merchant_id: merchantId,
          name: tpl.name,
          slug: tpl.slug,
          data: tpl.data,
          is_site: true,
          industry: body.industry ?? null,
        };

        const upTpl = await supabaseAdmin
          .from('templates')
          .upsert(tplRow, { onConflict: 'slug' })
          .select('id')
          .single();
        if (upTpl.error) {
          return NextResponse.json(
            { error: upTpl.error.message, details: upTpl.error.details, code: upTpl.error.code },
            { status: 500 }
          );
        }

        const templateId = upTpl.data.id;
        if (templateAttachToMerchant) {
          const att = await supabaseAdmin
            .from('merchants')
            .update({ template_id: templateId })
            .eq('id', merchantId);
          // if the column doesn't exist, ignore and continue (some schemas use a join table instead)
          if (
            att.error &&
            !/could not find the 'template_id' column/i.test(
              `${att.error.message} ${att.error.details ?? ''}`
            )
          ) {
            return NextResponse.json(
              { error: att.error.message, details: att.error.details, code: att.error.code },
              { status: 500 }
            );
          }
        }

        result.template = { ok: true, template_id: templateId, name: tpl.name, slug: tpl.slug };

        if (templatePublishSite) {
          const baseSub = siteSubdomainReq || tpl.slug || (brand?.name || 'demo');
          const unique = await ensureUniqueSubdomain(baseSub);
          const site = await upsertSite({
            merchantId,
            templateId,
            slug: unique,
            published: true,
            data: null,
          });
          // attach to merchant if column exists (ignore failure)
          const siteAttach = await supabaseAdmin
            .from('merchants')
            .update({ site_id: site.id })
            .eq('id', merchantId);
          if (
            siteAttach.error &&
            !/could not find the 'site_id' column/i.test(
              `${siteAttach.error.message} ${siteAttach.error.details ?? ''}`
            )
          ) {
            return NextResponse.json(
              { error: siteAttach.error.message, details: siteAttach.error.details, code: siteAttach.error.code },
              { status: 500 }
            );
          }
          result.site = { ok: true, site_id: site.id, slug: site.slug };
        }
      }
    }

    return NextResponse.json(result);
  } catch (e: any) {
    console.error('[seed/all] error:', e);
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
