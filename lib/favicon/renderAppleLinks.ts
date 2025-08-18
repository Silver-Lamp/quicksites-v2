// lib/favicon/renderAppleLinks.ts
export function renderAppleIcons(urls: Partial<Record<string, string>>): string {
  return Object.entries(urls)
    .filter(([size]) => Number(size) >= 64)
    .map(
      ([size, url]) => 
        `<link rel="apple-touch-icon" sizes="${size}x${size}" href="${url}">`
    )
    .join('\n');
}
