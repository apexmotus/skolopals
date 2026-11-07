export interface EnquiryRow {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  topic: string;
  message: string;
  source: string;
  status: string;
  handled_by: string | null;
  handled_at: Date | null;
  converted_learner_id: string | null;
  created_at: Date;
}
