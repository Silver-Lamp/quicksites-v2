"use client";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { ChevronDown } from "lucide-react";

type Props = {
  id?: string;
  title: React.ReactNode;
  /** Optional leading icon (e.g. a lucide icon) shown before the title. */
  icon?: React.ReactNode;
  /** Optional right-aligned value preview shown in the header when collapsed (and open). */
  summary?: React.ReactNode;
  /** Optional secondary line under the title. */
  description?: React.ReactNode;
  /** Uncontrolled initial open state. */
  defaultOpen?: boolean;
  /** Controlled open state — when provided, the parent owns open/close (pair with onOpenChange). */
  open?: boolean;
  /** Don’t mount children until first open */
  lazyMount?: boolean;
  /** Unmount children when closed (optional) */
  unmountOnClose?: boolean;
  /** Get notified when the drawer opens/closes (fires on user toggle). */
  onOpenChange?: (open: boolean) => void;
  /** Children can be a function to receive the open state */
  children: React.ReactNode | ((opts: { open: boolean }) => React.ReactNode);
  className?: string;
};

export default function CollapsiblePanel({
  id,
  title,
  icon,
  summary,
  description,
  defaultOpen = false,
  open: controlledOpen,
  lazyMount = false,
  unmountOnClose = false,
  onOpenChange,
  children,
  className,
}: Props) {
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = isControlled ? (controlledOpen as boolean) : internalOpen;
  const [everOpened, setEverOpened] = useState(defaultOpen || controlledOpen === true);

  useEffect(() => {
    if (open) setEverOpened(true);
  }, [open]);

  const toggle = () => {
    const next = !open;
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  const shouldRender = useMemo(() => {
    if (!lazyMount) return true;
    if (open) return true;
    if (!unmountOnClose && everOpened) return true;
    return false;
  }, [lazyMount, unmountOnClose, open, everOpened]);

  return (
    <div
      id={id}
      className={clsx(
        "rounded-xl border border-white/10 transition-colors",
        open && "border-white/20 bg-white/[0.02]",
        className,
      )}
    >
      <button
        type="button"
        className="group flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-white/5 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
        aria-expanded={open}
        onClick={toggle}
      >
        {icon ? (
          <span className="shrink-0 text-white/55 group-hover:text-white/75 [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-white/90">{title}</span>
          {description ? <span className="mt-0.5 block truncate text-xs text-white/45">{description}</span> : null}
        </span>
        {summary != null && summary !== "" ? (
          <span
            className={clsx(
              "max-w-[45%] truncate text-right text-xs text-white/45 transition-opacity",
              open && "opacity-0",
            )}
          >
            {summary}
          </span>
        ) : null}
        <ChevronDown
          className={clsx(
            "h-4 w-4 shrink-0 text-white/40 transition-transform group-hover:text-white/70",
            open ? "rotate-0" : "-rotate-90",
          )}
        />
      </button>

      {shouldRender ? (
        <div className={clsx("overflow-hidden transition-[max-height,opacity]",
                             open ? "max-h-[4000px] opacity-100" : "max-h-0 opacity-0")}>
          <div className="p-2">
            {typeof children === "function" ? children({ open }) : children}
          </div>
        </div>
      ) : null}
    </div>
  );
}
