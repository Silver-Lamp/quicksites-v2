// lib/blocks/normalizeHeaderContent.ts
export type HeaderLink = { label: string; href: string; appearance?: string };

export function normalizeHeaderContent(input: any): {
  logo_url: string;
  nav_items: HeaderLink[];
} {
  const c = input ?? {};
  const nav =
    Array.isArray(c.nav_items) ? c.nav_items :
    Array.isArray(c.navItems)  ? c.navItems  : [];

  return {
    logo_url: c.logo_url ?? c.logoUrl ?? '',
    nav_items: nav.map((l: any) => ({
      label: l?.label ?? '',
      href: l?.href ?? '',
      appearance: l?.appearance ?? 'default',
    })),
  };
}
