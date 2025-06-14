import { ThemeToggleButton } from '@/components/ui/ThemeToggleButton';
import { Button } from '@/components/admin/ui/button';
import Card from '@/components/ui/Card';

export default function ThemePreviewPage() {
  return (
    <div className="min-h-screen bg-surface text-text p-md space-y-6">
      <h1 className="text-2xl font-bold">🎨 Theme Preview</h1>
      <ThemeToggleButton />
      <Card>
        <p>This card uses shared token styles.</p>
        <Button>Click Me</Button>
      </Card>
    </div>
  );
}
