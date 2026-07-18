'use client';

// Per-site screensaver — reads a published site's meta.screensaver config and mounts the ambient
// screensaver on the live site. The "wow-factor" service a site owner enables in the editor
// (components/admin/templates/panels/screensaver-panel.tsx). Never shows in the editor.

import * as React from 'react';
import Screensaver from '@/components/brand/screensaver';
import { screensaverFromMeta, resolveScreensaver } from '@/lib/screensaver/config';

export default function SiteScreensaver({ template }: { template: any }) {
  const meta = (template?.data as any)?.meta ?? (template as any)?.meta ?? {};
  const cfg = screensaverFromMeta(meta);
  // Resolve on the client so the fireplace day/night pick matches the visitor's local time.
  const resolved = React.useMemo(() => resolveScreensaver(cfg), [JSON.stringify(cfg)]);
  if (!resolved.enabled) return null;
  const slug = String(template?.slug || template?.id || 'site');
  return <Screensaver config={resolved} optOutKey={`qs_screensaver_off:${slug}`} />;
}
