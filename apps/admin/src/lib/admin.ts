import "server-only";
import { api } from "@skolopals/shared/api";
import { createClient } from "@skolopals/shared/supabase/server";

export type AdminUserSummary = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone?: string;
  roles: string[];
  isActive: boolean;
  createdAt: string;
};

export async function getUsers() {
  const paged = await api.getPaged<AdminUserSummary>("/people/users?page=1&pageSize=100");
  return paged.items;
}

/** Headline figures for the admin dashboard. BP section 24. */
export async function getDashboard() {
  const supabase = await createClient();
  const month = new Date().toISOString().slice(0, 7) + "-01";

  const [learners, pending, tutors, surplus, outstanding, enquiries] = await Promise.all([
    supabase.from("learners").select("id", { count: "exact", head: true }).eq("status", "active"),
    // Ready to decide: report card in and aptitude test done (SPEC §4.5).
    supabase.from("v_enrolment_progress").select("enrolment_id", { count: "exact", head: true }).eq("stage", "review"),
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

/** Applications tabs (SPEC §4.4), each a set of derived stages from `v_enrolment_progress`. */
export const APPLICATION_TABS = {
  review: { label: "To review", stages: ["review"] },
  unfinished: { label: "Not finished", stages: ["details", "assessment"] },
  payment: { label: "Awaiting payment", stages: ["payment", "proof", "verification", "activation"] },
  placement: { label: "Needs placement", stages: ["needs_placement"] },
  declined: { label: "Declined", stages: ["declined"] },
} as const;
export type ApplicationTab = keyof typeof APPLICATION_TABS;

/** Every application not yet settled into class, oldest first, with names and subjects for scanning. */
export async function getApplications() {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("v_enrolment_progress")
    .select("*")
    .not("stage", "in", "(active,paused,ended)")
    .order("created_at");
  const ids = (rows ?? []).map((r) => r.enrolment_id as string);
  if (ids.length === 0) return [];

  const { data: details } = await supabase
    .from("enrolments")
    .select("id, learners(full_name), enrolment_subjects(subject_code, subjects(name))")
    .in("id", ids);
  const byId = new Map((details ?? []).map((d) => [d.id, d]));
  return (rows ?? []).map((r) => {
    const d = byId.get(r.enrolment_id as string);
    return {
      ...r,
      learnerName: d?.learners?.full_name ?? "Learner",
      subjects: (d?.enrolment_subjects ?? []).map((s) => s.subjects?.name ?? s.subject_code),
    };
  });
}

/**
 * Classes that could take this learner (SPEC §4.4 capacity hint): current or
 * next term, same subject, grade and medium, with seats free. The same rules
 * automatic placement uses, minus the clash check.
 */
export async function getCapacityHint(
  gradeCode: string,
  subjects: { subject_code: string; preferred_language_code: string | null; subjects: { name: string } | null }[],
) {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data: classes } = await supabase
    .from("class_groups")
    .select(
      "id, name, subject_code, language_code, capacity, tutors(profiles(full_name)), terms!inner(ends_on), class_group_grades!inner(grade_code), class_enrolments(left_on)",
    )
    .eq("is_active", true)
    .eq("class_group_grades.grade_code", gradeCode)
    .gte("terms.ends_on", today);

  return subjects.map((s) => {
    const options = (classes ?? [])
      .filter(
        (c) =>
          c.subject_code === s.subject_code && (!s.preferred_language_code || c.language_code === s.preferred_language_code),
      )
      .map((c) => ({
        id: c.id,
        name: c.name,
        tutor: c.tutors?.profiles?.full_name ?? null,
        free: c.capacity - (c.class_enrolments ?? []).filter((e) => e.left_on === null).length,
      }))
      .filter((c) => c.free > 0);
    return { subject: s.subjects?.name ?? s.subject_code, options };
  });
}

/** Proofs waiting to be checked, oldest first (SPEC §3.2). */
export async function getPaymentQueue() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payment_submissions")
    .select(
      "id, claimed_amount_cents, proof_uploaded_at, invoice_id, invoices(invoice_number, invoice_lines!invoice_lines_invoice_id_fkey(learner_id, voided_at, learners(full_name))), billing_accounts(guardians(profiles(full_name)))",
    )
    .eq("status", "submitted")
    .order("proof_uploaded_at");
  const invoiceIds = (data ?? []).map((s) => s.invoice_id);
  const { data: totals } = invoiceIds.length
    ? await supabase.from("v_invoice_status").select("id, total_cents, balance_cents").in("id", invoiceIds)
    : { data: [] };
  const byInvoice = new Map((totals ?? []).map((t) => [t.id, t]));
  return (data ?? []).map((s) => {
    const learners = [
      ...new Set(
        (s.invoices?.invoice_lines ?? []).filter((l) => !l.voided_at).map((l) => l.learners?.full_name).filter(Boolean),
      ),
    ] as string[];
    const invoice = byInvoice.get(s.invoice_id);
    return {
      id: s.id,
      family: s.billing_accounts?.guardians?.profiles?.full_name ?? "Family",
      learners,
      invoiceNumber: s.invoices?.invoice_number ?? "",
      balanceCents: Number(invoice?.balance_cents ?? 0),
      totalCents: Number(invoice?.total_cents ?? 0),
      claimedCents: s.claimed_amount_cents,
      submittedAt: s.proof_uploaded_at,
    };
  });
}

/** How many proofs are waiting, for the nav badge. */
export async function countProofsToCheck() {
  const supabase = await createClient();
  const { count } = await supabase
    .from("payment_submissions")
    .select("id", { count: "exact", head: true })
    .eq("status", "submitted");
  return count ?? 0;
}

/** One submission with what verifying it needs: the invoice, the account and earlier attempts. */
export async function getPaymentSubmission(id: string) {
  const supabase = await createClient();
  const { data: submission } = await supabase
    .from("payment_submissions")
    .select(
      "*, invoices(invoice_number, issued_on, due_on), billing_accounts(id, guardians(profiles(full_name, phone))), submitted:profiles!payment_submissions_submitted_by_fkey(full_name), reviewer:profiles!payment_submissions_reviewed_by_fkey(full_name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!submission) return null;

  const [{ data: lines }, { data: invoice }, { data: account }, { data: history }] = await Promise.all([
    supabase.from("invoice_lines").select("id, description, line_total_cents, learners(full_name)").eq("invoice_id", submission.invoice_id),
    supabase.from("v_invoice_status").select("total_cents, balance_cents").eq("id", submission.invoice_id).maybeSingle(),
    supabase.from("v_invoice_status").select("balance_cents").eq("billing_account_id", submission.billing_account_id).eq("status", "issued"),
    supabase
      .from("payment_submissions")
      .select("id, status, claimed_amount_cents, proof_uploaded_at, rejection_reason, reviewed_at")
      .eq("invoice_id", submission.invoice_id)
      .neq("id", id)
      .order("created_at", { ascending: false }),
  ]);
  return {
    submission,
    lines: lines ?? [],
    totalCents: Number(invoice?.total_cents ?? 0),
    balanceCents: Number(invoice?.balance_cents ?? 0),
    accountBalanceCents: (account ?? []).reduce((sum, r) => sum + Number(r.balance_cents ?? 0), 0),
    history: history ?? [],
  };
}

/** One enrolment with everything the accept/decline decision needs. */
export async function getEnrolment(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("enrolments")
    .select(
      // Two FKs point at tutors (preferred and assigned), so the embed is hinted.
      "*, learners(full_name, grade_code, date_of_birth, school_name, grades(name), languages(name), learner_guardians(guardian_id, relationship, is_primary, guardians(profiles(full_name, phone))), learner_documents(id, doc_type, academic_year, term, original_name, mime, uploaded_at, superseded_at)), packages(name), enrolment_subjects(subject_code, preferred_language_code, subjects(name), languages(name)), tutors!enrolments_preferred_tutor_id_fkey(slug, profiles(full_name)), aptitude_attempts(id, status, started_at, completed_at, aptitude_responses(answered_at))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const { data: progress } = await supabase.from("v_enrolment_progress").select("*").eq("enrolment_id", id).maybeSingle();
  return { ...data, progress };
}

export async function getTutors() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tutors")
    .select("*, profiles(full_name, phone), tutor_competencies(subject_code, grade_code)")
    .order("created_at", { ascending: false });
  return data ?? [];
}

/** Every learner with their guardians, enrolments and current class placements. */
export async function getLearners() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("learners")
    .select(
      "*, grades(name), learner_guardians(relationship, is_primary, guardians(profiles(full_name, phone))), enrolments(id, status, packages(name)), class_enrolments(id, left_on, class_groups(name))",
    )
    .order("full_name");
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

/** The guardians of every learner currently placed in a class: who to tell about that class. */
export async function getClassFamilyIds(classGroupId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data: placed } = await supabase
    .from("class_enrolments")
    .select("learner_id")
    .eq("class_group_id", classGroupId)
    .is("left_on", null);
  const learnerIds = (placed ?? []).map((p) => p.learner_id);
  if (learnerIds.length === 0) return [];
  const { data: guardians } = await supabase
    .from("learner_guardians")
    .select("guardian_id")
    .in("learner_id", learnerIds);
  return [...new Set((guardians ?? []).map((g) => g.guardian_id))];
}
