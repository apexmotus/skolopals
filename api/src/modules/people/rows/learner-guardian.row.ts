export interface LearnerGuardianRow {
  learner_id: string;
  guardian_id: string;
  /**
   * `null` when the caller is entitled to see the guardian LINK
   * (`learner_guardians`'s own RLS allows a teaching tutor via
   * `can_view_learner`) but not the guardian's `profiles` row (`profiles`'
   * RLS is self-or-admin only) — confirmed live: a tutor got an EMPTY
   * result from an inner join here, silently hiding that a guardian link
   * exists at all. Left-joining against `profiles` and letting these
   * columns be null degrades correctly instead.
   */
  guardian_name: string | null;
  guardian_phone: string | null;
  relationship: string;
  is_primary: boolean;
  is_billing_contact: boolean;
}
