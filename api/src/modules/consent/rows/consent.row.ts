export interface ConsentRow {
  id: string;
  consent_type_code: string;
  guardian_id: string;
  learner_id: string | null;
  granted: boolean;
  granted_at: Date;
  withdrawn_at: Date | null;
  policy_version: string;
}
