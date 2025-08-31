// components/admin/dev/seeder/types.ts
export type SeedMode = 'merchant_products' | 'chef_meals' | 'both';

export type TemplateLayout = 'standard' | 'onepage';
export type TemplateTheme  = 'light'   | 'dark';

export type SeedProductPreview = {
  title?: string;
  type?: string;
  price_usd?: number;
  image_url?: string | null;
  image_data_url?: string | null;
  blurb?: string | null;
  slug?: string | null;
};

export type SeedResult = {
  ok?: boolean;
  mode?: 'preview' | 'saved';
  error?: string;
  merchant?: {
    ok?: boolean;
    merchant_id?: string;
    name?: string | null;
    logo_url?: string | null;
    preview?: {
      merchant_id?: string;
      brand?: any;
      logo_url?: string | null;
      logo_data_url?: string | null;
    };
  };
  products?: {
    ok?: boolean;
    count?: number;
    items?: SeedProductPreview[];
  };
  template?: {
    ok?: boolean;
    template_id?: string;
    preview?: {
      name: string;
      slug: string;
      data: any;
      hero_data_url?: string|null;
    };
  };
  site?: {
    ok?: boolean;
    site_id?: string;
    slug?: string;
  };
  profile?: any;
  meals?: any;
};

export type SeedParams = {
  // global
  seed?: string;
  seedMode: SeedMode;
  industry: string;
  aiPrompt: string;

  // legacy
  profileOverwrite: boolean;
  avatar: boolean;
  avatarStyle: 'photo' | 'illustration';
  avatarSize: '256x256' | '512x512' | '1024x1024';
  mealsCount: number;
  mealsGenerateImages: boolean;
  mealsImageStyle: 'photo' | 'illustration';
  mealsImageSize: '256x256' | '512x512' | '1024x1024';
  mealsClearExisting: boolean;

  // merchants/products
  merchantOverwrite: boolean;
  merchantAvatar: boolean;
  merchantAvatarStyle: 'photo' | 'illustration';
  merchantAvatarSize: '256x256' | '512x512' | '1024x1024';

  productsCount: number;
  productsProductType: 'meal'|'physical'|'digital'|'service'|'mixed';
  productsGenerateImages: boolean;
  productsImageStyle: 'photo'|'illustration';
  productsImageSize: '256x256'|'512x512'|'1024x1024';
  productsClearExisting: boolean;

  // templates
  templateGenerate: boolean;
  templateLayout: TemplateLayout;
  templateTheme: TemplateTheme;
  templateAttachToMerchant: boolean;
  templatePublishSite: boolean;
  siteSubdomain?: string;
};
