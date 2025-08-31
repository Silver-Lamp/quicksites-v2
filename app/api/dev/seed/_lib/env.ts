export function envOrThrow(k: string): string {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env ${k}`);
  return v;
}

export const SUPABASE_URL   = envOrThrow('NEXT_PUBLIC_SUPABASE_URL');
export const SUPABASE_ANON_KEY = envOrThrow('NEXT_PUBLIC_SUPABASE_ANON_KEY');
export const SERVICE_ROLE   = envOrThrow('SUPABASE_SERVICE_ROLE_KEY');
export const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'site-images';
export const OPENAI_API_KEY = envOrThrow('OPENAI_API_KEY');

export const T_MERCHANTS = process.env.SEED_MERCHANTS_TABLE  || 'merchants';
export const T_CHEFS     = process.env.SEED_CHEFS_TABLE      || 'chefs';
export const T_PRODUCTS  = process.env.SEED_PRODUCTS_TABLE   || 'products';
export const T_TEMPLATES = process.env.SEED_TEMPLATES_TABLE  || 'templates';
