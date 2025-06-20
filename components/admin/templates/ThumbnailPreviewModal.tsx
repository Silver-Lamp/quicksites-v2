import { Dialog, DialogContent } from '@/components/ui/dialog';

export default function ThumbnailPreviewModal({
  open,
  onClose,
  imageUrl,
  message,
  timestamp,
}: {
  open: boolean;
  onClose: () => void;
  imageUrl: string;
  message?: string;
  timestamp?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-white dark:bg-gray-900 text-black dark:text-white max-w-xl max-h-screen overflow-y-auto p-4 space-y-4">
        <h2 className="text-lg font-bold">Preview Snapshot</h2>
        <img
          src={imageUrl}
          alt="Version preview"
          className="rounded shadow border border-gray-600"
        />
        {message && <p className="text-sm text-gray-400">📝 {message}</p>}
        {timestamp && (
          <p className="text-xs text-gray-500">📅 {new Date(timestamp).toLocaleString()}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
