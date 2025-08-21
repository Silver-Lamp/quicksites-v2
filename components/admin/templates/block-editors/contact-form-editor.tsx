// components/admin/templates/block-editors/contact-form-editor.tsx
'use client';

import type { Block } from '@/types/blocks';
import { useMemo, useState } from 'react';
import type { BlockEditorProps } from '@/components/admin/templates/block-editors';
import { Mail, Info } from 'lucide-react';

function isValidEmail(v: string) {
  if (!v) return false;
  // simple, permissive RFC5322-ish check
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function ContactFormEditor({ block, onSave, onClose, template }: BlockEditorProps) {
  const formBlock = block as unknown as Block;
  const [title, setTitle] = useState(formBlock.content?.title || 'Contact Us');
  const [notification_email, setNotificationEmail] = useState(formBlock.content?.notification_email || '');
  const [services, setServices] = useState<string[]>(formBlock.content?.services || []);

  const allAvailableServices = template?.services || [];
  const emailOk = useMemo(() => isValidEmail(notification_email), [notification_email]);

  const toggleService = (service: string) => {
    setServices((prev) =>
      prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service]
    );
  };

  return (
    <div className="p-5 space-y-5 rounded-xl border bg-white text-zinc-900 shadow-sm
                    dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-800">
      <h3 className="text-lg font-semibold tracking-tight">Edit Contact Form</h3>

      {/* Form Title */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Form Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent
                     dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100"
          placeholder="Contact Us"
        />
      </div>

      {/* Notification Email (clear intent + helper text) */}
      <div className="space-y-1.5">
        <label htmlFor="notify-email" className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Send submissions to
        </label>

        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
            <Mail className="h-4 w-4 text-zinc-400" />
          </span>
          <input
            id="notify-email"
            type="email"
            value={notification_email}
            onChange={(e) => setNotificationEmail(e.target.value.trim())}
            placeholder="name@yourcompany.com"
            aria-invalid={!emailOk}
            aria-describedby="notify-help notify-error"
            className={`w-full rounded-md border bg-white px-9 py-2 text-sm
                        focus:outline-none focus:ring-2 focus:border-transparent
                        dark:bg-zinc-950 dark:text-zinc-100
                        ${emailOk
                          ? 'border-zinc-300 focus:ring-purple-500 dark:border-zinc-800'
                          : 'border-red-500/70 focus:ring-red-500/70'}`}
          />
        </div>

        <div className="flex items-start gap-2">
          <Info className="mt-[2px] h-4 w-4 text-zinc-400" />
          <p id="notify-help" className="text-xs text-zinc-500 dark:text-zinc-400">
            <span className="inline-flex items-center rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700
                              dark:bg-zinc-800 dark:text-zinc-200 mr-2">Destination</span>
            We’ll deliver contact form messages submitted by site visitors to this address.
          </p>
        </div>

        {!emailOk && (
          <p id="notify-error" className="text-xs text-red-400">
            Enter a valid email address—this is where customer inquiries will be sent.
          </p>
        )}
      </div>

      {/* Included Services */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Included Services
        </label>

        {allAvailableServices.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {allAvailableServices.map((service) => {
              const checked = services.includes(service);
              return (
                <label
                  key={service}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm
                              ${checked
                                ? 'border-purple-500/60 bg-purple-500/10'
                                : 'border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-950'}`}
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
        ) : (
          <div className="rounded-md border border-dashed border-zinc-300 px-3 py-3 text-sm text-zinc-500
                          dark:border-zinc-800 dark:text-zinc-400">
            No services defined in this template. You can add services to show a selectable list here.
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm rounded-md border border-zinc-300 bg-white hover:bg-zinc-50
                     dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            if (!emailOk) return;
            onSave({
              ...formBlock,
              content: { title, notification_email, services },
            });
          }}
          disabled={!emailOk}
          className="px-4 py-2 text-sm rounded-md bg-purple-600 text-white shadow
                     enabled:hover:bg-purple-500 enabled:focus:outline-none enabled:focus:ring-2 enabled:focus:ring-purple-500
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save
        </button>
      </div>
    </div>
  );
}
