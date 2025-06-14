import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/admin/ui/button';
import { Monitor, Smartphone } from 'lucide-react';

export default function MobilePreviewWrapper({
  children,
  loopScroll = false
}: {
  children: React.ReactNode;
  loopScroll?: boolean;
}) {
  const [mobile, setMobile] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!loopScroll || !mobile) return;

    const el = scrollRef.current;
    if (!el) return;

    let direction = 1;
    const scrollStep = 0.5;

    const frame = () => {
      if (!el) return;
      el.scrollTop += scrollStep * direction;

      if (el.scrollTop >= el.scrollHeight - el.clientHeight || el.scrollTop <= 0) {
        direction *= -1;
      }

      requestAnimationFrame(frame);
    };

    frame();
  }, [loopScroll, mobile]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => setMobile(!mobile)}
          size="sm"
          variant="secondary"
          className="flex items-center gap-2"
        >
          {mobile ? <Monitor size={14} /> : <Smartphone size={14} />}
          {mobile ? 'Desktop' : 'Mobile'}
        </Button>
      </div>

      <div className="flex justify-center">
        <div className={`transition-all ${mobile ? 'p-6 bg-black rounded-3xl border-4 border-gray-800' : ''}`}>
          <div
            className={`rounded shadow bg-white dark:bg-gray-900 ${
              mobile ? 'w-[375px] h-[667px] overflow-y-auto rounded-[28px]' : 'w-full'
            }`}
            ref={scrollRef}
          >
            <div id="preview-capture" className="p-4 rounded-md shadow bg-white dark:bg-gray-900">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
