// components/admin/templates/panels/usePanelDeepLink.ts
//
// Shared behavior for a settings panel that can be deep-linked (e.g. a block editor's
// "Template Identity" / "Available Services" link → openSettingsSidebarPanel). When the
// matching `qs:open-settings-panel` event fires, the panel OPENS and briefly spotlights,
// so the user lands on the editable fields instead of a collapsed row.
//
// Pair with the shared CollapsiblePanel's controlled `open` + `className` (spotlightClass).

import { useEffect, useState } from 'react';

export function usePanelDeepLink(panelKey: string) {
  const [open, setOpen] = useState(false);
  const [spotlight, setSpotlight] = useState(false);

  useEffect(() => {
    const onOpenPanel = (e: Event) => {
      const d = (e as CustomEvent)?.detail;
      if (d?.panel !== panelKey) return;
      setOpen(true);
      setSpotlight(true);
      window.setTimeout(() => setSpotlight(false), d?.spotlightMs ?? 900);
    };
    window.addEventListener('qs:open-settings-panel', onOpenPanel as any);
    return () => window.removeEventListener('qs:open-settings-panel', onOpenPanel as any);
  }, [panelKey]);

  return {
    open,
    setOpen,
    spotlight,
    /** Drop onto CollapsiblePanel's className to flash a ring when deep-linked. */
    spotlightClass: spotlight ? 'ring-2 ring-violet-500/70' : undefined,
  };
}
