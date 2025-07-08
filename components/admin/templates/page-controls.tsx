// components/admin/templates/page-controls.tsx
'use client';

import { ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
};

export function PageControls({ index, total, onMoveUp, onMoveDown, onRemove }: Props) {
  return (
    <div className="flex flex-col justify-between items-end gap-2">
      <Button variant="ghost" size="icon" disabled={index === 0} onClick={onMoveUp}>
        <ArrowUp className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        disabled={index === total - 1}
        onClick={onMoveDown}
      >
        <ArrowDown className="w-4 h-4" />
      </Button>
      <Button variant="destructive" size="icon" onClick={onRemove}>
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}
