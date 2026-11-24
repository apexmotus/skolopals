import "server-only";
import { createClient } from "@skolopals/shared/supabase/server";

/** Learners the signed-in guardian is responsible for. RLS does the filtering. */
export async function getLearners() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("learners")
    .select("*, grades(name, phase_code)")
    .order("date_of_birth");
  return data ?? [];
}

export async function getLearner(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("learners")
    .select("*, grades(name, phase_code), learner_emergency_contacts(*), authorised_collectors(*)")
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function getEnrolments() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("enrolments")
    .select("*, learners(full_name), packages(name, billing_period), enrolment_subjects(subject_code, subjects(name))")
    .order("created_at", { ascending: false });
  return data ?? [];
}

/** Upcoming sessions for the family. RLS limits this to their own learners. */
export async function getUpcomingSessions(limit = 10) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("class_sessions")
    .select("*, class_groups(name, delivery_mode, subjects(name), rooms(name))")
    .gte("session_date", new Date().toISOString().slice(0, 10))
    .eq("status", "scheduled")
    .order("starts_at")
    .limit(limit);
  return data ?? [];
}

export async function getAttendance(limit = 50) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("attendance_records")
    .select("*, learners(full_name), class_sessions(session_date, starts_at, class_groups(name))")
    .order("marked_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

/** Only published reports are visible to a parent - RLS enforces that too. */
export async function getPublishedReports() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("progress_reports")
    .select("*, learners(full_name), terms(year, term_number), progress_report_subjects(*, subjects(name), achievement_levels(label))")
    .not("published_at", "is", null)
    .order("issued_on", { ascending: false });
  return data ?? [];
}

/** Resources shared with the family's learners. RLS applies the four-way audience check. */
export async function getResources() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("resources")
    .select("*, subjects(name)")
    .order("created_at", { ascending: false });
  return data ?? [];
}

/** Invoices with their derived payment state, plus the account balance. */
export async function getAccount() {
  const supabase = await createClient();
  const [{ data: invoices }, { data: statement }] = await Promise.all([
    supabase.from("v_invoice_status").select("*").order("issued_on", { ascending: false }),
    supabase.from("v_account_statement").select("*").order("entry_date", { ascending: false }),
  ]);

  const rows = invoices ?? [];
  const outstanding = rows.reduce((sum, i) => sum + Math.max(0, i.balance_cents ?? 0), 0);
  return { invoices: rows, statement: statement ?? [], outstanding };
}

export async function getInvoiceLines(invoiceId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoice_lines")
    .select("*, learners(full_name)")
    .eq("invoice_id", invoiceId);
  return data ?? [];
}

/**
 * Applications still on their way (and recent decisions), with the stage
 * derived by `v_enrolment_progress` (SPEC §4.5). RLS limits both reads to the
 * family's own learners.
 */
export async function getApplications() {
  const supabase = await createClient();
  const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const { data: rows } = await supabase
    .from("v_enrolment_progress")
    .select("*")
    .not("stage", "in", "(active,paused,ended)")
    .order("created_at", { ascending: false });
  const live = (rows ?? []).filter((r) => r.stage !== "declined" || (r.created_at ?? "") > since);
  if (live.length === 0) return [];

  const { data: learners } = await supabase
    .from("learners")
    .select("id, full_name")
    .in("id", live.map((r) => r.learner_id as string));
  const names = new Map((learners ?? []).map((l) => [l.id, l.full_name]));
  return live.map((r) => ({ ...r, learnerName: names.get(r.learner_id as string) ?? "your child" }));
}

/** Unread messages from the centre: decisions, reminders, payment outcomes. */
export async function getUnreadUpdates() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notification_recipients")
    .select("notification_id, notifications(title, body, created_at)")
    .is("read_at", null)
    .limit(10);
  return (data ?? [])
    .filter((r) => r.notifications)
    .sort((a, b) => (b.notifications?.created_at ?? "").localeCompare(a.notifications?.created_at ?? ""));
}
