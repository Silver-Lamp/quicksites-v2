import * as React from 'react';
import * as SwitchPrimitives from '@radix-ui/react-switch';
import { cn } from '@/admin/lib/utils';

type SwitchProps = React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> & {
  /** Visible label next to (or above) the switch */
  label?: React.ReactNode;
  /** Helper text shown under the control */
  helperText?: React.ReactNode;
  /** Error text; also styles the control red and sets aria-invalid */
  error?: React.ReactNode;
  /** Layout: label on the right (default), left, or top */
  labelPosition?: 'right' | 'left' | 'top';
  /** Wrapper and label class overrides */
  containerClassName?: string;
  labelClassName?: string;
};

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  SwitchProps
>(
  (
    {
      className,
      label,
      helperText,
      error,
      labelPosition = 'right',
      containerClassName,
      labelClassName,
      id: idProp,
      ...props
    },
    ref
  ) => {
    const reactId = React.useId();
    const id = idProp ?? `switch-${reactId}`;
    const labelId = label ? `${id}-label` : undefined;
    const descId = helperText || error ? `${id}-desc` : undefined;

    const control = (
      <SwitchPrimitives.Root
        id={id}
        ref={ref}
        aria-labelledby={labelId}
        aria-describedby={descId}
        aria-invalid={!!error || undefined}
        className={cn(
          'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'data-[state=checked]:bg-primary data-[state=unchecked]:bg-input',
          error && 'ring-2 ring-red-500 ring-offset-background',
          className
        )}
        {...props}
      >
        <SwitchPrimitives.Thumb
          className={cn(
            'pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform',
            'data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0'
          )}
        />
      </SwitchPrimitives.Root>
    );

    const labelEl =
      label != null ? (
        <span
          id={labelId}
          className={cn(
            'text-sm font-medium leading-none cursor-pointer select-none',
            'peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
            labelClassName
          )}
          onClick={() => {
            const el = document.getElementById(id) as HTMLElement | null;
            el?.click?.();
            el?.focus?.();
          }}
        >
          {label}
        </span>
      ) : null;

    const stackTop = labelPosition === 'top';
    const reverseRow = labelPosition === 'left';

    return (
      <div className={cn('grid gap-1', containerClassName)}>
        <div
          className={cn(
            stackTop ? 'flex flex-col gap-2' : 'flex items-center gap-2',
            reverseRow && !stackTop ? 'flex-row-reverse justify-end' : undefined
          )}
        >
          {stackTop ? labelEl : null}
          {!stackTop && reverseRow ? labelEl : null}
          {control}
          {!stackTop && !reverseRow ? labelEl : null}
        </div>

        {(error || helperText) && (
          <p id={descId} className={cn('text-xs', error ? 'text-red-600' : 'text-muted-foreground')}>
            {error ?? helperText}
          </p>
        )}
      </div>
    );
  }
);

Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
