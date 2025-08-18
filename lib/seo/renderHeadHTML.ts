// lib/seo/renderHeadHTML.ts
export function renderHeadHTML({
  title,
  description,
  iconPath,
  useIco = false,
  appleTouch = true,
}: {
  title: string;
  description: string;
  iconPath: string; // /public/favicons/abc123
  useIco?: boolean;
  appleTouch?: boolean;
}): string {
  const iconHref = useIco
    ? `${iconPath}/favicon.ico`
    : `${iconPath}/favicon.png`;

  const links = [
    `<link rel="icon" href="${iconHref}">`,
    appleTouch ? `<link rel="apple-touch-icon" sizes="180x180" href="${iconPath}/favicon.png">` : '',
  ];

  return [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}">`,
    ...links,
  ]
    .filter(Boolean)
    .join('\n');
}
