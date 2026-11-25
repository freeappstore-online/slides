import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-paper hover:bg-accent-hover border border-transparent",
  secondary: "bg-paper text-ink border border-line-strong hover:bg-panel",
  ghost: "text-ink border border-transparent hover:bg-panel",
  danger: "bg-paper text-danger border border-line-strong hover:bg-danger-soft",
};

export const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function Button({
  variant = "secondary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS} ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

const CONTROL = `min-w-0 rounded-lg border border-line-strong bg-paper px-3 py-2 text-ink ${FOCUS}`;
export const INPUT = `w-full placeholder:text-muted ${CONTROL}`;
export const SELECT = `min-h-11 ${CONTROL}`;

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}
