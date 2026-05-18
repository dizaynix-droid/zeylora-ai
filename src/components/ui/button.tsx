import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { clsx } from "clsx";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  href?: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
};

const variants = {
  primary:
    "bg-blue-600 text-white shadow-[0_8px_20px_rgba(37,99,235,.18)] hover:bg-blue-700 focus-visible:outline-blue-600",
  secondary:
    "border border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-slate-600",
  ghost:
    "text-slate-700 hover:bg-slate-100 focus-visible:outline-slate-600"
};

export function Button({ href, children, variant = "primary", className, ...props }: ButtonProps) {
  const classes = clsx(
    "focus-lift inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
    variants[variant],
    className
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
