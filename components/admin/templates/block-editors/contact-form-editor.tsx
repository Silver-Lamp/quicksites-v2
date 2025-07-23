'use client';

import type { Block } from '@/admin/lib/zod/blockSchema';
import { useState } from 'react';
import BlockField from '@/components/admin/templates/block-editors/block-field';
import type { BlockEditorProps } from '@/components/admin/templates/block-editors';

export type ContactFormBlock = Extract<Block, { type: 'contact_form' }>;

export function ContactFormEditor({ block, onSave, onClose }: BlockEditorProps) {
  const formBlock = block as ContactFormBlock;
  const [title, setTitle] = useState(formBlock.content?.title || 'Contact Us');
  const [notification_email, setnotification_email] = useState(formBlock.content?.notification_email || '');

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
        onChange={(v) => setnotification_email(v)}
      />

      <div className="flex justify-end gap-2 pt-4">
        <button onClick={onClose} className="px-4 py-2 bg-gray-700 text-white rounded">
          Cancel
        </button>
        <button
          onClick={() => onSave({ ...formBlock, content: { title, notification_email } })}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Save
        </button>
      </div>
    </div>
  );
}