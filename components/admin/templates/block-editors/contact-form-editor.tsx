'use client';

import type { Block } from '@/types/blocks';
import type { BlockEditorProps } from '@/components/admin/templates/block-editors';
import { Mail, Info } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

function isValidEmail(v: string) {
  return !!v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function ContactFormEditor({ block, onSave, onClose, template }: BlockEditorProps) {
  const formBlock = block as unknown as Block;

  // Content-editable: title
  const [title, setTitle] = useState(formBlock.content?.title || 'Contact Us');

  // DB-backed (read-only in editor)
  const dbEmail = ((template as any)?.contact_email || '').trim();

  // ✅ Source of truth for all options is the DB column
  const allAvailableServices: string[] = Array.isArray(template?.services)
    ? (template.services as string[])
    : [];

  // Optional subset stored in block content; default to ALL services
  const initialSubsetFromBlock: string[] = Array.isArray((formBlock.content as any)?.services)
    ? ((formBlock.content as any).services as string[])
    : [];

  const initialServices =
    initialSubsetFromBlock.length > 0
      ? initialSubsetFromBlock.filter((s) => allAvailableServices.includes(s))
      : allAvailableServices.slice();

  const [services, setServices] = useState<string[]>(initialServices);

  // If services list changes while editor is open, keep selections valid.
  // If nothing selected, auto-select all.
  useEffect(() => {
    const intersection = services.filter((s) => allAvailableServices.includes(s));
    if (intersection.length !== services.length) setServices(intersection);
    if (intersection.length === 0 && allAvailableServices.length > 0) {
      setServices(allAvailableServices.slice());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(allAvailableServices)]);

  const toggleService = (service: string) => {
    setServices((prev) => (prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service]));
  };

  // Only save subset values that exist in DB services
  const sanitizedSubset = services.filter((s) => allAvailableServices.includes(s));

  const emailOk = useMemo(() => isValidEmail(dbEmail), [dbEmail]);

  return (
    <div
      className="p-5 space-y-5 rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-100 shadow-sm"
      onKeyDownCapture={(e) => e.stopPropagation()} // prevent global hotkeys while editing
    >
      <h3 className="text-lg font-semibold tracking-tight">Edit Contact Form</h3>

      {/* Form Title */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-neutral-200">Form Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100
                     focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          placeholder="Contact Us"
        />
      </div>

      {/* Notification Email (read-only from DB) */}
      <div className="space-y-1.5">
        <label htmlFor="notify-email" className="block text-sm font-medium text-neutral-200">
          Send submissions to
        </label>

        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
            <Mail className="h-4 w-4 text-neutral-400" />
          </span>
          <input
            id="notify-email"
            type="email"
            value={dbEmail}
            readOnly
            aria-readonly="true"
            placeholder="Set this in Template Identity (sidebar)"
            className={`w-full rounded-md border px-9 py-2 text-sm
                        bg-neutral-950/60 text-neutral-300
                        ${emailOk ? 'border-neutral-800' : 'border-red-500/70'}`}
          />
        </div>

        <div className="flex items-start gap-2">
          <Info className="mt-[2px] h-4 w-4 text-neutral-400" />
          <p className="text-xs text-neutral-400">
            This address comes from <span className="font-medium">Template Identity</span> in the sidebar.
          </p>
        </div>
      </div>

      {/* Included Services (subset of DB services) */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-neutral-200">Included Services</label>

        {allAvailableServices.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {allAvailableServices.map((service) => {
                const checked = services.includes(service);
                return (
                  <label
                    key={service}
                    className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm
                                ${checked
                                  ? 'border-purple-500/60 bg-purple-500/10'
                                  : 'border-neutral-800 hover:bg-neutral-800/60'}`}
                  >
                    <input
                      type="checkbox"
                      className="form-checkbox accent-purple-600"
                      checked={checked}
                      onChange={() => toggleService(service)}
                    />
                    {service}
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-neutral-400">
              Need another option? Add services in the <span className="font-medium">sidebar settings</span>.
            </p>
          </>
        ) : (
          <div className="rounded-md border border-dashed border-neutral-800 px-3 py-3 text-sm text-neutral-400">
            No services defined yet. Add services in the <span className="font-medium">sidebar settings</span>.
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm rounded-md border border-neutral-700 bg-neutral-800 hover:bg-neutral-700"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            onSave({
              ...formBlock,
              // ✅ Save only title + DB-backed services subset (no email in block JSON)
              content: { title, services: sanitizedSubset },
            });
          }}
          className="px-4 py-2 text-sm rounded-md bg-purple-600 text-white shadow
                     hover:bg-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          Save
        </button>
      </div>
    </div>
  );
}
