// Display helpers. Lessons are scheduled in Europe/London (see booking timezone card).
export const TIME_ZONE = "Europe/London";

export function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function hourlyRate(cents: number) {
  return `R${Math.round(cents / 100)}/hr`;
}

const fmt = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, ...opts });

export function dayLabel(iso: string) {
  // "Mon 12"
  return fmt({ weekday: "short", day: "numeric" }).format(new Date(iso)).replace(",", "");
}

export function shortDate(iso: string) {
  // "Tue 13 Oct"
  return fmt({ weekday: "short", day: "numeric", month: "short" }).format(new Date(iso)).replace(",", "");
}

export function longDate(iso: string) {
  // "Tuesday 13 October"
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

export const BOOKING_STATUS_LABEL = {
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
} as const;

export const TUTOR_STATUS_LABEL = {
  pending: "Pending review",
  approved: "Approved",
  declined: "Declined",
  more_info: "More info requested",
  suspended: "Suspended",
} as const;

/** Request-time clock helpers (kept out of component bodies). */
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
