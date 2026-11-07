export interface ResourceAudienceRow {
  id: string;
  resource_id: string;
  audience_type: string;
  learner_id: string | null;
  class_group_id: string | null;
  grade_code: string | null;
}

/** Embedded via `json_agg` — there is no separate "list audiences" endpoint. */
export interface ResourceRow {
  id: string;
  title: string;
  subject_code: string | null;
  url: string;
  storage_path: string;
  created_by: string | null;
  created_at: Date;
  audiences: ResourceAudienceRow[];
}
