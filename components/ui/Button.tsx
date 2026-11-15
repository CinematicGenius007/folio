import type { ButtonHTMLAttributes, InputHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary border-transparent',
  secondary: 'bg-ground text-ink border-control',
  danger: 'bg-danger text-white border-transparent',
  ghost: 'bg-transparent text-muted border-transparent hover:bg-surface',
};

/** The one button style used across Folio. */
export function Button({
  variant = 'secondary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`inline-flex h-8 cursor-pointer items-center gap-2 rounded-[10px] border px-3 text-[13px] font-medium disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
    />
  );
}

/** A single-line text field using the 1px, 10%-ink border from the design. */
export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-8 w-full rounded-[10px] border border-control bg-transparent px-3 text-[14px] text-ink placeholder:text-muted ${className}`}
    />
  );
}
