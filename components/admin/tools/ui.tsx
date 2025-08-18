// components/admin/tools/ui.tsx
'use client';

import * as React from 'react';

export function ToolCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border p-5">
      <div className="mb-3 space-y-1">
        <h2 className="text-base font-semibold leading-6">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  autoComplete,
  required,
  validate,
  help,
  example,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: React.HTMLInputTypeAttribute;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  validate?: (v: string) => string | null;
  help?: string;
  example?: string;
}) {
  const [touched, setTouched] = React.useState(false);
  let err: string | null = null;

  if (required && !value.trim()) err = `${label} is required`;
  if (!err && validate) err = validate(value);

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      <input
        id={id}
        value={value}
        type={type}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={!!err && touched}
        className={[
          'w-full rounded-md border bg-background px-3 py-2 text-sm outline-none',
          'focus:ring-2 focus:ring-ring',
          err && touched ? 'border-destructive' : 'border-input',
        ].join(' ')}
      />
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
      {example && (
        <p className="text-xs text-muted-foreground">
          <span className="rounded bg-muted px-1 py-0.5">example</span> {example}
        </p>
      )}
      {err && touched && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}

export function SelectField<T extends string>({
  id,
  label,
  value,
  onChange,
  options,
  help,
  required,
}: {
  id: string;
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { label: string; value: T }[];
  help?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}

export function HelpRow({ items }: { items: string[] }) {
  return (
    <ul className="grid list-disc grid-cols-1 gap-1 pl-5 text-xs text-muted-foreground md:grid-cols-2">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

export function PrimaryButton({
  children,
  disabled,
  onClick,
  busy,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  busy?: boolean;
}) {
  return (
    <button
      className="inline-flex items-center rounded-md border border-border bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
    >
      {busy ? 'Working…' : children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="inline-flex items-center rounded-md border border-input bg-muted/40 px-3 py-2 text-sm hover:bg-muted"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function OutputPanel({
  busyLabel,
  err,
  out,
}: {
  busyLabel: string | null;
  err: string | null;
  out: Record<string, any> | null;
}) {
  return (
    <section className="rounded-xl border p-5">
      <h2 className="text-base font-semibold leading-6">Output</h2>
      {busyLabel && (
        <div className="mt-2 text-sm text-muted-foreground">
          Working: {busyLabel}…
        </div>
      )}
      {err && (
        <pre className="mt-2 whitespace-pre-wrap rounded bg-red-500/10 p-3 text-sm text-red-600">
          {err}
        </pre>
      )}
      {out && (
        <pre className="mt-2 max-h-72 overflow-auto rounded bg-muted/30 p-3 text-xs">
          {JSON.stringify(out, null, 2)}
        </pre>
      )}
    </section>
  );
}
