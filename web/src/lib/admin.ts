import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Headline figures for the admin dashboard. BP section 24. */
export async function getDashboard() {
  const supabase = await createClient();
  const month = new Date().toISOString().slice(0, 7) + "-01";

  const [learners, pending, tutors, surplus, outstanding, enquiries] = await Promise.all([
    supabase.from("learners").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("enrolments").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("tutors").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("v_operating_surplus").select("*").eq("month", month).maybeSingle(),
    supabase.from("v_outstanding_fees").select("outstanding_cents"),
    supabase.from("contact_enquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
  ]);

  return {
    activeLearners: learners.count ?? 0,
    pendingEnrolments: pending.count ?? 0,
    activeTutors: tutors.count ?? 0,
    surplus: surplus.data ?? null,
    outstandingCents: (outstanding.data ?? []).reduce((s, r) => s + Number(r.outstanding_cents ?? 0), 0),
    newEnquiries: enquiries.count ?? 0,
  };
}

export async function getKpis() {
  const supabase = await createClient();
  const [revenue, expenses, surplus, attendance, retention, enquiries, breakEven, outstanding] = await Promise.all([
    supabase.from("v_monthly_revenue").select("*").order("month", { ascending: false }).limit(12),
    supabase.from("v_monthly_expenses").select("*").order("month", { ascending: false }).limit(12),
    supabase.from("v_operating_surplus").select("*").order("month", { ascending: false }).limit(12),
    supabase.from("v_attendance_rate").select("*").order("month", { ascending: false }).limit(12),
    supabase.from("v_learner_retention").select("*").order("month", { ascending: false }).limit(12),
    supabase.from("v_enquiry_funnel").select("*").order("month", { ascending: false }).limit(12),
    supabase.from("v_break_even").select("*").order("month", { ascending: false }).limit(1),
    supabase.from("v_outstanding_fees").select("*").order("outstanding_cents", { ascending: false }),
  ]);
  return {
    revenue: revenue.data ?? [],
    expenses: expenses.data ?? [],
    surplus: surplus.data ?? [],
    attendance: attendance.data ?? [],
    retention: retention.data ?? [],
    enquiries: enquiries.data ?? [],
    breakEven: breakEven.data?.[0] ?? null,
    outstanding: outstanding.data ?? [],
  };
}

export async function getEnrolmentQueue() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("enrolments")
    .select(
      // Two FKs point at tutors (preferred and assigned), so the embed is hinted.
      "*, learners(full_name, grade_code, date_of_birth), packages(name), enrolment_subjects(subject_code, preferred_language_code, subjects(name)), tutors!enrolments_preferred_tutor_id_fkey(slug, profiles(full_name))",
    )
    .eq("status", "pending")
    .order("created_at");
  return data ?? [];
}

export async function getTutors() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tutors")
    .select("*, profiles(full_name, phone), tutor_competencies(subject_code, grade_code)")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getEnquiries() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contact_enquiries")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  return data ?? [];
}
