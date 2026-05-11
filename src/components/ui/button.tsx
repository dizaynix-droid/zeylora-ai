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
    "bg-zeylora-brand text-white shadow-glow hover:brightness-110 focus-visible:outline-cyan",
  secondary:
    "border border-white/15 bg-white/10 text-white hover:border-white/25 hover:bg-white/15 focus-visible:outline-white",
  ghost:
    "text-slate-200 hover:bg-white/10 focus-visible:outline-white"
};

export function Button({ href, children, variant = "primary", className, ...props }: ButtonProps) {
  const classes = clsx(
    "focus-lift inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
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
