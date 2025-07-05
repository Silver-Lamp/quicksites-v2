export type CampaignType = {
    id: string;
    name: string;
    city: string;
    state?: string | null;
    industry?: string | null;
    city_lat?: number | null;
    city_lon?: number | null;
    starts_at: string; // ISO timestamp
    ends_at: string;   // ISO timestamp
    lead_ids?: string[]; // optional, used when submitting
    created_at?: string;
    updated_at?: string;
    status: 'draft' | 'published' | 'paused' | 'archived';
  };
  