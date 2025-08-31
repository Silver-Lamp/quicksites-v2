// components/admin/dev/seeder/sections/TemplatesSection.tsx
'use client';

import * as React from 'react';
import { Label } from '@/components/ui/label';

function normalizeSubdomain(v: string): string {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')   // only a-z 0-9 -
    .replace(/-+/g, '-')           // collapse --
    .replace(/^-+|-+$/g, '');      // trim leading/trailing -
}

export function TemplatesSection({
  templateGenerate, setTemplateGenerate,
  templateLayout, setTemplateLayout,
  templateTheme, setTemplateTheme,
  templateAttachToMerchant, setTemplateAttachToMerchant,
  templatePublishSite, setTemplatePublishSite,
  siteSubdomain, setSiteSubdomain,
}: {
  templateGenerate: boolean; setTemplateGenerate:(v:boolean)=>void;
  templateLayout: 'standard'|'onepage'; setTemplateLayout:(v:any)=>void;
  templateTheme: 'light'|'dark'; setTemplateTheme:(v:any)=>void;
  templateAttachToMerchant: boolean; setTemplateAttachToMerchant:(v:boolean)=>void;
  templatePublishSite: boolean; setTemplatePublishSite:(v:boolean)=>void;
  siteSubdomain: string; setSiteSubdomain:(v:string)=>void;
}) {
  const disabled = !templateGenerate;

  const onTogglePublish = (checked: boolean) => {
    setTemplatePublishSite(checked);
    if (checked && !siteSubdomain) {
      setSiteSubdomain('demo');
    }
  };

  const onSubdomainChange = (raw: string) => {
    setSiteSubdomain(normalizeSubdomain(raw));
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="genTpl">Generate Template</Label>
          <label className="inline-flex items-center gap-2 text-sm" id="genTpl">
            <input
              type="checkbox"
              checked={templateGenerate}
              onChange={(e)=>setTemplateGenerate(e.target.checked)}
            />
            Create a demo template (uses new Blocks API)
          </label>
        </div>

        <div>
          <Label htmlFor="tplLayout">Layout</Label>
          <select
            id="tplLayout"
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-white dark:bg-neutral-900"
            value={templateLayout}
            onChange={(e)=>setTemplateLayout(e.target.value)}
            disabled={disabled}
          >
            <option value="standard">standard</option>
            <option value="onepage">onepage</option>
          </select>
        </div>

        <div>
          <Label htmlFor="tplTheme">Theme</Label>
          <select
            id="tplTheme"
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-white dark:bg-neutral-900"
            value={templateTheme}
            onChange={(e)=>setTemplateTheme(e.target.value)}
            disabled={disabled}
          >
            <option value="light">light</option>
            <option value="dark">dark</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="attachTpl">Attach to merchant</label>
          <label className="inline-flex items-center gap-2 text-sm" id="attachTpl">
            <input
              type="checkbox"
              checked={templateAttachToMerchant}
              onChange={(e)=>setTemplateAttachToMerchant(e.target.checked)}
              disabled={disabled}
            />
            Set as merchant’s template
          </label>
          <p className="text-[11px] text-muted-foreground">
            Links the saved template to the merchant record (ignored if column missing).
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="publishTpl">Publish template</label>
          <label className="inline-flex items-center gap-2 text-sm" id="publishTpl">
            <input
              type="checkbox"
              checked={templatePublishSite}
              onChange={(e)=>onTogglePublish(e.target.checked)}
              disabled={disabled}
            />
            Publish canonical (sets default subdomain)
          </label>
          <p className="text-[11px] text-muted-foreground">
            Publishes the canonical template and points it to the generated version.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="tplSubdomain">Default subdomain</label>
          <input
            id="tplSubdomain"
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-white dark:bg-neutral-900"
            value={siteSubdomain}
            onChange={(e)=>onSubdomainChange(e.target.value)}
            placeholder="e.g. curated-chic"
            disabled={disabled || !templatePublishSite}
            aria-describedby="tplSubdomainHelp"
            inputMode="url"
          />
          <p id="tplSubdomainHelp" className="text-[11px] text-muted-foreground">
            Lowercase letters, numbers, and hyphens only. We’ll ensure it’s unique automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
