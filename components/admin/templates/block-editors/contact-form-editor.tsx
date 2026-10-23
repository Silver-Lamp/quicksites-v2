'use client';

import type { Block } from '@/types/blocks';
import type { BlockEditorProps } from '@/components/admin/templates/block-editors';
import { Mail, Info } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { openSettingsSidebarPanel } from '@/lib/editor/openSettingsPanel';

function isValidEmail(v: string) {
  return !!v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function ContactFormEditor({ block, onSave, onClose, template }: BlockEditorProps) {
  const formBlock = block as unknown as Block;

  // Content-editable: title
  const [title, setTitle] = useState(formBlock.content?.title || 'Contact Us');
  // Simplified (email-only) mode + its copy. lib/forms/contactFormMode.ts
  const c0: any = formBlock.content ?? {};
  const [emailOnly, setEmailOnly] = useState<boolean>(c0.mode === 'email_only');
  const [description, setDescription] = useState<string>(c0.description || '');
  const [buttonText, setButtonText] = useState<string>(c0.button_text || '');
  const [placeholder, setPlaceholder] = useState<string>(c0.placeholder || '');
  const [successMessage, setSuccessMessage] = useState<string>(c0.success_message || '');
  const [note, setNote] = useState<string>(c0.note || '');
  const [autoreplyEnabled, setAutoreplyEnabled] = useState<boolean>(c0.autoreply_enabled !== false);
  const [autoreplyFromName, setAutoreplyFromName] = useState<string>(c0.autoreply_from_name || '');
  const [autoreplySubject, setAutoreplySubject] = useState<string>(c0.autoreply_subject || '');
  const [autoreplyBody, setAutoreplyBody] = useState<string>(c0.autoreply_body || '');
  const businessName = String((template as any)?.business_name || (template as any)?.data?.meta?.business_name || (template as any)?.template_name || '').trim();
  const fieldCls = 'w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent';

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

  // Open the sidebar + scroll to a panel, closing this drawer so it's visible.
  const openSidebarPanel = (panel: 'identity' | 'services') =>
    openSettingsSidebarPanel(panel, { closeDrawer: () => onClose?.() });

  const sidebarLinkClass =
    'font-medium text-purple-300 underline underline-offset-2 hover:text-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-500 rounded';

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

      {/* Simplified mode: one email field, nothing else asked */}
      <div className="space-y-2 rounded-md border border-neutral-800 p-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-neutral-200">
          <input type="checkbox" className="form-checkbox accent-purple-600" checked={emailOnly} onChange={(e) => setEmailOnly(e.target.checked)} />
          Email only (simplified)
        </label>
        <p className="text-xs text-neutral-400">
          One styled email field and a button — no name, phone or service picker. For “notify me” / waitlist sign-ups.
        </p>
        {emailOnly ? (
          <div className="grid grid-cols-1 gap-2 pt-1">
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className={fieldCls} placeholder="One line under the title (optional)" />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input type="text" value={buttonText} onChange={(e) => setButtonText(e.target.value)} className={fieldCls} placeholder="Button text (default: Notify me)" />
              <input type="text" value={placeholder} onChange={(e) => setPlaceholder(e.target.value)} className={fieldCls} placeholder="Field placeholder (default: you@example.com)" />
            </div>
            <input type="text" value={successMessage} onChange={(e) => setSuccessMessage(e.target.value)} className={fieldCls} placeholder="Success message (default: Thanks — you’re on the list.)" />
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className={fieldCls} placeholder="Small print under the field, e.g. what the address is used for (optional)" />
          </div>
        ) : null}
      </div>

      {/* Auto-reply: the email the SUBMITTER gets — the merchant's touchpoint, not QuickSites' */}
      <div className="space-y-2 rounded-md border border-neutral-800 p-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-neutral-200">
          <input type="checkbox" className="form-checkbox accent-purple-600" checked={autoreplyEnabled} onChange={(e) => setAutoreplyEnabled(e.target.checked)} />
          Auto-reply to the person who submits
        </label>
        <p className="text-xs text-neutral-400">
          Sent from “{autoreplyFromName.trim() || businessName || 'your business name'}” with replies going to your contact address. Use {'{name}'}, {'{business}'}, {'{email}'} and {'{site}'} in the text. Leave a field blank for the default.
        </p>
        {autoreplyEnabled ? (
          <div className="grid grid-cols-1 gap-2 pt-1">
            <input type="text" value={autoreplyFromName} onChange={(e) => setAutoreplyFromName(e.target.value)} className={fieldCls} placeholder={`From name (default: ${businessName || 'your business name'})`} />
            <input type="text" value={autoreplySubject} onChange={(e) => setAutoreplySubject(e.target.value)} className={fieldCls} placeholder={emailOnly ? 'Subject (default: You’re on the list — {business})' : 'Subject (default: Thanks for contacting {business})'} />
            <textarea value={autoreplyBody} onChange={(e) => setAutoreplyBody(e.target.value)} rows={5} className={fieldCls} placeholder={emailOnly ? 'Body (default: Thanks for signing up. We’ll email you at this address when there’s news. — {business})' : 'Body (default: Hi {name}, thanks for reaching out. We’ve received your message and will get back to you shortly. — {business})'} />
          </div>
        ) : null}
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
            This address comes from{' '}
            <button type="button" onClick={() => openSidebarPanel('identity')} className={sidebarLinkClass}>
              Template Identity
            </button>{' '}
            in the sidebar.
          </p>
        </div>
      </div>

      {/* Included Services (subset of DB services) — not asked in email-only mode */}
      <div className={emailOnly ? 'hidden' : 'space-y-2'}>
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
            {/* Unticking here read as "remove this service" and then the sidebar still listed all
                five — "I gotta make sure that it adjusted everywhere" (walkthrough, 2026-10-22).
                It is a per-form choice by design; say so where the choice is made. */}
            <p className="text-xs text-neutral-400">
              Ticks choose what <b>this form</b> offers; unticked services stay on your site. To add or remove a
              service everywhere, use{' '}
              <button type="button" onClick={() => openSidebarPanel('services')} className={sidebarLinkClass}>
                Available Services
              </button>
              .
            </p>
          </>
        ) : (
          <div className="rounded-md border border-dashed border-neutral-800 px-3 py-3 text-sm text-neutral-400">
            No services defined yet. Add services in the{' '}
            <button type="button" onClick={() => openSidebarPanel('services')} className={sidebarLinkClass}>
              sidebar settings
            </button>
            .
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
              content: {
                title,
                services: sanitizedSubset,
                ...(autoreplyEnabled ? {} : { autoreply_enabled: false }),
                ...(autoreplyFromName.trim() ? { autoreply_from_name: autoreplyFromName.trim() } : {}),
                ...(autoreplySubject.trim() ? { autoreply_subject: autoreplySubject.trim() } : {}),
                ...(autoreplyBody.trim() ? { autoreply_body: autoreplyBody.trim() } : {}),
                ...(emailOnly
                  ? {
                      mode: 'email_only',
                      ...(description.trim() ? { description: description.trim() } : {}),
                      ...(buttonText.trim() ? { button_text: buttonText.trim() } : {}),
                      ...(placeholder.trim() ? { placeholder: placeholder.trim() } : {}),
                      ...(successMessage.trim() ? { success_message: successMessage.trim() } : {}),
                      ...(note.trim() ? { note: note.trim() } : {}),
                    }
                  : {}),
              },
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
