export type CityPoint = {
    city: string;
    state: string;
    lat: number;
    lon: number;
    leads: number;
    domains: number;
    leadNames: string[];
    domainNames: string[];
    leadIds: string[];
    industry?: string;
    industryCounts?: Record<string, number>;
  };
  