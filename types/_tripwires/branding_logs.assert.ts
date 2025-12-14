import type { Database } from '@/types/supabase';

type BrandingInsert = Database['public']['Tables']['branding_logs']['Insert'];

const _shape: BrandingInsert = {
  profile_id: '',
  user_id: null,
  event: '',
  details: ''
};

export {};
