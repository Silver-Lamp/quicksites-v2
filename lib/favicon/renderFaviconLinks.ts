export function renderFaviconLinks(urls: Partial<Record<string, string>>): string {
  const lines: string[] = [];

  for (const size in urls) {
    lines.push(
      `<link rel="icon" type="image/png" sizes="${size}x${size}" href="${urls[size]}">`
    );
  }

  return lines.join('\n');
}
