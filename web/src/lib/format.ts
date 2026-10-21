// Display helpers. The centre operates in Damonsville, Brits, North West.
export const TIME_ZONE = "Africa/Johannesburg";
export const LOCALE = "en-ZA";

/** Rand, from integer cents. Money is never a float anywhere in this app. */
export function money(cents: number) {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/** "R750/month" — package pricing, which is how the centre sells. */
export function monthly(cents: number) {
  return `${money(cents)}/month`;
}

export function perHour(cents: number) {
  return `${money(cents)}/hour`;
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, ...opts });

export function dayLabel(iso: string) {
  return fmt({ weekday: "short", day: "numeric" }).format(new Date(iso)).replace(",", "");
}

export function shortDate(iso: string) {
  return fmt({ weekday: "short", day: "numeric", month: "short" }).format(new Date(iso)).replace(",", "");
}

export function longDate(iso: string) {
  return fmt({ weekday: "long", day: "numeric", month: "long" }).format(new Date(iso)).replace(",", "");
}

export function time(iso: string) {
  return fmt({ hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

export function dateTime(iso: string) {
  return `${shortDate(iso)}, ${time(iso)}`;
}

export function dayKey(iso: string) {
  return fmt({ year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

/** "14:00" from a Postgres time value. */
export function clockTime(sqlTime: string) {
  return sqlTime.slice(0, 5);
}

/** ISO-8601 day of week, matching the iso_dow domain: 1 = Monday. */
export const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export function dayName(isoDow: number) {
  return DAY_NAMES[isoDow] ?? "";
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function relativeDay(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return fmt({ weekday: "long" }).format(new Date(iso));
  return shortDate(iso);
}

export function greeting(now = new Date()) {
  const hour = Number(fmt({ hour: "numeric", hour12: false }).format(now));
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function firstName(name: string) {
  return name.split(/\s+/)[0] || name;
}

export function age(dateOfBirth: string) {
  const dob = new Date(dateOfBirth);
  const now = new Date();
  let years = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) years--;
  return years;
}

export const ENROLMENT_STATUS_LABEL = {
  pending: "Awaiting approval",
  active: "Active",
  paused: "Paused",
  ended: "Ended",
  declined: "Declined",
} as const;

export const ATTENDANCE_LABEL = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  excused: "Excused",
} as const;

export const INVOICE_STATE_LABEL = {
  draft: "Draft",
  unpaid: "Unpaid",
  part_paid: "Partly paid",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
  written_off: "Written off",
} as const;

export const DELIVERY_MODE_LABEL = {
  in_centre: "At the centre",
  online: "Online",
  hybrid: "Hybrid",
} as const;

/** Request-time clock helpers, kept out of component bodies. */
export function hoursUntil(iso: string) {
  return (new Date(iso).getTime() - Date.now()) / 3_600_000;
}

export function daysUntil(iso: string) {
  return Math.ceil(hoursUntil(iso) / 24);
}

export function isWithinLastDays(iso: string, days: number) {
  return Date.now() - new Date(iso).getTime() < days * 86_400_000;
}

export function nowMs() {
  return Date.now();
}
