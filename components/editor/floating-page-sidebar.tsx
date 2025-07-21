'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { PageManagerSidebar } from './page-manager-sidebar';
import { LayoutPanelTop } from 'lucide-react';
import type { Template } from '@/types/template';

export function FloatingPageSidebar({
  pages,
  selectedIndex,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  onReorder,
  onToggleHeader,
  onToggleFooter,
  templateShowHeader,
  templateShowFooter,
}: React.ComponentProps<typeof PageManagerSidebar> & {
  templateShowHeader?: Template['show_header'];
  templateShowFooter?: Template['show_footer'];
}) {
  const [collapsed, setCollapsed] = useState(false);

  // Compact layout if many pages
  const compactMode = pages.length > 10;

  // Auto-collapse on small screens
  useEffect(() => {
    const handleResize = () => {
      setCollapsed(window.innerWidth < 640);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Collapsed: show floating toggle
  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed bottom-4 left-4 z-50 w-10 h-10 rounded-full bg-purple-700 text-white flex items-center justify-center shadow-md hover:bg-purple-600 transition"
        title="Open Pages"
      >
        <LayoutPanelTop size={20} />
      </button>
    );
  }

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0.15}
      initial={{ x: 0, y: 0 }}
      className={`fixed bottom-0 left-0 z-30 w-64 bg-neutral-900 border-t border-r border-white/10 rounded-tr-xl shadow-lg overflow-y-auto max-h-[75vh] flex flex-col-reverse ${
        compactMode ? 'text-xs leading-tight' : ''
      }`}
    >
      {/* Header */}
      <div className="flex justify-between items-center p-2 border-b border-white/10 bg-neutral-800">
        <span className="text-sm font-semibold text-white">Pages</span>
        <button
          onClick={() => setCollapsed(true)}
          className="text-xs text-white hover:opacity-60"
        >
          Collapse
        </button>
      </div>

      {/* Sidebar body */}
      <PageManagerSidebar
        pages={pages}
        selectedIndex={selectedIndex}
        onSelect={onSelect}
        onAdd={onAdd}
        onRename={onRename}
        onDelete={onDelete}
        onReorder={onReorder}
        compact={compactMode}
        onToggleHeader={onToggleHeader}
        onToggleFooter={onToggleFooter}
        templateShowHeader={templateShowHeader}
        templateShowFooter={templateShowFooter}
      />
    </motion.div>
  );
}
