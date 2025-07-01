import React from 'react';
import { ThemeToggleButton, Button, Card } from '@/components/ui';

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
