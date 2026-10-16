'use client';

import { useEffect } from 'react';

/**
 * Sets `<html lang>` to the SITE's language. The root layout says lang="en" for every page, so an
 * Italian trattoria was read in an English voice by screen readers and Chrome offered to translate
 * it (HiveJournal's re-run, 2026-10-16). The renderer root carries `lang` too, but assistive tech
 * and the translate prompt read the document element. Used by /sites/[slug]; the custom-domain
 * route does the same through SiteThemeSetter's `lang` prop plus its before-paint inline script.
 */
export default function SiteLangSetter({ lang }: { lang: string }) {
  useEffect(() => {
    if (lang) document.documentElement.lang = lang;
  }, [lang]);
  return null;
}
