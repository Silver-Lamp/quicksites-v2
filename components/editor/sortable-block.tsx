'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Block } from '@/types/blocks';
import SortableBlockWrapper from './sortable-block-wrapper';
import RenderBlock from '@/components/admin/templates/render-block';
import { createDefaultBlock } from '@/lib/createDefaultBlock';

export function SortableBlock({
  block,
  blockIndex,
  template,
  pageIndex,
  page,
  setEditing,
  insertedId,
  onChange,
  setLastInsertedId,
}: {
  block: any;
  blockIndex: number;
  template: any;
  pageIndex: number;
  page: any;
  setEditing: (block: any) => void;
  insertedId: string | null;
  onChange: (updated: any) => void;
  setLastInsertedId: (id: string | null) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: block._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <SortableBlockWrapper
      key={block._id}
      block={block}
      index={blockIndex}
      setNodeRef={setNodeRef}
      listeners={listeners}
      attributes={attributes}
      style={style}
      setEditing={setEditing}
      onInsertBlockAt={(insertAt, type) => {
        const newBlock = createDefaultBlock(type as Block['type']);
        const updated = { ...template };
        const blocks = [...updated.data.pages[pageIndex].content_blocks];
        blocks.splice(insertAt, 0, newBlock);
        updated.data.pages[pageIndex].content_blocks = blocks;
        setLastInsertedId(newBlock._id ?? null);
        onChange(updated);
      }}
      onDeleteBlockAt={(deleteIndex) => {
        const updated = { ...template };
        updated.data.pages[pageIndex].content_blocks.splice(deleteIndex, 1);
        onChange(updated);
      }}
      insertedId={insertedId}
      page={page}
    >
      <RenderBlock block={block} />
    </SortableBlockWrapper>
  );
}
