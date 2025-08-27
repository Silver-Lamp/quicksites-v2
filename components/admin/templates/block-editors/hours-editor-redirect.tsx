'use client';

import { useEffect } from 'react';

type Props = { onClose?: () => void };

export default function HoursEditorRedirect({ onClose }: Props) {
  useEffect(() => {
    // Ask the sidebar to open the Hours panel, scroll to it, and spotlight it.
    window.dispatchEvent(
      new CustomEvent('qs:open-settings-panel', {
        detail: { panel: 'hours', openEditor: true, scroll: true, spotlightMs: 900 },
      } as any)
    );
    // Close the modal on next tick
    const id = setTimeout(() => onClose?.(), 0);
    return () => clearTimeout(id);
  }, [onClose]);

  return null; // nothing to render
}
