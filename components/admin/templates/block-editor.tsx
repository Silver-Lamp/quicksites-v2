// BlockEditor.tsx
import { Input, Textarea, Label, Button } from '@/components/ui';
import { Plus, Trash2 } from 'lucide-react';

type Block = {
  id: string;
  type: string;
  [key: string]: any;
};

type Props = {
  block: Block;
  onChange: (block: Block) => void;
};

export default function BlockEditor({ block, onChange }: Props) {
  const updateField = (key: string, value: any) => {
    onChange({ ...block, [key]: value });
  };

  const updateListItem = (index: number, value: string) => {
    const items = [...(block.items || [])];
    items[index] = value;
    updateField('items', items);
  };

  const addListItem = () => {
    const items = [...(block.items || []), ''];
    updateField('items', items);
  };

  const deleteListItem = (index: number) => {
    const items = [...(block.items || [])];
    items.splice(index, 1);
    updateField('items', items);
  };

  switch (block.type) {
    case 'text':
      return (
        <div>
          <Label>Text</Label>
          <Textarea
            value={block.value || ''}
            onChange={(e) => updateField('value', e.target.value)}
          />
        </div>
      );

    case 'image':
      return (
        <div className="space-y-2">
          <Label>Image URL</Label>
          <Input value={block.url || ''} onChange={(e) => updateField('url', e.target.value)} />
          <Label>Alt Text</Label>
          <Input value={block.alt || ''} onChange={(e) => updateField('alt', e.target.value)} />
          {block.url && <img src={block.url} alt={block.alt} className="w-full rounded" />}
        </div>
      );

    case 'cta':
      return (
        <div className="space-y-2">
          <Label>CTA Label</Label>
          <Input value={block.label || ''} onChange={(e) => updateField('label', e.target.value)} />
          <Label>Link</Label>
          <Input value={block.link || ''} onChange={(e) => updateField('link', e.target.value)} />
        </div>
      );

    case 'quote':
      return (
        <div className="space-y-2">
          <Label>Quote</Label>
          <Textarea
            value={block.text || ''}
            onChange={(e) => updateField('text', e.target.value)}
          />
          <Label>Attribution</Label>
          <Input
            value={block.attribution || ''}
            onChange={(e) => updateField('attribution', e.target.value)}
          />
        </div>
      );

    case 'video':
      return (
        <div className="space-y-2">
          <Label>Embed URL (YouTube, Vimeo...)</Label>
          <Input
            value={block.embed_url || ''}
            onChange={(e) => updateField('embed_url', e.target.value)}
          />
          <Label>Caption</Label>
          <Input
            value={block.caption || ''}
            onChange={(e) => updateField('caption', e.target.value)}
          />
          {block.embed_url && (
            <iframe src={block.embed_url} className="w-full aspect-video rounded" allowFullScreen />
          )}
        </div>
      );

    case 'divider':
      return <div className="my-4 border-t border-muted" />;

    case 'list':
      return (
        <div className="space-y-2">
          <Label>List Items</Label>
          {(block.items || []).map((item: string, i: number) => (
            <div key={i} className="flex gap-2 items-center">
              <Input value={item} onChange={(e) => updateListItem(i, e.target.value)} />
              <Button variant="ghost" size="sm" onClick={() => deleteListItem(i)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <Button onClick={addListItem} variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" /> Add Item
          </Button>
        </div>
      );

    default:
      return (
        <div className="text-sm text-muted-foreground">Unsupported block type: {block.type}</div>
      );
  }
}
