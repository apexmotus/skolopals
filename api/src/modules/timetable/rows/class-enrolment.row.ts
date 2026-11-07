/** A placement — a learner's membership in a class group. Not the `enrolments` table. */
export interface ClassEnrolmentRow {
  id: string;
  class_group_id: string;
  learner_id: string;
  enrolment_id: string;
  joined_on: string;
  left_on: string | null;
}
