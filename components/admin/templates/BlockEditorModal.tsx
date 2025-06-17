import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { BlocksEditor } from '@/components/admin/templates/BlocksEditor';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { BlockEditorModalProps } from '@/types/blocks';

const schemaHints: Record<string, string> = {
  type: 'Block type (e.g. hero, services)',
  content: 'Main content object (text, image, etc.)',
  style: 'Optional custom style or class',
};

export default function BlockEditorModal({
  open,
  onClose,
  block,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  block: any;
  onSave: (newBlock: any) => void;
}) {
  const [value, setValue] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(JSON.stringify(block, null, 2));
    setError(null);
  }, [block]);

  const handleSave = () => {
    try {
      const parsed = JSON.parse(value);
      onSave(parsed);
      toast.success('Block updated');
      onClose();
    } catch (e: any) {
      setError(e.message || 'Invalid JSON');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 text-white max-w-2xl max-h-screen overflow-y-auto">
        <h2 className="text-lg font-bold mb-2">Edit Block JSON</h2>
        <BlocksEditor
          blocks={[
            {
              id: crypto.randomUUID(),
              type: 'hero',
              content: {
                title: 'Hello',
                description: 'World',
              },
            },
          ]}
          onChange={() => {}}
        />
        {error && <p className="text-sm text-red-400 mt-2">{error}</p>}

        <div className="mt-4">
          <p className="text-xs font-semibold text-gray-400">
            Block Schema Tips:
          </p>
          <ul className="text-xs mt-1 space-y-1 pl-4 list-disc text-gray-400">
            {Object.entries(schemaHints).map(([key, hint]) => (
              <li key={key}>
                <span className="text-white">{key}:</span> {hint}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-end mt-6 gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
