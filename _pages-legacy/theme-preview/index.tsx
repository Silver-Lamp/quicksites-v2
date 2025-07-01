// import { ThemeToggleButton } from '@/components/theme-toggle-button';
// import { Button } from '@/components/ui/button';
// import { Card } from '@/components/ui/card';
// import { ScrollArea } from '@/components/ui/scroll-area';
import React from 'react';

export default function ThemePreviewPage() {
  return (
    <div className="min-h-screen bg-surface text-text p-md space-y-6">
      <h1 className="text-2xl font-bold">🎨 Theme Preview</h1>
      {/* <ThemeToggleButton /> */}
      <div className="h-[500px] overflow-y-auto">
        {/* <Card> */}
        <p>This card uses shared token styles.</p>
        {/* <Button>Click Me</Button> */}
        {/* </Card> */}
      </div>
    </div>
  );
}
