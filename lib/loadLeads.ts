import { supabase } from '@/admin/lib/supabaseClient';

export type LeadSummary = {
  id: string;
  business_name: string | null;
  address_city: string | null;
  address_state?: string | null;
  created_at?: string | null;
  industry?: string | null;
  current_campaign_id?: string | null;
  current_campaign_expires_at?: string | null;
};

type LoadLeadsOptions = {
  city?: string;
  state?: string;
  industry?: string;
  sortBy?: 'created_at' | 'business_name';
  sortOrder?: 'asc' | 'desc';
};

const _leadCache = new Map<string, LeadSummary[]>();

function makeCacheKey(opts: LoadLeadsOptions) {
  return JSON.stringify(opts);
}

export async function loadLeads(options: LoadLeadsOptions = {}): Promise<LeadSummary[]> {
  const cacheKey = makeCacheKey(options);
  if (_leadCache.has(cacheKey)) return _leadCache.get(cacheKey)!;

  const { data, error } = await supabase
    .from('leads')
    .select(`
      id,
      business_name,
      address_city,
      address_state,
      created_at,
      industry,
      current_campaign_id,
      current_campaign_expires_at
    `);

  if (error) {
    console.error('Error loading leads:', error.message);
    return [];
  }

  let leads = data || [];

  if (options.city) {
    leads = leads.filter((l) => l.address_city?.toLowerCase() === options.city!.toLowerCase());
  }

  if (options.state) {
    leads = leads.filter((l) => l.address_state?.toLowerCase() === options.state!.toLowerCase());
  }

  if (options.industry) {
    leads = leads.filter((l) => l.industry?.toLowerCase() === options.industry!.toLowerCase());
  }

  if (options.sortBy) {
    leads.sort((a, b) => {
      const aVal = a[options.sortBy!] ?? '';
      const bVal = b[options.sortBy!] ?? '';
      return options.sortOrder === 'desc'
        ? String(bVal).localeCompare(String(aVal))
        : String(aVal).localeCompare(String(bVal));
    });
  }

  _leadCache.set(cacheKey, leads);
  return leads;
}

export async function getTopTwoLeads(
  options: LoadLeadsOptions
): Promise<[LeadSummary, LeadSummary] | null> {
  const leads = await loadLeads(options);
  if (leads.length >= 2) {
    return [leads[0], leads[1]];
  }
  return null;
}
