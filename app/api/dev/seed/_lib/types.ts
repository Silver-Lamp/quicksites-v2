import type { SeedContext } from '@/types/blocks';

/** What we’re seeding */
export type SeedMode = 'merchant_products' | 'chef_meals' | 'both';

/* ====================== Structured inputs for Blocks API ====================== */

export type MerchantInput = {
  name?: string;
  tagline?: string | null;
  about?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  logo_url?: string | null;
  hero_url?: string | null;
  images?: {
    hero?: string | null;
    banner?: string | null;
    team?: string | null;
  } | null;
  social?: Record<string, string> | null;
};

export type ServiceInput = {
  name: string;
  description?: string | null;
  price?: number | string | null;
  icon?: string | null;
  href?: string | null;
};

export type ProductInput = {
  name: string;
  description?: string | null;
  price?: number | string | null;
  image?: string | null;
  href?: string | null;
};

export type AssetsInput = {
  hero?: string | null;
  palette?: { accent?: string | null } | null;
};

export type LocaleInput = {
  city?: string | null;
  region?: string | null;
  state?: string | null;
  country?: string | null;
  currency?: string | null;
};

/* ========================== Request body (DTO) ========================== */

export type Body = {
  seed?: string;
  dryRun?: boolean;
  seedMode?: SeedMode;
  aiPrompt?: string;
  industry?: string;

  // ---- New structured fields (preferred) ----
  merchant?: MerchantInput | null;
  services?: ServiceInput[] | null;
  products?: ProductInput[] | null;
  assets?: AssetsInput | null;
  locale?: LocaleInput | null;

  // legacy (still supported)
  profileOverwrite?: boolean;
  avatar?: boolean;
  avatarStyle?: 'photo' | 'illustration';
  avatarSize?: '256x256' | '512x512' | '1024x1024';
  mealsCount?: number;
  mealsGenerateImages?: boolean;
  mealsImageStyle?: 'photo' | 'illustration';
  mealsImageSize?: '256x256' | '512x512' | '1024x1024';
  mealsClearExisting?: boolean;

  // merchant + products (legacy flags)
  merchantOverwrite?: boolean;
  merchantAvatar?: boolean;
  merchantAvatarStyle?: 'photo' | 'illustration';
  merchantAvatarSize?: '256x256' | '512x512' | '1024x1024';

  productsCount?: number;
  productsProductType?: 'meal' | 'physical' | 'digital' | 'service' | 'mixed';
  productsGenerateImages?: boolean;
  productsImageStyle?: 'photo' | 'illustration';
  productsImageSize?: '256x256' | '512x512' | '1024x1024';
  productsClearExisting?: boolean;

  // template
  templateGenerate?: boolean;
  templateLayout?: 'standard' | 'onepage';
  templateTheme?: 'light' | 'dark';
  templateAttachToMerchant?: boolean;
  templatePublishSite?: boolean;
  siteSubdomain?: string;

  // carry-over preview (fallback source if structured fields are absent)
  previewBrand?: any | null;
  previewLogoDataUrl?: string | null;
  previewItems?: Array<{
    title?: string;
    type?: string;
    price_usd?: number;
    blurb?: string | null;
    slug?: string | null;
    image_url?: string | null;
    image_data_url?: string | null;
  }>;
  previewTemplate?: {
    name: string;
    slug: string;
    data: any;
    industry?: string | null;
    hero_data_url?: string | null;
  };

  targetEmail?: string;
};

/* ======================= Helpers: Body → SeedContext ======================= */

/** Safe UUID for edge/runtime without assuming crypto is present */
function genId(): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g: any = globalThis as any;
  return g.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

/** Convert a possibly-null value to undefined for cleaner SeedContext objects */
function undef<T>(v: T | null | undefined): T | undefined {
  return v == null ? undefined : v;
}

/** Normalize preview items into Products if no structured products were supplied */
function productsFromPreview(items: Body['previewItems']): ProductInput[] | undefined {
  if (!items?.length) return undefined;
  return items.map((i) => ({
    name: i.title ?? '',
    description: undef(i.blurb),
    price: typeof i.price_usd === 'number' ? i.price_usd : undef(i.price_usd as unknown as number | null),
    image: undef(i.image_url ?? i.image_data_url),
    href: undef(i.slug ? `/${i.slug}` : undefined),
  }));
}

/** Build a SeedContext that the Blocks API factories use */
export function toSeedContext(body: Body): SeedContext {
  // Prefer structured merchant; fall back to previewBrand
  const m: MerchantInput | undefined =
    (body.merchant ?? undefined) ??
    (body.previewBrand
      ? {
          name: body.previewBrand?.name,
          tagline: undef(body.previewBrand?.tagline),
          about: undef(body.previewBrand?.about),
          logo_url: undef(body.previewBrand?.logo_url),
          city: undef(body.previewBrand?.city),
          state: undef(body.previewBrand?.state),
          images: {
            hero: undef(
              body.previewBrand?.hero_data_url ??
                body.previewTemplate?.hero_data_url ??
                body.previewTemplate?.data?.meta?.hero ??
                body.previewTemplate?.data?.meta?.heroImage
            ),
          },
        }
      : undefined);

  const products: ProductInput[] | undefined =
    (body.products ?? undefined) ?? productsFromPreview(body.previewItems);

  const services: ServiceInput[] | undefined = body.services ?? undefined;

  // Accent/hero from preview/meta if provided
  const heroFromMeta: string | undefined =
    undef(
      body.previewTemplate?.hero_data_url ??
        body.previewTemplate?.data?.meta?.hero ??
        body.previewTemplate?.data?.meta?.heroImage
    );

  const accentFromMeta: string | undefined = undef(body.previewTemplate?.data?.meta?.accent);

  const ctx: SeedContext = {
    id: genId,
    random: Math.random,
    industry: body.previewTemplate?.industry ?? undefined,

    merchant: m
      ? {
          name: m.name ?? 'Demo',
          tagline: undef(m.tagline),
          about: undef(m.about),
          logo_url: undef(m.logo_url),
          phone: undef(m.phone),
          email: undef(m.email),
          address: undef(m.address),
          city: undef(m.city),
          state: undef(m.state),
          images: {
            hero: undef(m.images?.hero ?? m.hero_url ?? heroFromMeta),
            banner: undef(m.images?.banner),
            team: undef(m.images?.team),
          },
          social: m.social ?? undefined,
        }
      : undefined,

    services: services
      ?.map((s) => ({
        name: s.name,
        description: undef(s.description),
        price: s.price ?? undefined,
        icon: undef(s.icon),
        href: undef(s.href),
      })),

    products: products
      ?.map((p) => ({
        name: p.name,
        description: undef(p.description),
        price: p.price ?? undefined,
        image: undef(p.image),
        href: undef(p.href),
      })),

    assets: {
      hero: undef(heroFromMeta),
      palette: { accent: undef(accentFromMeta) },
    },

    locale: {
      city: undef(body.locale?.city ?? m?.city),
      region: undef(body.locale?.region),
      state: undef(body.locale?.state ?? m?.state),
      country: undef(body.locale?.country),
      currency: undef(body.locale?.currency),
    },
  };

  return ctx;
}
