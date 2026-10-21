import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export { cx };

/* Buttons ------------------------------------------------------------------ */

type ButtonVariant = "primary" | "secondary" | "dark" | "danger";

const buttonBase =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[6px] border border-line px-[18px] py-[11px] text-[13px] leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-60";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-[#2c5a56]",
  secondary: "bg-white text-ink hover:bg-subtle",
  dark: "border-ink bg-ink text-white hover:bg-black",
  danger: "border-danger bg-danger text-white hover:bg-[#991b1b]",
};

export function buttonClass(variant: ButtonVariant = "primary", className?: string) {
  return cx(buttonBase, buttonVariants[variant], className);
}

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}

/* Surfaces ----------------------------------------------------------------- */

export function Card({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cx(
        "flex flex-col gap-[14px] rounded-[10px] border border-line bg-white p-5 shadow-card",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({ className, children }: { className?: string; children: ReactNode }) {
  return <h2 className={cx("text-[20px] font-bold text-ink", className)}>{children}</h2>;
}

export function PageHeading({
  title,
  description,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-[5px]", className)}>
      <h1 className="text-[28px] text-ink">{title}</h1>
      {description ? <p className="text-[13px] text-muted">{description}</p> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <Card className="min-w-0 flex-1">
      <p className="text-[13px] text-muted">{label}</p>
      <p className="text-[28px] text-ink">{value}</p>
      {hint ? <p className="text-[11px] text-brand">{hint}</p> : null}
    </Card>
  );
}

/* Badges ------------------------------------------------------------------- */

type BadgeTone = "neutral" | "brand" | "success" | "danger" | "warning" | "onDark";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-[rgba(104,113,125,0.09)] text-muted",
  brand: "bg-canvas text-brand font-semibold",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger font-semibold",
  warning: "bg-warning-soft text-warning font-semibold",
  onDark: "bg-white/[0.09] text-white",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full px-[10px] py-[5px] text-[11px]",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* Forms -------------------------------------------------------------------- */

const inputClass =
  "h-[42px] w-full rounded-[6px] border border-line bg-white px-3 text-[13px] text-ink placeholder:text-muted";

export function Field({
  label,
  htmlFor,
  className,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  className?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx("flex min-w-0 flex-col gap-[6px]", className)}>
      <label htmlFor={htmlFor} className="text-[11px] text-ink">
        {label}
      </label>
      {children}
      {error ? <p className="text-[11px] text-danger">{error}</p> : null}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(inputClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(inputClass, "h-auto min-h-[42px] py-3", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        className={cx(inputClass, "appearance-none pr-9 invalid:text-muted", className)}
        {...props}
      >
        {children}
      </select>
      <img
        src="/icons/chevron-down.svg"
        alt=""
        width={16}
        height={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
      />
    </div>
  );
}

export function FormMessage({ tone = "danger", children }: { tone?: "danger" | "success"; children: ReactNode }) {
  return (
    <p
      role={tone === "danger" ? "alert" : "status"}
      className={cx(
        "rounded-[8px] p-3 text-[12px]",
        tone === "danger" ? "bg-danger-soft text-danger" : "bg-canvas text-brand",
      )}
    >
      {children}
    </p>
  );
}

/* Data display ------------------------------------------------------------- */

export function Divider() {
  return <img src="/icons/divider.svg" alt="" width={290} height={1} className="h-px w-full" />;
}

export function Rating({ rating, count, className }: { rating: number; count: number; className?: string }) {
  return (
    <p className={cx("text-[11px] text-star", className)}>
      ★ {Number(rating).toFixed(1)} · {count} reviews
    </p>
  );
}

export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 text-[13px]">
      <span className="text-muted">{label}</span>
      <span className="text-right font-semibold text-ink">{value}</span>
    </div>
  );
}

export type Column<T> = { header: string; cell: (row: T) => ReactNode; primary?: boolean };

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
}) {
  return (
    <div className="w-full overflow-x-auto rounded-[10px] border border-line bg-white">
      <table className="w-full min-w-[560px] table-fixed text-left">
        <thead className="bg-subtle">
          <tr>
            {columns.map((c) => (
              <th key={c.header} className="p-3 text-[11px] font-bold text-muted">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr className="border-t border-line">
              <td colSpan={columns.length} className="p-3 text-[13px] text-muted">
                {empty ?? "Nothing to show yet."}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)} className="border-t border-line">
                {columns.map((c) => (
                  <td key={c.header} className={cx("p-3 text-[13px]", c.primary ? "text-ink" : "text-muted")}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/* Status / empty states ---------------------------------------------------- */

export function StatusState({
  icon,
  title,
  description,
  children,
  className,
}: {
  icon: string;
  title: string;
  description: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex min-h-[560px] flex-col items-center justify-center gap-4 text-center", className)}>
      <img src="/icons/status-circle.svg" alt="" width={72} height={72} />
      <img src={icon} alt="" width={32} height={32} />
      <h1 className="text-[28px] text-black">{title}</h1>
      <p className="max-w-[520px] text-[12px] leading-[1.5] text-muted">{description}</p>
      {children ? <div className="flex flex-wrap justify-center gap-[10px]">{children}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card className="items-center py-12 text-center">
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      <p className="max-w-[420px] text-[12px] text-muted">{description}</p>
      {children ? <div className="flex flex-wrap justify-center gap-[10px]">{children}</div> : null}
    </Card>
  );
}
