import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Log a custom event into the site_events table
 */
export async function logSiteEvent(type: string, payload: Record<string, any>) {
  const { error } = await supabase.from('site_events').insert([{ type, payload }]);
  if (error) {
    console.warn(`⚠️ Failed to log site event "${type}":`, error.message);
  }
}

/**
 * Fetch recent events by user_id (from payload)
 */
export async function getEventsByUser(user_id: string, limit = 20) {
  const { data, error } = await supabase
    .from('site_events')
    .select('*')
    .eq('payload->>user_id', user_id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch events by user:', error.message);
    return [];
  }

  return data;
}

/**
 * Fetch recent events by slug (from payload)
 */
export async function getEventsBySlug(slug: string, limit = 20) {
  const { data, error } = await supabase
    .from('site_events')
    .select('*')
    .eq('payload->>slug', slug)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch events by slug:', error.message);
    return [];
  }

  return data;
}

/**
 * Fetch recent events by site_id (from payload)
 */
export async function getEventsBySiteId(site_id: string, limit = 20) {
  const { data, error } = await supabase
    .from('site_events')
    .select('*')
    .eq('payload->>site_id', site_id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch events by site_id:', error.message);
    return [];
  }

  return data;
}
