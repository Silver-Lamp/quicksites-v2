// components/ui/dropdown-menu.tsx
'use client';

import * as React from 'react';
import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu';
import { cn } from '@/admin/lib/utils';
import { Check, ChevronRight } from 'lucide-react';

const DropdownMenu = DropdownPrimitive.Root;
const DropdownMenuTrigger = DropdownPrimitive.Trigger;
const DropdownMenuPortal = DropdownPrimitive.Portal;

/* ---------- Content ---------- */
const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownPrimitive.Portal>
    <DropdownPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 min-w-[10rem] overflow-hidden rounded-md border border-zinc-800 bg-zinc-900 p-1 text-white shadow-md animate-in fade-in-0',
        className
      )}
      {...props}
    />
  </DropdownPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownPrimitive.Content.displayName;

/* ---------- Item ---------- */
const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Item>
>(({ className, ...props }, ref) => (
  <DropdownPrimitive.Item
    ref={ref}
    className={cn(
      'cursor-pointer select-none rounded-sm px-2 py-1.5 text-sm text-white outline-none hover:bg-zinc-700 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = DropdownPrimitive.Item.displayName;

/* ---------- Label + Separator ---------- */
const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Label>
>(({ className, ...props }, ref) => (
  <DropdownPrimitive.Label
    ref={ref}
    className={cn('px-2 py-1.5 text-xs font-medium text-zinc-400', className)}
    {...props}
  />
));
DropdownMenuLabel.displayName = DropdownPrimitive.Label.displayName;

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownPrimitive.Separator
    ref={ref}
    className={cn('mx-1 my-1 h-px bg-zinc-800', className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = DropdownPrimitive.Separator.displayName;

/* ---------- Group ---------- */
const DropdownMenuGroup = DropdownPrimitive.Group;

/* ---------- Submenu ---------- */
const DropdownMenuSub = DropdownPrimitive.Sub;

const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.SubTrigger>
>(({ className, children, ...props }, ref) => (
  <DropdownPrimitive.SubTrigger
    ref={ref}
    className={cn(
      'flex cursor-pointer select-none items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm text-white outline-none hover:bg-zinc-700 data-[state=open]:bg-zinc-700',
      className
    )}
    {...props}
  >
    {children}
    <ChevronRight className="h-4 w-4 opacity-70" />
  </DropdownPrimitive.SubTrigger>
));
DropdownMenuSubTrigger.displayName = DropdownPrimitive.SubTrigger.displayName;

const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <DropdownPrimitive.SubContent
    ref={ref}
    className={cn(
      'z-50 min-w-[10rem] overflow-hidden rounded-md border border-zinc-800 bg-zinc-900 p-1 text-white shadow-md animate-in fade-in-0',
      className
    )}
    sideOffset={4}
    {...props}
  />
));
DropdownMenuSubContent.displayName = DropdownPrimitive.SubContent.displayName;

/* ---------- Checkbox / Radio ---------- */
const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <DropdownPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      'relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-white outline-none hover:bg-zinc-700 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )}
    checked={checked}
    {...props}
  >
    <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-white/30">
      <DropdownPrimitive.ItemIndicator>
        <Check className="h-3.5 w-3.5" />
      </DropdownPrimitive.ItemIndicator>
    </span>
    <span className="flex-1">{children}</span>
  </DropdownPrimitive.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName = DropdownPrimitive.CheckboxItem.displayName;

const DropdownMenuRadioGroup = DropdownPrimitive.RadioGroup;

const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DropdownPrimitive.RadioItem
    ref={ref}
    className={cn(
      'relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-white outline-none hover:bg-zinc-700 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )}
    {...props}
  >
    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/30">
      <DropdownPrimitive.ItemIndicator>
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-white" />
      </DropdownPrimitive.ItemIndicator>
    </span>
    <span className="flex-1">{children}</span>
  </DropdownPrimitive.RadioItem>
));
DropdownMenuRadioItem.displayName = DropdownPrimitive.RadioItem.displayName;

/* ---------- Exports ---------- */
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,        // ← added
  DropdownMenuSub,          // ← added
  DropdownMenuSubTrigger,   // ← added
  DropdownMenuSubContent,   // ← added
  DropdownMenuCheckboxItem, // ← added
  DropdownMenuRadioGroup,   // ← added
  DropdownMenuRadioItem,    // ← added
};
