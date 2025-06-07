import { ThemeToggleButton } from '@/components/ui/ThemeToggleButton';
import { PrimaryButton } from '@/components/ui/Button';
import Card from '@/components/ui/Card';

export default function ThemePreviewPage() {
  return (
    <div className="min-h-screen bg-surface text-text p-md space-y-6">
      <h1 className="text-2xl font-bold">🎨 Theme Preview</h1>
      <ThemeToggleButton />
      <Card>
        <p>This card uses shared token styles.</p>
        <PrimaryButton>Click Me</PrimaryButton>
      </Card>
    </div>
  );
}
