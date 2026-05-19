import Link from "next/link";
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { clsx } from "clsx";

type ActionProps = {
  href?: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "quiet" | "danger";
  className?: string;
  type?: ButtonHTMLAttributes<HTMLButtonElement>["type"];
  disabled?: boolean;
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
};

export function VerifyContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}

export function VerifyPageShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main className={clsx("min-h-screen bg-[#f7f8fb] text-slate-950", className)}>
      {children}
    </main>
  );
}

export function VerifyPanel({
  children,
  className,
  as = "div",
  ...props
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
} & HTMLAttributes<HTMLElement>) {
  const Component = as;
  return (
    <Component {...props} className={clsx("rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,.04)]", className)}>
      {children}
    </Component>
  );
}

export function VerifyAction({
  href,
  children,
  variant = "primary",
  className,
  type = "button",
  disabled,
  onClick
}: ActionProps) {
  const styles = clsx(
    "inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
    variant === "primary" && "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300",
    variant === "secondary" && "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50 disabled:text-slate-400",
    variant === "quiet" && "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
    variant === "danger" && "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
    disabled && "cursor-not-allowed opacity-60",
    className
  );

  if (href && !disabled) {
    return (
      <Link href={href} className={styles}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} disabled={disabled} onClick={onClick} className={styles}>
      {children}
    </button>
  );
}

export function VerifyBadge({
  children,
  tone = "neutral",
  className
}: {
  children: ReactNode;
  tone?: "neutral" | "blue" | "green" | "amber" | "red";
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold",
        tone === "neutral" && "border-slate-200 bg-slate-50 text-slate-600",
        tone === "blue" && "border-blue-200 bg-blue-50 text-blue-700",
        tone === "green" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        tone === "amber" && "border-amber-200 bg-amber-50 text-amber-700",
        tone === "red" && "border-rose-200 bg-rose-50 text-rose-700",
        className
      )}
    >
      {children}
    </span>
  );
}

export function VerifyMetric({
  label,
  value,
  note,
  tone = "neutral"
}: {
  label: string;
  value: ReactNode;
  note?: string;
  tone?: "neutral" | "blue" | "green" | "amber" | "red";
}) {
  return (
    <VerifyPanel className="p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p
        className={clsx(
          "mt-2 text-2xl font-semibold tracking-tight",
          tone === "neutral" && "text-slate-950",
          tone === "blue" && "text-blue-700",
          tone === "green" && "text-emerald-700",
          tone === "amber" && "text-amber-700",
          tone === "red" && "text-rose-700"
        )}
      >
        {value}
      </p>
      {note ? <p className="mt-1 text-sm leading-5 text-slate-500">{note}</p> : null}
    </VerifyPanel>
  );
}

export function VerifyTable({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("w-full overflow-x-auto rounded-lg border border-slate-200 bg-white", className)}>
      {children}
    </div>
  );
}

export function VerifyInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        "h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500",
        className
      )}
    />
  );
}
