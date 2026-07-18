'use client';

// Per-site "Say Dog" mascot — reads a published site's meta.mascot config and mounts the
// configurable dog. The toggle-able wow-factor a site owner enables in the editor
// (components/admin/templates/panels/mascot-panel.tsx). Never shows in the editor.

import * as React from 'react';
import SayDog from '@/components/brand/say-dog';
import { mascotFromMeta, resolveMascotMessages } from '@/lib/mascot/config';

export default function SiteMascot({ template }: { template: any }) {
  const meta = (template?.data as any)?.meta ?? (template as any)?.meta ?? {};
  const cfg = mascotFromMeta(meta);
  const services: string[] = Array.isArray(meta?.services) ? meta.services : [];
  const businessName = String(meta?.business || meta?.siteTitle || '').trim();
  const messages = React.useMemo(
    () => (cfg ? resolveMascotMessages(cfg, { services, businessName }) : []),
    [cfg, services, businessName]
  );
  if (!cfg) return null;
  const siteId = String(template?.id || template?.slug || '');
  return <SayDog config={cfg} messages={messages} siteId={siteId} />;
}
