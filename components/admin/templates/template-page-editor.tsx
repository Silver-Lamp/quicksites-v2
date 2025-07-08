'use client';

import { useState } from 'react';
import type { Template, Page } from '@/types/template';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';
import { industryPresets } from '@/lib/presets';
import { PageCard } from './page-card';
import { SortablePage } from './sortable-page';

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';

import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';

type Props = {
  template: Template;
  onChange: (updated: Template) => void;
  onLivePreviewUpdate: (data: Template['data']) => void;
};

export default function TemplatePageEditor({ template, onChange, onLivePreviewUpdate }: Props) {
  const [newTitle, setNewTitle] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newContentBlocks, setNewContentBlocks] = useState<any[]>([]);
  const [expandedPages, setExpandedPages] = useState<Record<string, boolean>>({});

  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = template.data.pages.findIndex((p) => p.id === active.id);
    const newIndex = template.data.pages.findIndex((p) => p.id === over.id);

    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(template.data.pages, oldIndex, newIndex);
    const updatedTemplate = {
      ...template,
      data: { ...template.data, pages: reordered },
    };

    onChange(updatedTemplate);
    onLivePreviewUpdate(updatedTemplate.data);
  };

  const getStarterPagePresets = (industry: string) => {
    const presetBlocks = industryPresets[industry.toLowerCase()] || industryPresets.default;
    return Object.entries(presetBlocks).map(([type, block]) => ({
      label: `${type.charAt(0).toUpperCase() + type.slice(1)} Page`,
      title: type.charAt(0).toUpperCase() + type.slice(1),
      slug: type.toLowerCase(),
      content_blocks: [block],
    }));
  };
  const pagePresets = getStarterPagePresets(template.industry || 'default');

  const handleAddPage = () => {
    if (!newTitle.trim() || !newSlug.trim()) return;
    const newPage: Page = {
      id: crypto.randomUUID(),
      title: newTitle.trim(),
      slug: newSlug.trim(),
      content_blocks: newContentBlocks,
    };
    const updatedTemplate = {
      ...template,
      data: {
        ...template.data,
        pages: [...template.data.pages, newPage],
      },
    };
    onChange(updatedTemplate);
    onLivePreviewUpdate(updatedTemplate.data);
    setNewTitle('');
    setNewSlug('');
    setNewContentBlocks([]);
  };

  const handleRemovePage = (id: string) => {
    const updatedTemplate = {
      ...template,
      data: {
        ...template.data,
        pages: template.data.pages.filter((p) => p.id !== id),
      },
    };
    onChange(updatedTemplate);
    onLivePreviewUpdate(updatedTemplate.data);
  };

  const handleUpdatePage = (id: string, field: keyof Page, value: string) => {
    const updatedPages = template.data.pages.map((p) =>
      p.id === id ? { ...p, [field]: value } : p
    );
    const updatedTemplate = {
      ...template,
      data: { ...template.data, pages: updatedPages },
    };
    onChange(updatedTemplate);
    onLivePreviewUpdate(updatedTemplate.data);
  };

  const movePage = (index: number, direction: 'up' | 'down') => {
    const pages = [...template.data.pages];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= pages.length) return;
    [pages[index], pages[targetIndex]] = [pages[targetIndex], pages[index]];
    const updatedTemplate = {
      ...template,
      data: { ...template.data, pages },
    };
    onChange(updatedTemplate);
    onLivePreviewUpdate(updatedTemplate.data);
  };

  const togglePage = (id: string) => {
    setExpandedPages((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const setAllPagesExpanded = (expanded: boolean) => {
    const next = Object.fromEntries(template.data.pages.map((p) => [p.id, expanded]));
    setExpandedPages(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Template Pages</h3>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setAllPagesExpanded(true)}>
            Expand All
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setAllPagesExpanded(false)}>
            Collapse All
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={template.data.pages.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          {template.data.pages.map((page, i) => (
            <SortablePage key={page.id} id={page.id}>
              <PageCard
                page={page}
                index={i}
                total={template.data.pages.length}
                template={template}
                expanded={expandedPages[page.id] ?? true}
                onToggle={() => togglePage(page.id)}
                onChange={onChange}
                onLivePreviewUpdate={onLivePreviewUpdate}
                onUpdatePageMeta={handleUpdatePage}
                onMovePage={movePage}
                onRemovePage={handleRemovePage}
              />
            </SortablePage>
          ))}
        </SortableContext>
      </DndContext>

      <div className="border-t pt-4 space-y-2">
        <h4 className="font-medium">Add New Page</h4>

        <Label>Start from Preset</Label>
        <Select
          onValueChange={(label) => {
            const preset = pagePresets.find((p) => p.label === label);
            if (preset) {
              setNewTitle(preset.title);
              setNewSlug(preset.slug);
              setNewContentBlocks(preset.content_blocks || []);
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Choose a preset page" />
          </SelectTrigger>
          <SelectContent className="radix-select-content">
            {pagePresets.map((preset) => (
              <SelectItem key={preset.label} value={preset.label}>
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Label>Title</Label>
        <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />

        <Label>Slug</Label>
        <Input value={newSlug} onChange={(e) => setNewSlug(e.target.value)} />

        <Button onClick={handleAddPage} className="mt-2">
          <Plus className="w-4 h-4 mr-2" /> Add Page
        </Button>
      </div>
    </div>
  );
}
