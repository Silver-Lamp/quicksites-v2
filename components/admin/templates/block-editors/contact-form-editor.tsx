'use client';

import type { Block } from '@/admin/lib/zod/blockSchema';
import { useState } from 'react';
import BlockField from '@/components/admin/templates/block-editors/block-field';
import type { BlockEditorProps } from '@/components/admin/templates/block-editors';

export type ContactFormBlock = Extract<Block, { type: 'contact_form' }>;

export function ContactFormEditor({ block, onSave, onClose, template }: BlockEditorProps) {
  const formBlock = block as ContactFormBlock;
  const [title, setTitle] = useState(formBlock.content?.title || 'Contact Us');
  const [notification_email, setNotificationEmail] = useState(formBlock.content?.notification_email || '');
  const [services, setServices] = useState<string[]>(formBlock.content?.services || []);

  const allAvailableServices = template?.services || [];

  const toggleService = (service: string) => {
    setServices((prev) =>
      prev.includes(service)
        ? prev.filter((s) => s !== service)
        : [...prev, service]
    );
  };

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-semibold">Edit Contact Form</h3>

      <BlockField
        type="text"
        label="Form Title"
        value={title}
        onChange={(v) => setTitle(v)}
      />

      <BlockField
        type="text"
        label="Notification Email"
        value={notification_email}
        onChange={(v) => setNotificationEmail(v)}
      />

      <div className="space-y-2">
        <label className="block font-medium">Included Services</label>

        {allAvailableServices.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {allAvailableServices.map((service) => (
              <label key={service} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="form-checkbox accent-purple-600"
                  checked={services.includes(service)}
                  onChange={() => toggleService(service)}
                />
                {service}
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No services defined in template.</p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <button onClick={onClose} className="px-4 py-2 bg-gray-700 text-white rounded">
          Cancel
        </button>
        <button
          onClick={() =>
            onSave({
              ...formBlock,
              content: {
                title,
                notification_email,
                services,
              },
            })
          }
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Save
        </button>
      </div>
    </div>
  );
}
