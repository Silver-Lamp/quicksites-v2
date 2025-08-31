import { useRef } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { usePanel } from './panel-context';

type Props = {
  id: string;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

export default function CollapsiblePanel({ id, title, defaultOpen = false, children }: Props) {
  const [isOpen, toggle] = usePanel(id, defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div className="border border-gray-700 rounded overflow-hidden">
      <div
        className="flex items-center justify-between p-3 cursor-pointer bg-muted"
        onClick={toggle}
      >
        <h3 className="text-md font-semibold">{title}</h3>
        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </div>

      <div
        ref={contentRef}
        className="transition-all duration-300 ease-in-out overflow-hidden"
        style={{
          maxHeight: isOpen ? contentRef.current?.scrollHeight ?? 9999 : 0,
          opacity: isOpen ? 1 : 0.5,
        }}
      >
        <div className="p-3 pt-0">{children}</div>
      </div>
    </div>
  );
}
