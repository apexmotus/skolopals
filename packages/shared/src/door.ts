import "server-only";
import { createClient } from "./supabase/server";

/**
 * The door: signing learners in and out of in-centre sessions, shared by the tutor and admin
 * portals. Every write goes through the caller's own Supabase session, so the database decides
 * who may do what: the teaching tutor (or substitute) for their session, or an admin. The rules
 * about who may collect a child are enforced there too, by triggers on session_check_ins.
 * docs/SPEC-2026-11-door-and-online-attendance.md.
 */

export type DoorState = { error?: string; ok?: string };

export type DoorContact = { id: string; name: string; relationship: string; phone: string; idLast4: string | null };

export type DoorLearner = {
  id: string;
  name: string;
  mayLeaveAlone: boolean;
  guardians: DoorContact[];
  collectors: DoorContact[];
  checkIn: {
    id: string;
    arrivedAt: string;
    departedAt: string | null;
    collectedByName: string | null;
    leftAlone: boolean;
  } | null;
};

/** How long after signing out a mistake can still be undone. */
export const UNDO_SIGN_OUT_MINUTES = 10;

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const clean = (m: string) => m.replace(/^.*?:\s*/, "");

/** One in-centre session and everyone placed in it, with their door status and who may collect them. */
export async function getDoorSession(sessionId: string) {
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("class_sessions")
    .select("id, starts_at, ends_at, status, class_group_id, class_groups(name, delivery_mode)")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return null;

  const [{ data: placed }, { data: checkIns }, { data: contacts }] = await Promise.all([
    supabase
      .from("class_enrolments")
      .select("learner_id, learners(full_name, may_leave_alone)")
      .eq("class_group_id", session.class_group_id)
      .is("left_on", null),
    supabase
      .from("session_check_ins")
      .select("id, learner_id, arrived_at, departed_at, collected_by_name, left_alone")
      .eq("class_session_id", sessionId),
    supabase.rpc("door_contacts", { p_session_id: sessionId }),
  ]);

  const checkInBy = new Map((checkIns ?? []).map((c) => [c.learner_id, c]));
  const contactsFor = (learnerId: string, kind: "guardian" | "collector") =>
    (contacts ?? [])
      .filter((c) => c.learner_id === learnerId && c.kind === kind)
      .map((c) => ({ id: c.id, name: c.full_name, relationship: c.relationship, phone: c.phone, idLast4: c.id_last4 }));

  const learners: DoorLearner[] = (placed ?? [])
    .map((p) => {
      const c = checkInBy.get(p.learner_id);
      return {
        id: p.learner_id,
        name: p.learners?.full_name ?? "Learner",
        mayLeaveAlone: Boolean(p.learners?.may_leave_alone),
        guardians: contactsFor(p.learner_id, "guardian"),
        collectors: contactsFor(p.learner_id, "collector"),
        checkIn: c
          ? {
              id: c.id,
              arrivedAt: c.arrived_at,
              departedAt: c.departed_at,
              collectedByName: c.collected_by_name,
              leftAlone: c.left_alone,
            }
          : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    session: {
      id: session.id,
      startsAt: session.starts_at,
      endsAt: session.ends_at,
      status: session.status,
      className: session.class_groups?.name ?? "Class",
      deliveryMode: session.class_groups?.delivery_mode ?? "in_centre",
    },
    learners,
  };
}

async function me() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, profileId: data?.claims?.sub ?? null };
}

export async function signIn(formData: FormData): Promise<DoorState> {
  const { supabase, profileId } = await me();
  const { error } = await supabase.from("session_check_ins").insert({
    class_session_id: text(formData, "session_id"),
    learner_id: text(formData, "learner_id"),
    signed_in_by: profileId,
  });
  if (error?.code === "23505") return { error: "Already signed in." };
  if (error) return { error: "Could not sign in. Only the class’s tutor or an administrator can." };
  return { ok: "Signed in, and marked on the register." };
}

/** `collector` is "guardian:<id>", "collector:<id>" or "alone". The database checks it is allowed. */
export async function signOut(formData: FormData): Promise<DoorState> {
  const choice = text(formData, "collector");
  if (!choice) return { error: "Choose who is collecting." };
  const [kind, id] = choice.split(":");

  const { supabase, profileId } = await me();
  const { data, error } = await supabase
    .from("session_check_ins")
    .update({
      departed_at: new Date().toISOString(),
      signed_out_by: profileId,
      collected_by: kind === "collector" ? id : null,
      collected_by_guardian: kind === "guardian" ? id : null,
      left_alone: kind === "alone",
    })
    .eq("id", text(formData, "check_in_id"))
    .is("departed_at", null)
    .select("id");
  if (error) return { error: clean(error.message) };
  if (!data?.length) return { error: "This learner is already signed out, or isn’t yours to sign out." };
  return { ok: "Signed out. The family has been told." };
}

export async function undoSignOut(formData: FormData): Promise<DoorState> {
  const { supabase } = await me();
  const since = new Date(Date.now() - UNDO_SIGN_OUT_MINUTES * 60_000).toISOString();
  const { data, error } = await supabase
    .from("session_check_ins")
    .update({
      departed_at: null,
      signed_out_by: null,
      collected_by: null,
      collected_by_guardian: null,
      left_alone: false,
    })
    .eq("id", text(formData, "check_in_id"))
    .gte("departed_at", since)
    .select("id");
  if (error) return { error: clean(error.message) };
  if (!data?.length) return { error: `A sign-out can only be undone within ${UNDO_SIGN_OUT_MINUTES} minutes.` };
  return { ok: "Sign-out undone. The learner is back in the centre." };
}

/** Sends any late-pickup alerts that are due. Called whenever staff open the door screen. */
export async function checkLatePickups() {
  const supabase = await createClient();
  await supabase.rpc("alert_late_pickups");
}

/** Everyone signed in today and not yet signed out, across the centre, for the admin door page. */
export async function getStillAtCentre(today: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("session_check_ins")
    .select("id, arrived_at, learners(full_name), class_sessions!inner(session_date, ends_at, class_groups(name))")
    .is("departed_at", null)
    .eq("class_sessions.session_date", today)
    .order("arrived_at");
  return (data ?? []).map((c) => ({
    id: c.id,
    learner: c.learners?.full_name ?? "Learner",
    className: c.class_sessions?.class_groups?.name ?? "Class",
    endsAt: c.class_sessions?.ends_at ?? null,
  }));
}
