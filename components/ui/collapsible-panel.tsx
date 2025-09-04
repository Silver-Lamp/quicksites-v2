"use client";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";

type Props = {
  id?: string;
  title: React.ReactNode;
  defaultOpen?: boolean;
  /** Don’t mount children until first open */
  lazyMount?: boolean;
  /** Unmount children when closed (optional) */
  unmountOnClose?: boolean;
  /** Get notified when the drawer opens/closes */
  onOpenChange?: (open: boolean) => void;
  /** Children can be a function to receive the open state */
  children: React.ReactNode | ((opts: { open: boolean }) => React.ReactNode);
  className?: string;
};

export default function CollapsiblePanel({
  id,
  title,
  defaultOpen = false,
  lazyMount = false,
  unmountOnClose = false,
  onOpenChange,
  children,
  className,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [everOpened, setEverOpened] = useState(defaultOpen);

  useEffect(() => {
    onOpenChange?.(open);
    if (open) setEverOpened(true);
  }, [open, onOpenChange]);

  const shouldRender = useMemo(() => {
    if (!lazyMount) return true;
    if (open) return true;
    if (!unmountOnClose && everOpened) return true;
    return false;
  }, [lazyMount, unmountOnClose, open, everOpened]);

  return (
    <div id={id} className={clsx("rounded-xl border border-white/10", className)}>
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 hover:bg-white/5"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-sm font-medium">{title}</span>
        <span className={clsx("transition -rotate-90", open && "rotate-0")}>▸</span>
      </button>

      {shouldRender ? (
        <div className={clsx("overflow-hidden transition-[max-height,opacity]",
                             open ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0")}>
          <div className="p-2">
            {typeof children === "function" ? children({ open }) : children}
          </div>
        </div>
      ) : null}
    </div>
  );
}
