// components/admin/templates/grid-template-modal.tsx
"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import GridTemplateManager from "./grid-template-manager";
import { GridPreset } from "@/types/grid-presets";
import { X } from "lucide-react";
import { Template } from "@/types/template";

export default function GridTemplateModal({
  onSelect,
  template,
}: {
  onSelect: (preset: GridPreset, applyAsSection: boolean) => void;
  template: Template;
}) {
  const [open, setOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [applyAsSection, setApplyAsSection] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm" variant="outline">
          Browse Templates
        </Button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" />
        <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background p-6 rounded-lg shadow-xl w-[500px] max-h-[90vh] overflow-y-auto space-y-4">
          <div className="flex justify-between items-center">
            <Dialog.Title className="text-lg font-semibold text-white">
              Choose a Template
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button size="icon" variant="ghost">
                <X className="w-4 h-4" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="flex gap-4 items-center text-sm text-muted-foreground">
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={showPreview}
                onChange={() => setShowPreview(!showPreview)}
              />
              Preview Live
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={applyAsSection}
                onChange={() => setApplyAsSection(!applyAsSection)}
              />
              Apply as Section
            </label>
          </div>

          <GridTemplateManager
            showPreview={showPreview}
            onInsertTemplate={(preset) => {
              onSelect(preset, applyAsSection);
              setOpen(false);
            }}
            template={template as unknown as Template}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
