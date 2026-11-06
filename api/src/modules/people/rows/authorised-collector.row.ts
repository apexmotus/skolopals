export interface AuthorisedCollectorRow {
  id: string;
  learner_id: string;
  full_name: string;
  relationship: string;
  phone: string;
  id_number_last4: string | null;
  active_from: string;
  active_to: string | null;
}
