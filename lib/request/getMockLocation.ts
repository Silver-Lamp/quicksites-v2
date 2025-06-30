'use server';

import { getSafeCookie } from '../safeCookies';
import type { MockGeoLocation } from '../../types/location';

export async function getMockLocation(): Promise<MockGeoLocation | null> {
  const raw = (await getSafeCookie('mock-geo')) as string | undefined;

  if (!raw || typeof raw !== 'string') return null;

  const [latStr, lngStr] = raw.split(',').map((x) => x.trim());
  const latitude = parseFloat(latStr);
  const longitude = parseFloat(lngStr);

  if (isNaN(latitude) || isNaN(longitude)) return null;

  return { latitude, longitude };
}
