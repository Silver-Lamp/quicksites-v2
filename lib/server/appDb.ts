// lib/server/db.ts
import { supabaseAdmin } from '@/lib/server/supabaseAdmin';
export const appDb = () => supabaseAdmin.schema('app');     // if default is public
export const pubDb = () => supabaseAdmin.schema('public');

// usage
// const { data } = await appDb().from('services').select('*');   // app schema
// const { data } = await pubDb().from('templates').select('*');  // public schema
