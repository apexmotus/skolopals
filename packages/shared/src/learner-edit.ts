import "server-only";
import { createClient } from "./supabase/server";

/**
 * Editing a learner's record, shared by the parent and admin portals. Every write goes through
 * the caller's own Supabase session, so RLS decides who may change what: a guardian only their
 * own learners, an administrator anyone ("guardian or admin write" on each table). Callers do
 * the role check and revalidation; these functions do the validation and the write.
 */

export type LearnerEditState = { error?: string; ok?: string };

const LEARNER_STATUSES = ["prospective", "active", "paused", "left"] as const;

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const clean = (m: string) => m.replace(/^.*?:\s*/, "");
const today = () => new Date().toISOString().slice(0, 10);

/** Splits a stored full name for the first/last name fields: the last word is the surname. */
export function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return { first: parts[0] ?? "", last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

/** The learner, their safety contacts, and the reference lists the edit form needs. Null if not visible. */
export async function getLearnerForEdit(id: string) {
  const supabase = await createClient();
  const [{ data: learner }, { data: contacts }, { data: collectors }, { data: grades }, { data: languages }] =
    await Promise.all([
      supabase.from("learners").select("*, grades(name)").eq("id", id).maybeSingle(),
      supabase.from("learner_emergency_contacts").select("*").eq("learner_id", id).order("priority"),
      supabase
        .from("authorised_collectors")
        .select("*")
        .eq("learner_id", id)
        .or(`active_to.is.null,active_to.gte.${today()}`)
        .order("full_name"),
      supabase.from("grades").select("code, name").order("sort_order"),
      supabase.from("languages").select("code, name").order("sort_order"),
    ]);
  if (!learner) return null;
  return {
    learner,
    contacts: contacts ?? [],
    collectors: collectors ?? [],
    grades: grades ?? [],
    languages: languages ?? [],
  };
}

export async function updateLearnerDetails(formData: FormData, { allowStatus }: { allowStatus: boolean }) {
  const id = text(formData, "learner_id");
  const first = text(formData, "first_name");
  const last = text(formData, "last_name");
  const dob = text(formData, "date_of_birth");
  const grade = text(formData, "grade_code");
  if (!id) return { error: "Missing learner." };
  if (!first || !last) return { error: "Enter the learner’s first name and last name." };
  if (!dob) return { error: "Enter the learner’s date of birth." };
  if (!grade) return { error: "Choose a grade." };

  const update: {
    full_name: string;
    date_of_birth: string;
    grade_code: string;
    school_name: string;
    home_language_code: string | null;
    status?: string;
    left_on?: string | null;
  } = {
    full_name: `${first} ${last}`,
    date_of_birth: dob,
    grade_code: grade,
    school_name: text(formData, "school_name"),
    home_language_code: text(formData, "home_language_code") || null,
  };

  if (allowStatus) {
    const status = text(formData, "status");
    if (!(LEARNER_STATUSES as readonly string[]).includes(status)) return { error: "Choose a status." };
    update.status = status;
    // The table requires left_on exactly when the learner has left; it starts the POPIA retention clock.
    update.left_on = status === "left" ? text(formData, "left_on") || today() : null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("learners").update(update).eq("id", id).select("id");
  if (error) return { error: clean(error.message) };
  if (!data?.length) return { error: "You cannot edit this learner." };
  return { ok: "Details saved." };
}

export async function addEmergencyContact(formData: FormData): Promise<LearnerEditState> {
  const id = text(formData, "learner_id");
  const name = `${text(formData, "first_name")} ${text(formData, "last_name")}`.trim();
  const phone = text(formData, "phone");
  if (!text(formData, "first_name") || !text(formData, "last_name") || !phone) {
    return { error: "Enter a first name, last name and phone number." };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("learner_emergency_contacts")
    .select("priority")
    .eq("learner_id", id);
  const used = new Set((existing ?? []).map((c) => c.priority));
  const priority = [1, 2, 3, 4, 5].find((p) => !used.has(p));
  if (!priority) return { error: "A learner can have at most five emergency contacts." };

  const { error } = await supabase.from("learner_emergency_contacts").insert({
    learner_id: id,
    full_name: name,
    relationship: text(formData, "relationship") || "family",
    phone,
    priority,
  });
  if (error) return { error: clean(error.message) };
  return { ok: "Emergency contact added." };
}

export async function removeEmergencyContact(formData: FormData): Promise<LearnerEditState> {
  const id = text(formData, "learner_id");
  const contactId = text(formData, "contact_id");
  const supabase = await createClient();
  const { count } = await supabase
    .from("learner_emergency_contacts")
    .select("id", { count: "exact", head: true })
    .eq("learner_id", id);
  if ((count ?? 0) <= 1) return { error: "Add another emergency contact before removing the last one." };

  const { error } = await supabase
    .from("learner_emergency_contacts")
    .delete()
    .eq("id", contactId)
    .eq("learner_id", id);
  if (error) return { error: clean(error.message) };
  return { ok: "Emergency contact removed." };
}

export async function addCollector(formData: FormData): Promise<LearnerEditState> {
  const id = text(formData, "learner_id");
  const phone = text(formData, "phone");
  const last4 = text(formData, "id_number_last4");
  if (!text(formData, "first_name") || !text(formData, "last_name") || !phone) {
    return { error: "Enter a first name, last name and phone number." };
  }
  if (last4 && !/^[0-9]{4}$/.test(last4)) return { error: "The ID check is the last four digits only." };

  const supabase = await createClient();
  const { error } = await supabase.from("authorised_collectors").insert({
    learner_id: id,
    full_name: `${text(formData, "first_name")} ${text(formData, "last_name")}`,
    relationship: text(formData, "relationship") || "family",
    phone,
    id_number_last4: last4 || null,
  });
  if (error) return { error: clean(error.message) };
  return { ok: "Collector added." };
}

export async function removeCollector(formData: FormData): Promise<LearnerEditState> {
  const id = text(formData, "learner_id");
  const collectorId = text(formData, "collector_id");
  const supabase = await createClient();
  const { error } = await supabase
    .from("authorised_collectors")
    .delete()
    .eq("id", collectorId)
    .eq("learner_id", id);
  if (error) return { error: clean(error.message) };
  return { ok: "Collector removed." };
}
