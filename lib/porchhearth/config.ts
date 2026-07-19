// lib/porchhearth/config.ts
//
// Single config point for the PorchHearth (DeliveredMenu) commerce seam — the mesh block-owner
// behind neighborhood_stay (rentals) + neighborhood_meals. Contracts LIVE:
//   crosstalk/contracts/neighborhood-{stay,meals}-embed.md
//
// Reads are public (no key). Mutating calls (orders/bookings) attach the shared proxy secret
// server-to-server as X-QS-Proxy-Secret and FAIL CLOSED until PORCHHEARTH_PROXY_SECRET is set
// (the operator provisions the same value PorchHearth set on its Railway prod).

export const PORCHHEARTH_BASE_URL = (
  process.env.PORCHHEARTH_BASE_URL || 'https://deliveredmenu-production.up.railway.app'
).replace(/\/+$/, '');

/** The shared proxy secret for mutating endpoints. Empty → booking/order proxying is disabled (503). */
export function porchhearthProxySecret(): string {
  return process.env.PORCHHEARTH_PROXY_SECRET || '';
}

export function porchhearthMutatingEnabled(): boolean {
  return !!porchhearthProxySecret();
}

/** Full URL for an `api/v1/public/...` path. */
export function phUrl(path: string): string {
  const p = path.replace(/^\/+/, '');
  return `${PORCHHEARTH_BASE_URL}/api/v1/public/${p}`;
}
