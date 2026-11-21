import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { buttonClass, cx, type ButtonVariant } from "./button-styles";

export { buttonClass, cx };

/* Buttons ------------------------------------------------------------------ */

export { Button } from "./button";
export type { ButtonVariant } from "./button-styles";

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
        "flex flex-col gap-[14px] rounded-[12px] border border-line bg-white p-5 shadow-card",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({ className, children }: { className?: string; children: ReactNode }) {
  return <h2 className={cx("text-[18px] font-bold leading-[1.35] text-ink", className)}>{children}</h2>;
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
    <div className={cx("flex flex-col gap-[6px]", className)}>
      <h1 className="text-[28px] font-extrabold leading-[1.25] tracking-[-0.015em] text-ink">{title}</h1>
      {description ? <p className="text-[14px] leading-[1.5] text-muted">{description}</p> : null}
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
      <p className="text-[28px] font-extrabold text-ink">{value}</p>
      {hint ? <p className="text-[11px] font-medium text-link">{hint}</p> : null}
    </Card>
  );
}

/* Badges ------------------------------------------------------------------- */

type BadgeTone = "neutral" | "location" | "brand" | "success" | "danger" | "warning" | "onDark";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-[#DCE7F3] text-muted font-semibold",
  location: "bg-[#DCE7F3] text-muted font-semibold tracking-[0.01em] px-[14px] py-[6px] text-[12px] leading-none",
  brand: "bg-brand-soft text-brand font-semibold",
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
        "inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full px-[12px] py-[5px] text-[12px] leading-none",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* Forms -------------------------------------------------------------------- */

// 16px below md: iOS Safari zooms the page on focus for anything smaller.
const inputClass =
  "h-[44px] w-full rounded-[6px] border border-line bg-white px-3 text-[16px] text-ink placeholder:text-muted md:h-[42px] md:text-[13px]";

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
      <label htmlFor={htmlFor} className="text-[12px] text-ink">
        {label}
      </label>
      {children}
      {error ? <p className="text-[12px] text-danger">{error}</p> : null}
    </div>
  );
}

/** Lays fields side by side from md up; stacked on phones. */
export function FieldRow({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("grid grid-cols-1 gap-3 md:grid-cols-2", className)}>{children}</div>;
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
    <div className="flex items-baseline justify-between gap-4 text-[13px]">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="min-w-0 text-right font-semibold text-ink">{value}</span>
    </div>
  );
}

export type Column<T> = { header: string; cell: (row: T) => ReactNode; primary?: boolean };

// Below md each row is restyled as a card: the primary column is its title and
// every other cell shows its header as a label. One DOM for both layouts, so
// cells holding forms never render twice (duplicate ids, duplicate state).
// With rowHref, a link covers the card; controls inside cells are lifted above it.
const aboveRowLink =
  "max-md:[&_a]:relative max-md:[&_a]:z-[1] max-md:[&_button]:relative max-md:[&_button]:z-[1] max-md:[&_input]:relative max-md:[&_input]:z-[1] max-md:[&_select]:relative max-md:[&_select]:z-[1] max-md:[&_textarea]:relative max-md:[&_textarea]:z-[1] max-md:[&_label]:relative max-md:[&_label]:z-[1] max-md:[&_summary]:relative max-md:[&_summary]:z-[1]";

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowHref,
  empty,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Makes the whole card tappable on phones. Keep a link in the primary cell for keyboard users. */
  rowHref?: (row: T) => string;
  empty?: ReactNode;
}) {
  return (
    <div className="surface-light w-full md:overflow-x-auto md:rounded-[10px] md:border md:border-line md:bg-white">
      <table className="w-full text-left max-md:block md:min-w-[560px] md:table-fixed">
        <thead className="bg-subtle max-md:hidden">
          <tr>
            {columns.map((c) => (
              <th key={c.header} className="p-3 text-[12px] font-bold text-muted">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="max-md:flex max-md:flex-col max-md:gap-3">
          {rows.length === 0 ? (
            <tr className="border-line max-md:block max-md:rounded-[10px] max-md:border max-md:bg-white md:border-t">
              <td colSpan={columns.length} className="p-3 text-[13px] text-muted max-md:block max-md:p-4">
                {empty ?? "Nothing to show yet."}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const href = rowHref?.(row);
              return (
                <tr
                  key={rowKey(row)}
                  className="relative border-line max-md:flex max-md:flex-col max-md:gap-2 max-md:rounded-[10px] max-md:border max-md:bg-white max-md:p-4 max-md:shadow-card md:border-t"
                >
                  {columns.map((c, i) => (
                    <td
                      key={c.header}
                      data-label={c.header}
                      className={cx(
                        "p-3 text-[13px] max-md:p-0",
                        c.primary
                          ? "text-ink max-md:order-first max-md:text-[15px] max-md:font-semibold"
                          : "text-muted max-md:flex max-md:items-start max-md:justify-between max-md:gap-4 max-md:text-right max-md:before:shrink-0 max-md:before:text-left max-md:before:text-[12px] max-md:before:content-[attr(data-label)]",
                        href && aboveRowLink,
                      )}
                    >
                      {href && i === 0 ? (
                        <Link href={href} aria-hidden tabIndex={-1} className="absolute inset-0 md:hidden" />
                      ) : null}
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })
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
      <h1 className="text-[28px] text-ink">{title}</h1>
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
