// types/grid.ts
// this is for the grid map view
// not for the grid block editor
export type CityPoint = {
    city: string;
    state: string;
    lat: number;
    lon: number;
    leadsQty: number;
    domains: number;
    leads: { id: string; name: string, isClaimed: boolean, campaignId: string, industry: string }[];
    domainNames: string[];
    leadIds: string[];
    industry?: string;
    industryCounts?: Record<string, number>;
    unclaimedLeadCount?: number;
    campaigns?: string[];
    has2PlusUnclaimedInSameIndustry?: boolean;
  };
  