export type Lead = {
    id: string;
    business_name: string;
    contact_name: string;
    phone: string;
    email: string;
    domain_id: string | null;
    outreach_status: string | null;
    date_created: string; // or Date if you parse it
    created_at: string;   // or Date if you parse it
    campaign_id: string | null;
    owner_id: string | null;
    address_city: string;
    address_state: string;
    notes: string | null;
    industry: string;
  };
  export type CSVLeadRow = {
    Tags?: string;
    BusinessName?: string;
    ContactName?: string;
    Phone?: string;
    Email?: string;
    Notes?: string;
    City?: string;
    State?: string;
    Industry?: string;
  };
  