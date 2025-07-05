// lib/leads/distance.ts
import { Lead } from '@/types/lead.types';

export function getDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3958.8; // Earth radius in miles
    const toRad = (deg: number) => deg * (Math.PI / 180);
  
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
  
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  
  export function sortLeadsByDistance(
    leads: Lead[],
    targetLat: number,
    targetLon: number
  ): Lead[] {
    return leads
      .filter((l) => l.address_lat !== null && l.address_lon !== null)
      .sort((a, b) => {
        const distA = getDistanceMiles(targetLat, targetLon, a.address_lat!, a.address_lon!);
        const distB = getDistanceMiles(targetLat, targetLon, b.address_lat!, b.address_lon!);
        return distA - distB;
      });
  }
  