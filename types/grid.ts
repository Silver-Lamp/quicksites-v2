export type CityPoint = {
    city: string;
    state: string;
    lat: number;
    lon: number;
    leadsQty: number;
    domains: number;
    leads: { id: string; name: string, isClaimed: boolean, campaignId: string }[];
    domainNames: string[];
    leadIds: string[];
    industry?: string;
    industryCounts?: Record<string, number>;
    unclaimedLeadCount?: number;
    campaigns?: string[];
  };
  