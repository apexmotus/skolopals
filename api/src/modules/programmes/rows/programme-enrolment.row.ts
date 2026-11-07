/** A booking — a learner's place on a programme. Not the `enrolments` resource. */
export interface ProgrammeEnrolmentRow {
  id: string;
  programme_id: string;
  learner_id: string;
  status: string;
  booked_at: Date;
}
