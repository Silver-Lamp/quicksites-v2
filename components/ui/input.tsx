import * as React from 'react';
import { cn } from '@/admin/lib/utils';

type InputProps = React.ComponentProps<'input'> & {
  /** Visible label above the input */
  label?: React.ReactNode;
  /** Small helper text under the input (alias: description) */
  helperText?: React.ReactNode;
  description?: React.ReactNode;
  /** Validation error text (styles the input red and sets aria-invalid) */
  error?: React.ReactNode;
  /** Show a red asterisk after the label */
  requiredIndicator?: boolean;
  /** Classnames for wrapper/label */
  containerClassName?: string;
  labelClassName?: string;
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      id: idProp,
      label,
      helperText,
      description,
      error,
      required,
      requiredIndicator,
      containerClassName,
      labelClassName,
      ...props
    },
    ref
  ) => {
    const reactId = React.useId();
    const id = idProp ?? reactId;
    const help = helperText ?? description;

    return (
      <div className={cn('grid gap-1', containerClassName)}>
        {label != null && (
          <label
            htmlFor={id}
            className={cn(
              'text-sm font-medium leading-none',
              'peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
              labelClassName
            )}
          >
            {label}
            {(required || requiredIndicator) && (
              <span className="ml-0.5 text-red-600" aria-hidden>
                *
              </span>
            )}
          </label>
        )}

        <input
          id={id}
          type={type}
          ref={ref}
          aria-invalid={!!error || undefined}
          className={cn(
            'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors',
            'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
            'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
            error && 'border-red-500 focus-visible:ring-red-500',
            className
          )}
          {...props}
        />

        {(error || help) && (
          <p
            className={cn(
              'text-xs mt-1',
              error ? 'text-red-600' : 'text-muted-foreground'
            )}
          >
            {error ?? help}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
