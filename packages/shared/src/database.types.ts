// GENERATED FILE - do not edit by hand.
// Regenerate with:  cd skolopals-db && make types
//
// Produced by scripts/gen-types.py, which introspects the database directly.
// The Supabase CLI needs Docker; this does not. Output is shape-compatible
// with `supabase gen types typescript`, so switching back is a drop-in change.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      achievement_levels: {
        Row: {
          code: number;
          label: string;
          description: string;
          min_percent: number;
          max_percent: number;
        };
        Insert: {
          code: number;
          label: string;
          description?: string;
          min_percent: number;
          max_percent: number;
        };
        Update: {
          code?: number;
          label?: string;
          description?: string;
          min_percent?: number;
          max_percent?: number;
        };
        Relationships: [];
      };
      assessment_domains: {
        Row: {
          code: string;
          name: string;
          description: string;
          sort_order: number;
        };
        Insert: {
          code: string;
          name: string;
          description?: string;
          sort_order: number;
        };
        Update: {
          code?: string;
          name?: string;
          description?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      assessment_scores: {
        Row: {
          id: string;
          assessment_id: string;
          domain_code: string;
          raw_score: number | null;
          max_score: number | null;
          achievement_level_code: number | null;
          comment: string;
          percent: number | null;
        };
        Insert: {
          id?: string;
          assessment_id: string;
          domain_code: string;
          raw_score?: number | null;
          max_score?: number | null;
          achievement_level_code?: number | null;
          comment?: string;
        };
        Update: {
          id?: string;
          assessment_id?: string;
          domain_code?: string;
          raw_score?: number | null;
          max_score?: number | null;
          achievement_level_code?: number | null;
          comment?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_scores_assessment_id_fkey";
            columns: ["assessment_id"];
            isOneToOne: false;
            referencedRelation: "assessments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_scores_domain_code_fkey";
            columns: ["domain_code"];
            isOneToOne: false;
            referencedRelation: "assessment_domains";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "assessment_scores_achievement_level_code_fkey";
            columns: ["achievement_level_code"];
            isOneToOne: false;
            referencedRelation: "achievement_levels";
            referencedColumns: ["code"];
          },
        ];
      };
      assessment_types: {
        Row: {
          code: string;
          name: string;
          description: string;
          sort_order: number;
        };
        Insert: {
          code: string;
          name: string;
          description?: string;
          sort_order: number;
        };
        Update: {
          code?: string;
          name?: string;
          description?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      assessments: {
        Row: {
          id: string;
          learner_id: string;
          assessment_type_code: string;
          subject_code: string | null;
          grade_code: string;
          term_id: string | null;
          administered_by: string | null;
          assessed_on: string;
          overall_level_code: number | null;
          notes: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          learner_id: string;
          assessment_type_code: string;
          subject_code?: string | null;
          grade_code: string;
          term_id?: string | null;
          administered_by?: string | null;
          assessed_on?: string;
          overall_level_code?: number | null;
          notes?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          learner_id?: string;
          assessment_type_code?: string;
          subject_code?: string | null;
          grade_code?: string;
          term_id?: string | null;
          administered_by?: string | null;
          assessed_on?: string;
          overall_level_code?: number | null;
          notes?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assessments_learner_id_fkey";
            columns: ["learner_id"];
            isOneToOne: false;
            referencedRelation: "learners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessments_assessment_type_code_fkey";
            columns: ["assessment_type_code"];
            isOneToOne: false;
            referencedRelation: "assessment_types";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "assessments_subject_code_fkey";
            columns: ["subject_code"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "assessments_grade_code_fkey";
            columns: ["grade_code"];
            isOneToOne: false;
            referencedRelation: "grades";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "assessments_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "terms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessments_administered_by_fkey";
            columns: ["administered_by"];
            isOneToOne: false;
            referencedRelation: "tutors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessments_overall_level_code_fkey";
            columns: ["overall_level_code"];
            isOneToOne: false;
            referencedRelation: "achievement_levels";
            referencedColumns: ["code"];
          },
        ];
      };
      attendance_records: {
        Row: {
          id: string;
          class_session_id: string;
          learner_id: string;
          status: string;
          marked_by: string | null;
          marked_at: string;
          note: string;
        };
        Insert: {
          id?: string;
          class_session_id: string;
          learner_id: string;
          status: string;
          marked_by?: string | null;
          marked_at?: string;
          note?: string;
        };
        Update: {
          id?: string;
          class_session_id?: string;
          learner_id?: string;
          status?: string;
          marked_by?: string | null;
          marked_at?: string;
          note?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_records_class_session_id_fkey";
            columns: ["class_session_id"];
            isOneToOne: false;
            referencedRelation: "class_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_records_learner_id_fkey";
            columns: ["learner_id"];
            isOneToOne: false;
            referencedRelation: "learners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_records_marked_by_fkey";
            columns: ["marked_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      authorised_collectors: {
        Row: {
          id: string;
          learner_id: string;
          full_name: string;
          relationship: string;
          phone: string;
          id_number_last4: string | null;
          active_from: string;
          active_to: string | null;
        };
        Insert: {
          id?: string;
          learner_id: string;
          full_name: string;
          relationship: string;
          phone: string;
          id_number_last4?: string | null;
          active_from?: string;
          active_to?: string | null;
        };
        Update: {
          id?: string;
          learner_id?: string;
          full_name?: string;
          relationship?: string;
          phone?: string;
          id_number_last4?: string | null;
          active_from?: string;
          active_to?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "authorised_collectors_learner_id_fkey";
            columns: ["learner_id"];
            isOneToOne: false;
            referencedRelation: "learners";
            referencedColumns: ["id"];
          },
        ];
      };
      billing_accounts: {
        Row: {
          id: string;
          guardian_id: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          guardian_id: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          guardian_id?: string;
          status?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "billing_accounts_guardian_id_fkey";
            columns: ["guardian_id"];
            isOneToOne: true;
            referencedRelation: "guardians";
            referencedColumns: ["profile_id"];
          },
        ];
      };
      billing_settings: {
        Row: {
          id: string;
          invoice_prefix: string;
          issue_day: number;
          due_day: number;
          grace_days: number;
          late_fee_cents: number;
          effective_from: string;
          effective_to: string | null;
        };
        Insert: {
          id?: string;
          invoice_prefix?: string;
          issue_day: number;
          due_day: number;
          grace_days: number;
          late_fee_cents: number;
          effective_from: string;
          effective_to?: string | null;
        };
        Update: {
          id?: string;
          invoice_prefix?: string;
          issue_day?: number;
          due_day?: number;
          grace_days?: number;
          late_fee_cents?: number;
          effective_from?: string;
          effective_to?: string | null;
        };
        Relationships: [];
      };
      centre_operating_hours: {
        Row: {
          day_of_week: number;
          opens_at: string;
          closes_at: string;
          purpose: string;
        };
        Insert: {
          day_of_week: number;
          opens_at: string;
          closes_at: string;
          purpose: string;
        };
        Update: {
          day_of_week?: number;
          opens_at?: string;
          closes_at?: string;
          purpose?: string;
        };
        Relationships: [];
      };
      class_enrolments: {
        Row: {
          id: string;
          class_group_id: string;
          learner_id: string;
          enrolment_id: string;
          joined_on: string;
          left_on: string | null;
        };
        Insert: {
          id?: string;
          class_group_id: string;
          learner_id: string;
          enrolment_id: string;
          joined_on?: string;
          left_on?: string | null;
        };
        Update: {
          id?: string;
          class_group_id?: string;
          learner_id?: string;
          enrolment_id?: string;
          joined_on?: string;
          left_on?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "class_enrolments_class_group_id_fkey";
            columns: ["class_group_id"];
            isOneToOne: false;
            referencedRelation: "class_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_enrolments_learner_id_fkey";
            columns: ["learner_id"];
            isOneToOne: false;
            referencedRelation: "learners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_enrolments_enrolment_id_fkey";
            columns: ["enrolment_id"];
            isOneToOne: false;
            referencedRelation: "enrolments";
            referencedColumns: ["id"];
          },
        ];
      };
      class_group_grades: {
        Row: {
          class_group_id: string;
          grade_code: string;
        };
        Insert: {
          class_group_id: string;
          grade_code: string;
        };
        Update: {
          class_group_id?: string;
          grade_code?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_group_grades_class_group_id_fkey";
            columns: ["class_group_id"];
            isOneToOne: false;
            referencedRelation: "class_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_group_grades_grade_code_fkey";
            columns: ["grade_code"];
            isOneToOne: false;
            referencedRelation: "grades";
            referencedColumns: ["code"];
          },
        ];
      };
      class_groups: {
        Row: {
          id: string;
          name: string;
          subject_code: string;
          language_code: string;
          tutor_id: string;
          term_id: string;
          delivery_mode: string;
          room_id: string | null;
          capacity: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          subject_code: string;
          language_code: string;
          tutor_id: string;
          term_id: string;
          delivery_mode: string;
          room_id?: string | null;
          capacity: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          subject_code?: string;
          language_code?: string;
          tutor_id?: string;
          term_id?: string;
          delivery_mode?: string;
          room_id?: string | null;
          capacity?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_groups_subject_code_fkey";
            columns: ["subject_code"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "class_groups_language_code_fkey";
            columns: ["language_code"];
            isOneToOne: false;
            referencedRelation: "languages";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "class_groups_tutor_id_fkey";
            columns: ["tutor_id"];
            isOneToOne: false;
            referencedRelation: "tutors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_groups_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "terms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_groups_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      class_schedules: {
        Row: {
          id: string;
          class_group_id: string;
          day_of_week: number;
          starts_at_time: string;
          ends_at_time: string;
        };
        Insert: {
          id?: string;
          class_group_id: string;
          day_of_week: number;
          starts_at_time: string;
          ends_at_time: string;
        };
        Update: {
          id?: string;
          class_group_id?: string;
          day_of_week?: number;
          starts_at_time?: string;
          ends_at_time?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_schedules_class_group_id_fkey";
            columns: ["class_group_id"];
            isOneToOne: false;
            referencedRelation: "class_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      class_sessions: {
        Row: {
          id: string;
          class_group_id: string;
          schedule_id: string | null;
          session_date: string;
          starts_at: string;
          ends_at: string;
          status: string;
          tutor_id: string | null;
          meeting_url: string | null;
          notes: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          class_group_id: string;
          schedule_id?: string | null;
          session_date: string;
          starts_at: string;
          ends_at: string;
          status?: string;
          tutor_id?: string | null;
          meeting_url?: string | null;
          notes?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          class_group_id?: string;
          schedule_id?: string | null;
          session_date?: string;
          starts_at?: string;
          ends_at?: string;
          status?: string;
          tutor_id?: string | null;
          meeting_url?: string | null;
          notes?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_sessions_class_group_id_fkey";
            columns: ["class_group_id"];
            isOneToOne: false;
            referencedRelation: "class_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_sessions_schedule_id_fkey";
            columns: ["schedule_id"];
            isOneToOne: false;
            referencedRelation: "class_schedules";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_sessions_tutor_id_fkey";
            columns: ["tutor_id"];
            isOneToOne: false;
            referencedRelation: "tutors";
            referencedColumns: ["id"];
          },
        ];
      };
      consent_types: {
        Row: {
          code: string;
          name: string;
          description: string;
          statute_ref: string;
          is_required: boolean;
          sort_order: number;
        };
        Insert: {
          code: string;
          name: string;
          description: string;
          statute_ref?: string;
          is_required?: boolean;
          sort_order: number;
        };
        Update: {
          code?: string;
          name?: string;
          description?: string;
          statute_ref?: string;
          is_required?: boolean;
          sort_order?: number;
        };
        Relationships: [];
      };
      consents: {
        Row: {
          id: string;
          consent_type_code: string;
          guardian_id: string;
          learner_id: string | null;
          granted: boolean;
          granted_at: string;
          withdrawn_at: string | null;
          policy_version: string;
        };
        Insert: {
          id?: string;
          consent_type_code: string;
          guardian_id: string;
          learner_id?: string | null;
          granted: boolean;
          granted_at?: string;
          withdrawn_at?: string | null;
          policy_version: string;
        };
        Update: {
          id?: string;
          consent_type_code?: string;
          guardian_id?: string;
          learner_id?: string | null;
          granted?: boolean;
          granted_at?: string;
          withdrawn_at?: string | null;
          policy_version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "consents_consent_type_code_fkey";
            columns: ["consent_type_code"];
            isOneToOne: false;
            referencedRelation: "consent_types";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "consents_guardian_id_fkey";
            columns: ["guardian_id"];
            isOneToOne: false;
            referencedRelation: "guardians";
            referencedColumns: ["profile_id"];
          },
          {
            foreignKeyName: "consents_learner_id_fkey";
            columns: ["learner_id"];
            isOneToOne: false;
            referencedRelation: "learners";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_enquiries: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          phone: string;
          topic: string;
          message: string;
          source: string;
          status: string;
          handled_by: string | null;
          handled_at: string | null;
          converted_learner_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          email?: string;
          phone?: string;
          topic?: string;
          message: string;
          source?: string;
          status?: string;
          handled_by?: string | null;
          handled_at?: string | null;
          converted_learner_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string;
          phone?: string;
          topic?: string;
          message?: string;
          source?: string;
          status?: string;
          handled_by?: string | null;
          handled_at?: string | null;
          converted_learner_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contact_enquiries_handled_by_fkey";
            columns: ["handled_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_enquiries_converted_learner_id_fkey";
            columns: ["converted_learner_id"];
            isOneToOne: false;
            referencedRelation: "learners";
            referencedColumns: ["id"];
          },
        ];
      };
      credit_note_allocations: {
        Row: {
          credit_note_id: string;
          invoice_id: string;
          amount_cents: number;
        };
        Insert: {
          credit_note_id: string;
          invoice_id: string;
          amount_cents: number;
        };
        Update: {
          credit_note_id?: string;
          invoice_id?: string;
          amount_cents?: number;
        };
        Relationships: [
          {
            foreignKeyName: "credit_note_allocations_credit_note_id_fkey";
            columns: ["credit_note_id"];
            isOneToOne: false;
            referencedRelation: "credit_notes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "credit_note_allocations_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
        ];
      };
      credit_notes: {
        Row: {
          id: string;
          billing_account_id: string;
          issued_on: string;
          amount_cents: number;
          reason: string;
          issued_by: string | null;
        };
        Insert: {
          id?: string;
          billing_account_id: string;
          issued_on?: string;
          amount_cents: number;
          reason: string;
          issued_by?: string | null;
        };
        Update: {
          id?: string;
          billing_account_id?: string;
          issued_on?: string;
          amount_cents?: number;
          reason?: string;
          issued_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "credit_notes_billing_account_id_fkey";
            columns: ["billing_account_id"];
            isOneToOne: false;
            referencedRelation: "billing_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "credit_notes_issued_by_fkey";
            columns: ["issued_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      data_retention_log: {
        Row: {
          id: string;
          record_class: string;
          subject_id: string;
          subject_label: string;
          action: string;
          performed_at: string;
          confirmed_by: string | null;
          note: string;
        };
        Insert: {
          id?: string;
          record_class: string;
          subject_id: string;
          subject_label?: string;
          action: string;
          performed_at?: string;
          confirmed_by?: string | null;
          note?: string;
        };
        Update: {
          id?: string;
          record_class?: string;
          subject_id?: string;
          subject_label?: string;
          action?: string;
          performed_at?: string;
          confirmed_by?: string | null;
          note?: string;
        };
        Relationships: [
          {
            foreignKeyName: "data_retention_log_record_class_fkey";
            columns: ["record_class"];
            isOneToOne: false;
            referencedRelation: "data_retention_policies";
            referencedColumns: ["record_class"];
          },
          {
            foreignKeyName: "data_retention_log_confirmed_by_fkey";
            columns: ["confirmed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      data_retention_policies: {
        Row: {
          record_class: string;
          description: string;
          retention_months: number;
          basis: string;
        };
        Insert: {
          record_class: string;
          description: string;
          retention_months: number;
          basis: string;
        };
        Update: {
          record_class?: string;
          description?: string;
          retention_months?: number;
          basis?: string;
        };
        Relationships: [];
      };
      enrolment_subjects: {
        Row: {
          enrolment_id: string;
          subject_code: string;
          preferred_language_code: string | null;
        };
        Insert: {
          enrolment_id: string;
          subject_code: string;
          preferred_language_code?: string | null;
        };
        Update: {
          enrolment_id?: string;
          subject_code?: string;
          preferred_language_code?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "enrolment_subjects_subject_code_fkey";
            columns: ["subject_code"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "enrolment_subjects_preferred_language_code_fkey";
            columns: ["preferred_language_code"];
            isOneToOne: false;
            referencedRelation: "languages";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "enrolment_subjects_enrolment_id_fkey";
            columns: ["enrolment_id"];
            isOneToOne: false;
            referencedRelation: "enrolments";
            referencedColumns: ["id"];
          },
        ];
      };
      enrolments: {
        Row: {
          id: string;
          learner_id: string;
          package_code: string;
          status: string;
          preferred_tutor_id: string | null;
          assigned_tutor_id: string | null;
          start_date: string | null;
          end_date: string | null;
          first_month_amount_cents: number | null;
          first_month_set_by: string | null;
          first_month_reason: string | null;
          source: string;
          created_at: string;
          activated_at: string | null;
        };
        Insert: {
          id?: string;
          learner_id: string;
          package_code: string;
          status?: string;
          preferred_tutor_id?: string | null;
          assigned_tutor_id?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          first_month_amount_cents?: number | null;
          first_month_set_by?: string | null;
          first_month_reason?: string | null;
          source?: string;
          created_at?: string;
          activated_at?: string | null;
        };
        Update: {
          id?: string;
          learner_id?: string;
          package_code?: string;
          status?: string;
          preferred_tutor_id?: string | null;
          assigned_tutor_id?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          first_month_amount_cents?: number | null;
          first_month_set_by?: string | null;
          first_month_reason?: string | null;
          source?: string;
          created_at?: string;
          activated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "enrolments_learner_id_fkey";
            columns: ["learner_id"];
            isOneToOne: false;
            referencedRelation: "learners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "enrolments_package_code_fkey";
            columns: ["package_code"];
            isOneToOne: false;
            referencedRelation: "packages";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "enrolments_preferred_tutor_id_fkey";
            columns: ["preferred_tutor_id"];
            isOneToOne: false;
            referencedRelation: "tutors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "enrolments_assigned_tutor_id_fkey";
            columns: ["assigned_tutor_id"];
            isOneToOne: false;
            referencedRelation: "tutors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "enrolments_first_month_set_by_fkey";
            columns: ["first_month_set_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      expense_categories: {
        Row: {
          code: string;
          name: string;
          budget_cents: number | null;
          sort_order: number;
        };
        Insert: {
          code: string;
          name: string;
          budget_cents?: number | null;
          sort_order: number;
        };
        Update: {
          code?: string;
          name?: string;
          budget_cents?: number | null;
          sort_order?: number;
        };
        Relationships: [];
      };
      expenses: {
        Row: {
          id: string;
          category_code: string;
          incurred_on: string;
          amount_cents: number;
          description: string;
          recorded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          category_code: string;
          incurred_on: string;
          amount_cents: number;
          description?: string;
          recorded_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          category_code?: string;
          incurred_on?: string;
          amount_cents?: number;
          description?: string;
          recorded_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_category_code_fkey";
            columns: ["category_code"];
            isOneToOne: false;
            referencedRelation: "expense_categories";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "expenses_recorded_by_fkey";
            columns: ["recorded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      grades: {
        Row: {
          code: string;
          name: string;
          phase_code: string;
          sort_order: number;
        };
        Insert: {
          code: string;
          name: string;
          phase_code: string;
          sort_order: number;
        };
        Update: {
          code?: string;
          name?: string;
          phase_code?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "grades_phase_code_fkey";
            columns: ["phase_code"];
            isOneToOne: false;
            referencedRelation: "school_phases";
            referencedColumns: ["code"];
          },
        ];
      };
      guardians: {
        Row: {
          profile_id: string;
          physical_address: string;
          postal_address: string;
          preferred_contact: string;
          created_at: string;
        };
        Insert: {
          profile_id: string;
          physical_address?: string;
          postal_address?: string;
          preferred_contact?: string;
          created_at?: string;
        };
        Update: {
          profile_id?: string;
          physical_address?: string;
          postal_address?: string;
          preferred_contact?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "guardians_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      invoice_lines: {
        Row: {
          id: string;
          invoice_id: string;
          line_type: string;
          description: string;
          enrolment_id: string | null;
          programme_enrolment_id: string | null;
          package_code: string | null;
          learner_id: string | null;
          quantity: number;
          unit_amount_cents: number;
          line_total_cents: number | null;
          period_month: string | null;
          late_fee_for_invoice_id: string | null;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          line_type: string;
          description: string;
          enrolment_id?: string | null;
          programme_enrolment_id?: string | null;
          package_code?: string | null;
          learner_id?: string | null;
          quantity?: number;
          unit_amount_cents: number;
          period_month?: string | null;
          late_fee_for_invoice_id?: string | null;
        };
        Update: {
          id?: string;
          invoice_id?: string;
          line_type?: string;
          description?: string;
          enrolment_id?: string | null;
          programme_enrolment_id?: string | null;
          package_code?: string | null;
          learner_id?: string | null;
          quantity?: number;
          unit_amount_cents?: number;
          period_month?: string | null;
          late_fee_for_invoice_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoice_lines_enrolment_id_fkey";
            columns: ["enrolment_id"];
            isOneToOne: false;
            referencedRelation: "enrolments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoice_lines_programme_enrolment_id_fkey";
            columns: ["programme_enrolment_id"];
            isOneToOne: false;
            referencedRelation: "programme_enrolments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoice_lines_package_code_fkey";
            columns: ["package_code"];
            isOneToOne: false;
            referencedRelation: "packages";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "invoice_lines_learner_id_fkey";
            columns: ["learner_id"];
            isOneToOne: false;
            referencedRelation: "learners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoice_lines_late_fee_for_invoice_id_fkey";
            columns: ["late_fee_for_invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
        ];
      };
      invoice_sequences: {
        Row: {
          year: number;
          last_number: number;
        };
        Insert: {
          year: number;
          last_number?: number;
        };
        Update: {
          year?: number;
          last_number?: number;
        };
        Relationships: [];
      };
      invoices: {
        Row: {
          id: string;
          billing_account_id: string;
          invoice_number: string;
          period_start: string | null;
          period_end: string | null;
          issued_on: string;
          due_on: string;
          status: string;
          notes: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          billing_account_id: string;
          invoice_number: string;
          period_start?: string | null;
          period_end?: string | null;
          issued_on?: string;
          due_on: string;
          status?: string;
          notes?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          billing_account_id?: string;
          invoice_number?: string;
          period_start?: string | null;
          period_end?: string | null;
          issued_on?: string;
          due_on?: string;
          status?: string;
          notes?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_billing_account_id_fkey";
            columns: ["billing_account_id"];
            isOneToOne: false;
            referencedRelation: "billing_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      languages: {
        Row: {
          code: string;
          name: string;
          sort_order: number;
        };
        Insert: {
          code: string;
          name: string;
          sort_order: number;
        };
        Update: {
          code?: string;
          name?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      learner_emergency_contacts: {
        Row: {
          id: string;
          learner_id: string;
          full_name: string;
          relationship: string;
          phone: string;
          priority: number;
        };
        Insert: {
          id?: string;
          learner_id: string;
          full_name: string;
          relationship: string;
          phone: string;
          priority: number;
        };
        Update: {
          id?: string;
          learner_id?: string;
          full_name?: string;
          relationship?: string;
          phone?: string;
          priority?: number;
        };
        Relationships: [
          {
            foreignKeyName: "learner_emergency_contacts_learner_id_fkey";
            columns: ["learner_id"];
            isOneToOne: false;
            referencedRelation: "learners";
            referencedColumns: ["id"];
          },
        ];
      };
      learner_guardians: {
        Row: {
          learner_id: string;
          guardian_id: string;
          relationship: string;
          is_primary: boolean;
          is_billing_contact: boolean;
        };
        Insert: {
          learner_id: string;
          guardian_id: string;
          relationship: string;
          is_primary?: boolean;
          is_billing_contact?: boolean;
        };
        Update: {
          learner_id?: string;
          guardian_id?: string;
          relationship?: string;
          is_primary?: boolean;
          is_billing_contact?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "learner_guardians_guardian_id_fkey";
            columns: ["guardian_id"];
            isOneToOne: false;
            referencedRelation: "guardians";
            referencedColumns: ["profile_id"];
          },
          {
            foreignKeyName: "learner_guardians_learner_id_fkey";
            columns: ["learner_id"];
            isOneToOne: false;
            referencedRelation: "learners";
            referencedColumns: ["id"];
          },
        ];
      };
      learner_medical_notes: {
        Row: {
          learner_id: string;
          allergies: string;
          conditions: string;
          medication: string;
          accommodations: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          learner_id: string;
          allergies?: string;
          conditions?: string;
          medication?: string;
          accommodations?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          learner_id?: string;
          allergies?: string;
          conditions?: string;
          medication?: string;
          accommodations?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "learner_medical_notes_learner_id_fkey";
            columns: ["learner_id"];
            isOneToOne: true;
            referencedRelation: "learners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "learner_medical_notes_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      learners: {
        Row: {
          id: string;
          profile_id: string | null;
          full_name: string;
          date_of_birth: string;
          grade_code: string;
          school_name: string;
          home_language_code: string | null;
          status: string;
          joined_on: string;
          left_on: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id?: string | null;
          full_name: string;
          date_of_birth: string;
          grade_code: string;
          school_name?: string;
          home_language_code?: string | null;
          status?: string;
          joined_on?: string;
          left_on?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string | null;
          full_name?: string;
          date_of_birth?: string;
          grade_code?: string;
          school_name?: string;
          home_language_code?: string | null;
          status?: string;
          joined_on?: string;
          left_on?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "learners_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "learners_grade_code_fkey";
            columns: ["grade_code"];
            isOneToOne: false;
            referencedRelation: "grades";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "learners_home_language_code_fkey";
            columns: ["home_language_code"];
            isOneToOne: false;
            referencedRelation: "languages";
            referencedColumns: ["code"];
          },
        ];
      };
      learning_plan_goals: {
        Row: {
          id: string;
          learning_plan_id: string;
          subject_code: string;
          goal: string;
          target_level_code: number | null;
          target_date: string | null;
          status: string;
          review_note: string;
        };
        Insert: {
          id?: string;
          learning_plan_id: string;
          subject_code: string;
          goal: string;
          target_level_code?: number | null;
          target_date?: string | null;
          status?: string;
          review_note?: string;
        };
        Update: {
          id?: string;
          learning_plan_id?: string;
          subject_code?: string;
          goal?: string;
          target_level_code?: number | null;
          target_date?: string | null;
          status?: string;
          review_note?: string;
        };
        Relationships: [
          {
            foreignKeyName: "learning_plan_goals_learning_plan_id_fkey";
            columns: ["learning_plan_id"];
            isOneToOne: false;
            referencedRelation: "learning_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "learning_plan_goals_subject_code_fkey";
            columns: ["subject_code"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "learning_plan_goals_target_level_code_fkey";
            columns: ["target_level_code"];
            isOneToOne: false;
            referencedRelation: "achievement_levels";
            referencedColumns: ["code"];
          },
        ];
      };
      learning_plans: {
        Row: {
          id: string;
          learner_id: string;
          from_assessment_id: string | null;
          term_id: string | null;
          status: string;
          created_by: string | null;
          created_at: string;
          activated_at: string | null;
        };
        Insert: {
          id?: string;
          learner_id: string;
          from_assessment_id?: string | null;
          term_id?: string | null;
          status?: string;
          created_by?: string | null;
          created_at?: string;
          activated_at?: string | null;
        };
        Update: {
          id?: string;
          learner_id?: string;
          from_assessment_id?: string | null;
          term_id?: string | null;
          status?: string;
          created_by?: string | null;
          created_at?: string;
          activated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "learning_plans_learner_id_fkey";
            columns: ["learner_id"];
            isOneToOne: false;
            referencedRelation: "learners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "learning_plans_from_assessment_id_fkey";
            columns: ["from_assessment_id"];
            isOneToOne: false;
            referencedRelation: "assessments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "learning_plans_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "terms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "learning_plans_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      message_reads: {
        Row: {
          message_id: string;
          profile_id: string;
          read_at: string;
        };
        Insert: {
          message_id: string;
          profile_id: string;
          read_at?: string;
        };
        Update: {
          message_id?: string;
          profile_id?: string;
          read_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "message_reads_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_reads_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      message_threads: {
        Row: {
          id: string;
          subject: string;
          learner_id: string | null;
          created_by: string | null;
          created_at: string;
          closed_at: string | null;
        };
        Insert: {
          id?: string;
          subject?: string;
          learner_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          closed_at?: string | null;
        };
        Update: {
          id?: string;
          subject?: string;
          learner_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          closed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "message_threads_learner_id_fkey";
            columns: ["learner_id"];
            isOneToOne: false;
            referencedRelation: "learners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_threads_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          id: string;
          thread_id: string;
          sender_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          thread_id: string;
          sender_id: string;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          thread_id?: string;
          sender_id?: string;
          body?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "message_threads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_recipients: {
        Row: {
          notification_id: string;
          profile_id: string;
          read_at: string | null;
        };
        Insert: {
          notification_id: string;
          profile_id: string;
          read_at?: string | null;
        };
        Update: {
          notification_id?: string;
          profile_id?: string;
          read_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "notification_recipients_notification_id_fkey";
            columns: ["notification_id"];
            isOneToOne: false;
            referencedRelation: "notifications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notification_recipients_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          title: string;
          body: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          body?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          body?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      package_prices: {
        Row: {
          id: string;
          package_code: string;
          amount_cents: number;
          effective_from: string;
          effective_to: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          package_code: string;
          amount_cents: number;
          effective_from: string;
          effective_to?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          package_code?: string;
          amount_cents?: number;
          effective_from?: string;
          effective_to?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "package_prices_package_code_fkey";
            columns: ["package_code"];
            isOneToOne: false;
            referencedRelation: "packages";
            referencedColumns: ["code"];
          },
        ];
      };
      packages: {
        Row: {
          code: string;
          name: string;
          description: string;
          service_type: string;
          billing_period: string;
          subject_allowance: number | null;
          is_active: boolean;
          sort_order: number;
        };
        Insert: {
          code: string;
          name: string;
          description?: string;
          service_type: string;
          billing_period: string;
          subject_allowance?: number | null;
          is_active?: boolean;
          sort_order: number;
        };
        Update: {
          code?: string;
          name?: string;
          description?: string;
          service_type?: string;
          billing_period?: string;
          subject_allowance?: number | null;
          is_active?: boolean;
          sort_order?: number;
        };
        Relationships: [];
      };
      payment_allocations: {
        Row: {
          payment_id: string;
          invoice_id: string;
          amount_cents: number;
        };
        Insert: {
          payment_id: string;
          invoice_id: string;
          amount_cents: number;
        };
        Update: {
          payment_id?: string;
          invoice_id?: string;
          amount_cents?: number;
        };
        Relationships: [
          {
            foreignKeyName: "payment_allocations_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_allocations_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          id: string;
          billing_account_id: string;
          paid_on: string;
          amount_cents: number;
          method: string;
          reference: string;
          recorded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          billing_account_id: string;
          paid_on?: string;
          amount_cents: number;
          method: string;
          reference?: string;
          recorded_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          billing_account_id?: string;
          paid_on?: string;
          amount_cents?: number;
          method?: string;
          reference?: string;
          recorded_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_billing_account_id_fkey";
            columns: ["billing_account_id"];
            isOneToOne: false;
            referencedRelation: "billing_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_recorded_by_fkey";
            columns: ["recorded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          phone: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          phone?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          phone?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      programme_attendance_records: {
        Row: {
          id: string;
          programme_session_id: string;
          learner_id: string;
          status: string;
          marked_by: string | null;
          marked_at: string;
          note: string;
        };
        Insert: {
          id?: string;
          programme_session_id: string;
          learner_id: string;
          status: string;
          marked_by?: string | null;
          marked_at?: string;
          note?: string;
        };
        Update: {
          id?: string;
          programme_session_id?: string;
          learner_id?: string;
          status?: string;
          marked_by?: string | null;
          marked_at?: string;
          note?: string;
        };
        Relationships: [
          {
            foreignKeyName: "programme_attendance_records_programme_session_id_fkey";
            columns: ["programme_session_id"];
            isOneToOne: false;
            referencedRelation: "programme_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "programme_attendance_records_learner_id_fkey";
            columns: ["learner_id"];
            isOneToOne: false;
            referencedRelation: "learners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "programme_attendance_records_marked_by_fkey";
            columns: ["marked_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      programme_enrolments: {
        Row: {
          id: string;
          programme_id: string;
          learner_id: string;
          status: string;
          booked_at: string;
        };
        Insert: {
          id?: string;
          programme_id: string;
          learner_id: string;
          status?: string;
          booked_at?: string;
        };
        Update: {
          id?: string;
          programme_id?: string;
          learner_id?: string;
          status?: string;
          booked_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "programme_enrolments_programme_id_fkey";
            columns: ["programme_id"];
            isOneToOne: false;
            referencedRelation: "programmes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "programme_enrolments_learner_id_fkey";
            columns: ["learner_id"];
            isOneToOne: false;
            referencedRelation: "learners";
            referencedColumns: ["id"];
          },
        ];
      };
      programme_sessions: {
        Row: {
          id: string;
          programme_id: string;
          session_date: string;
          starts_at: string;
          ends_at: string;
          tutor_id: string | null;
          status: string;
          meeting_url: string | null;
          notes: string;
        };
        Insert: {
          id?: string;
          programme_id: string;
          session_date: string;
          starts_at: string;
          ends_at: string;
          tutor_id?: string | null;
          status?: string;
          meeting_url?: string | null;
          notes?: string;
        };
        Update: {
          id?: string;
          programme_id?: string;
          session_date?: string;
          starts_at?: string;
          ends_at?: string;
          tutor_id?: string | null;
          status?: string;
          meeting_url?: string | null;
          notes?: string;
        };
        Relationships: [
          {
            foreignKeyName: "programme_sessions_programme_id_fkey";
            columns: ["programme_id"];
            isOneToOne: false;
            referencedRelation: "programmes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "programme_sessions_tutor_id_fkey";
            columns: ["tutor_id"];
            isOneToOne: false;
            referencedRelation: "tutors";
            referencedColumns: ["id"];
          },
        ];
      };
      programmes: {
        Row: {
          id: string;
          name: string;
          description: string;
          programme_type: string;
          starts_on: string;
          ends_on: string;
          capacity: number;
          price_cents: number;
          delivery_mode: string;
          room_id: string | null;
          is_published: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string;
          programme_type: string;
          starts_on: string;
          ends_on: string;
          capacity: number;
          price_cents: number;
          delivery_mode: string;
          room_id?: string | null;
          is_published?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          programme_type?: string;
          starts_on?: string;
          ends_on?: string;
          capacity?: number;
          price_cents?: number;
          delivery_mode?: string;
          room_id?: string | null;
          is_published?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "programmes_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      progress_report_subjects: {
        Row: {
          id: string;
          progress_report_id: string;
          subject_code: string;
          achievement_level_code: number | null;
          strengths: string;
          areas_for_improvement: string;
          recommended_intervention: string;
        };
        Insert: {
          id?: string;
          progress_report_id: string;
          subject_code: string;
          achievement_level_code?: number | null;
          strengths?: string;
          areas_for_improvement?: string;
          recommended_intervention?: string;
        };
        Update: {
          id?: string;
          progress_report_id?: string;
          subject_code?: string;
          achievement_level_code?: number | null;
          strengths?: string;
          areas_for_improvement?: string;
          recommended_intervention?: string;
        };
        Relationships: [
          {
            foreignKeyName: "progress_report_subjects_progress_report_id_fkey";
            columns: ["progress_report_id"];
            isOneToOne: false;
            referencedRelation: "progress_reports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "progress_report_subjects_subject_code_fkey";
            columns: ["subject_code"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "progress_report_subjects_achievement_level_code_fkey";
            columns: ["achievement_level_code"];
            isOneToOne: false;
            referencedRelation: "achievement_levels";
            referencedColumns: ["code"];
          },
        ];
      };
      progress_reports: {
        Row: {
          id: string;
          learner_id: string;
          term_id: string;
          tutor_id: string | null;
          summary: string;
          attendance_note: string;
          issued_on: string | null;
          published_at: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          learner_id: string;
          term_id: string;
          tutor_id?: string | null;
          summary?: string;
          attendance_note?: string;
          issued_on?: string | null;
          published_at?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          learner_id?: string;
          term_id?: string;
          tutor_id?: string | null;
          summary?: string;
          attendance_note?: string;
          issued_on?: string | null;
          published_at?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "progress_reports_learner_id_fkey";
            columns: ["learner_id"];
            isOneToOne: false;
            referencedRelation: "learners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "progress_reports_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "terms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "progress_reports_tutor_id_fkey";
            columns: ["tutor_id"];
            isOneToOne: false;
            referencedRelation: "tutors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "progress_reports_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      report_acknowledgements: {
        Row: {
          progress_report_id: string;
          guardian_id: string;
          acknowledged_at: string;
          comment: string;
        };
        Insert: {
          progress_report_id: string;
          guardian_id: string;
          acknowledged_at?: string;
          comment?: string;
        };
        Update: {
          progress_report_id?: string;
          guardian_id?: string;
          acknowledged_at?: string;
          comment?: string;
        };
        Relationships: [
          {
            foreignKeyName: "report_acknowledgements_progress_report_id_fkey";
            columns: ["progress_report_id"];
            isOneToOne: false;
            referencedRelation: "progress_reports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "report_acknowledgements_guardian_id_fkey";
            columns: ["guardian_id"];
            isOneToOne: false;
            referencedRelation: "guardians";
            referencedColumns: ["profile_id"];
          },
        ];
      };
      resource_audiences: {
        Row: {
          id: string;
          resource_id: string;
          audience_type: string;
          learner_id: string | null;
          class_group_id: string | null;
          grade_code: string | null;
        };
        Insert: {
          id?: string;
          resource_id: string;
          audience_type: string;
          learner_id?: string | null;
          class_group_id?: string | null;
          grade_code?: string | null;
        };
        Update: {
          id?: string;
          resource_id?: string;
          audience_type?: string;
          learner_id?: string | null;
          class_group_id?: string | null;
          grade_code?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "resource_audiences_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "resource_audiences_learner_id_fkey";
            columns: ["learner_id"];
            isOneToOne: false;
            referencedRelation: "learners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "resource_audiences_class_group_id_fkey";
            columns: ["class_group_id"];
            isOneToOne: false;
            referencedRelation: "class_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "resource_audiences_grade_code_fkey";
            columns: ["grade_code"];
            isOneToOne: false;
            referencedRelation: "grades";
            referencedColumns: ["code"];
          },
        ];
      };
      resources: {
        Row: {
          id: string;
          title: string;
          subject_code: string | null;
          url: string;
          storage_path: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          subject_code?: string | null;
          url?: string;
          storage_path?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          subject_code?: string | null;
          url?: string;
          storage_path?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "resources_subject_code_fkey";
            columns: ["subject_code"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "resources_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews: {
        Row: {
          id: string;
          tutor_id: string;
          guardian_id: string;
          learner_id: string | null;
          rating: number;
          comment: string;
          status: string;
          created_at: string;
          published_at: string | null;
          moderated_by: string | null;
        };
        Insert: {
          id?: string;
          tutor_id: string;
          guardian_id: string;
          learner_id?: string | null;
          rating: number;
          comment?: string;
          status?: string;
          created_at?: string;
          published_at?: string | null;
          moderated_by?: string | null;
        };
        Update: {
          id?: string;
          tutor_id?: string;
          guardian_id?: string;
          learner_id?: string | null;
          rating?: number;
          comment?: string;
          status?: string;
          created_at?: string;
          published_at?: string | null;
          moderated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_tutor_id_fkey";
            columns: ["tutor_id"];
            isOneToOne: false;
            referencedRelation: "tutors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_guardian_id_fkey";
            columns: ["guardian_id"];
            isOneToOne: false;
            referencedRelation: "guardians";
            referencedColumns: ["profile_id"];
          },
          {
            foreignKeyName: "reviews_learner_id_fkey";
            columns: ["learner_id"];
            isOneToOne: false;
            referencedRelation: "learners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_moderated_by_fkey";
            columns: ["moderated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      rooms: {
        Row: {
          id: string;
          name: string;
          capacity: number;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          name: string;
          capacity: number;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          name?: string;
          capacity?: number;
          is_active?: boolean;
        };
        Relationships: [];
      };
      school_phases: {
        Row: {
          code: string;
          name: string;
          sort_order: number;
        };
        Insert: {
          code: string;
          name: string;
          sort_order: number;
        };
        Update: {
          code?: string;
          name?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      session_check_ins: {
        Row: {
          id: string;
          class_session_id: string;
          learner_id: string;
          arrived_at: string;
          signed_in_by: string | null;
          departed_at: string | null;
          collected_by: string | null;
          signed_out_by: string | null;
          note: string;
        };
        Insert: {
          id?: string;
          class_session_id: string;
          learner_id: string;
          arrived_at?: string;
          signed_in_by?: string | null;
          departed_at?: string | null;
          collected_by?: string | null;
          signed_out_by?: string | null;
          note?: string;
        };
        Update: {
          id?: string;
          class_session_id?: string;
          learner_id?: string;
          arrived_at?: string;
          signed_in_by?: string | null;
          departed_at?: string | null;
          collected_by?: string | null;
          signed_out_by?: string | null;
          note?: string;
        };
        Relationships: [
          {
            foreignKeyName: "session_check_ins_class_session_id_fkey";
            columns: ["class_session_id"];
            isOneToOne: false;
            referencedRelation: "class_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "session_check_ins_learner_id_fkey";
            columns: ["learner_id"];
            isOneToOne: false;
            referencedRelation: "learners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "session_check_ins_signed_in_by_fkey";
            columns: ["signed_in_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "session_check_ins_collected_by_fkey";
            columns: ["collected_by"];
            isOneToOne: false;
            referencedRelation: "authorised_collectors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "session_check_ins_signed_out_by_fkey";
            columns: ["signed_out_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      subject_offerings: {
        Row: {
          subject_code: string;
          grade_code: string;
        };
        Insert: {
          subject_code: string;
          grade_code: string;
        };
        Update: {
          subject_code?: string;
          grade_code?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subject_offerings_subject_code_fkey";
            columns: ["subject_code"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "subject_offerings_grade_code_fkey";
            columns: ["grade_code"];
            isOneToOne: false;
            referencedRelation: "grades";
            referencedColumns: ["code"];
          },
        ];
      };
      subjects: {
        Row: {
          code: string;
          name: string;
          description: string;
          is_language: boolean;
          sort_order: number;
        };
        Insert: {
          code: string;
          name: string;
          description?: string;
          is_language?: boolean;
          sort_order: number;
        };
        Update: {
          code?: string;
          name?: string;
          description?: string;
          is_language?: boolean;
          sort_order?: number;
        };
        Relationships: [];
      };
      terms: {
        Row: {
          id: string;
          year: number;
          term_number: number;
          starts_on: string;
          ends_on: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          year: number;
          term_number: number;
          starts_on: string;
          ends_on: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          year?: number;
          term_number?: number;
          starts_on?: string;
          ends_on?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      thread_participants: {
        Row: {
          thread_id: string;
          profile_id: string;
          added_at: string;
        };
        Insert: {
          thread_id: string;
          profile_id: string;
          added_at?: string;
        };
        Update: {
          thread_id?: string;
          profile_id?: string;
          added_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "thread_participants_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "message_threads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "thread_participants_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      tutor_competencies: {
        Row: {
          id: string;
          tutor_id: string;
          subject_code: string;
          grade_code: string;
        };
        Insert: {
          id?: string;
          tutor_id: string;
          subject_code: string;
          grade_code: string;
        };
        Update: {
          id?: string;
          tutor_id?: string;
          subject_code?: string;
          grade_code?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tutor_competencies_tutor_id_fkey";
            columns: ["tutor_id"];
            isOneToOne: false;
            referencedRelation: "tutors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tutor_competencies_subject_code_grade_code_fkey";
            columns: ["subject_code", "grade_code"];
            isOneToOne: false;
            referencedRelation: "subject_offerings";
            referencedColumns: ["subject_code", "grade_code"];
          },
          {
            foreignKeyName: "tutor_competencies_subject_code_fkey";
            columns: ["subject_code"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "tutor_competencies_grade_code_fkey";
            columns: ["grade_code"];
            isOneToOne: false;
            referencedRelation: "grades";
            referencedColumns: ["code"];
          },
        ];
      };
      tutor_competency_media: {
        Row: {
          competency_id: string;
          language_code: string;
        };
        Insert: {
          competency_id: string;
          language_code: string;
        };
        Update: {
          competency_id?: string;
          language_code?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tutor_competency_media_competency_id_fkey";
            columns: ["competency_id"];
            isOneToOne: false;
            referencedRelation: "tutor_competencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tutor_competency_media_language_code_fkey";
            columns: ["language_code"];
            isOneToOne: false;
            referencedRelation: "languages";
            referencedColumns: ["code"];
          },
        ];
      };
      tutor_documents: {
        Row: {
          id: string;
          tutor_id: string;
          doc_type: string;
          storage_path: string;
          uploaded_at: string;
          verified_at: string | null;
          verified_by: string | null;
        };
        Insert: {
          id?: string;
          tutor_id: string;
          doc_type: string;
          storage_path: string;
          uploaded_at?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          id?: string;
          tutor_id?: string;
          doc_type?: string;
          storage_path?: string;
          uploaded_at?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tutor_documents_tutor_id_fkey";
            columns: ["tutor_id"];
            isOneToOne: false;
            referencedRelation: "tutors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tutor_documents_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      tutor_pay_rates: {
        Row: {
          id: string;
          tutor_id: string;
          pay_basis: string;
          amount_cents: number;
          effective_from: string;
          effective_to: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tutor_id: string;
          pay_basis: string;
          amount_cents: number;
          effective_from: string;
          effective_to?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tutor_id?: string;
          pay_basis?: string;
          amount_cents?: number;
          effective_from?: string;
          effective_to?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tutor_pay_rates_tutor_id_fkey";
            columns: ["tutor_id"];
            isOneToOne: false;
            referencedRelation: "tutors";
            referencedColumns: ["id"];
          },
        ];
      };
      tutor_qualifications: {
        Row: {
          id: string;
          tutor_id: string;
          qualification_type: string;
          title: string;
          institution: string;
          year_awarded: number | null;
          verified_at: string | null;
          verified_by: string | null;
        };
        Insert: {
          id?: string;
          tutor_id: string;
          qualification_type: string;
          title: string;
          institution?: string;
          year_awarded?: number | null;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          id?: string;
          tutor_id?: string;
          qualification_type?: string;
          title?: string;
          institution?: string;
          year_awarded?: number | null;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tutor_qualifications_tutor_id_fkey";
            columns: ["tutor_id"];
            isOneToOne: false;
            referencedRelation: "tutors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tutor_qualifications_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      tutor_references: {
        Row: {
          id: string;
          tutor_id: string;
          full_name: string;
          relationship: string;
          phone: string;
          email: string;
          checked_at: string | null;
          checked_by: string | null;
          outcome: string | null;
        };
        Insert: {
          id?: string;
          tutor_id: string;
          full_name: string;
          relationship: string;
          phone?: string;
          email?: string;
          checked_at?: string | null;
          checked_by?: string | null;
          outcome?: string | null;
        };
        Update: {
          id?: string;
          tutor_id?: string;
          full_name?: string;
          relationship?: string;
          phone?: string;
          email?: string;
          checked_at?: string | null;
          checked_by?: string | null;
          outcome?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tutor_references_tutor_id_fkey";
            columns: ["tutor_id"];
            isOneToOne: false;
            referencedRelation: "tutors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tutor_references_checked_by_fkey";
            columns: ["checked_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      tutor_spoken_languages: {
        Row: {
          tutor_id: string;
          language_code: string;
        };
        Insert: {
          tutor_id: string;
          language_code: string;
        };
        Update: {
          tutor_id?: string;
          language_code?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tutor_spoken_languages_tutor_id_fkey";
            columns: ["tutor_id"];
            isOneToOne: false;
            referencedRelation: "tutors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tutor_spoken_languages_language_code_fkey";
            columns: ["language_code"];
            isOneToOne: false;
            referencedRelation: "languages";
            referencedColumns: ["code"];
          },
        ];
      };
      tutors: {
        Row: {
          id: string;
          profile_id: string;
          slug: string;
          headline: string;
          bio: string;
          employment_type: string;
          status: string;
          photo_url: string | null;
          started_on: string;
          ended_on: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          slug: string;
          headline?: string;
          bio?: string;
          employment_type: string;
          status?: string;
          photo_url?: string | null;
          started_on?: string;
          ended_on?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          slug?: string;
          headline?: string;
          bio?: string;
          employment_type?: string;
          status?: string;
          photo_url?: string | null;
          started_on?: string;
          ended_on?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tutors_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          user_id: string;
          role: Database["public"]["Enums"]["app_role"];
          granted_at: string;
        };
        Insert: {
          user_id: string;
          role: Database["public"]["Enums"]["app_role"];
          granted_at?: string;
        };
        Update: {
          user_id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          granted_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      tutor_rating_summary: {
        Row: {
          tutor_id: string | null;
          review_count: number | null;
          rating: number | null;
        };
        Relationships: [];
      };
      v_account_statement: {
        Row: {
          billing_account_id: string | null;
          guardian_id: string | null;
          entry_type: string | null;
          reference: string | null;
          entry_date: string | null;
          debit_cents: number | null;
          credit_cents: number | null;
        };
        Relationships: [];
      };
      v_assessment_improvement: {
        Row: {
          learner_id: string | null;
          domain_code: string | null;
          initial_pct: number | null;
          latest_pct: number | null;
          change_pct: number | null;
        };
        Relationships: [];
      };
      v_attendance: {
        Row: {
          learner_id: string | null;
          session_date: string | null;
          status: string | null;
          context: string | null;
        };
        Relationships: [];
      };
      v_attendance_rate: {
        Row: {
          month: string | null;
          sessions_recorded: number | null;
          attended: number | null;
          attendance_rate_pct: number | null;
        };
        Relationships: [];
      };
      v_break_even: {
        Row: {
          month: string | null;
          expense_cents: number | null;
          avg_cents_per_learner: number | null;
          learners_needed_to_break_even: number | null;
          active_learners: number | null;
        };
        Relationships: [];
      };
      v_enquiry_funnel: {
        Row: {
          month: string | null;
          source: string | null;
          enquiries: number | null;
          converted: number | null;
          conversion_pct: number | null;
        };
        Relationships: [];
      };
      v_invoice_status: {
        Row: {
          id: string | null;
          billing_account_id: string | null;
          invoice_number: string | null;
          issued_on: string | null;
          due_on: string | null;
          status: string | null;
          total_cents: number | null;
          settled_cents: number | null;
          balance_cents: number | null;
          payment_state: string | null;
          days_overdue: number | null;
        };
        Relationships: [];
      };
      v_learner_counts: {
        Row: {
          month: string | null;
          active_learners: number | null;
          new_learners: number | null;
          departed_learners: number | null;
        };
        Relationships: [];
      };
      v_learner_retention: {
        Row: {
          month: string | null;
          active_learners: number | null;
          new_learners: number | null;
          departed_learners: number | null;
          retention_pct: number | null;
        };
        Relationships: [];
      };
      v_monthly_expenses: {
        Row: {
          month: string | null;
          expense_cents: number | null;
        };
        Relationships: [];
      };
      v_monthly_revenue: {
        Row: {
          month: string | null;
          invoiced_cents: number | null;
          collected_cents: number | null;
        };
        Relationships: [];
      };
      v_my_threads: {
        Row: {
          id: string | null;
          subject: string | null;
          learner_id: string | null;
          learner_name: string | null;
          created_at: string | null;
          last_message_at: string | null;
          last_message: string | null;
          unread_count: number | null;
        };
        Relationships: [];
      };
      v_operating_surplus: {
        Row: {
          month: string | null;
          invoiced_cents: number | null;
          collected_cents: number | null;
          expense_cents: number | null;
          surplus_cents: number | null;
        };
        Relationships: [];
      };
      v_outstanding_fees: {
        Row: {
          billing_account_id: string | null;
          guardian_id: string | null;
          guardian_name: string | null;
          open_invoices: number | null;
          outstanding_cents: number | null;
          max_days_overdue: number | null;
        };
        Relationships: [];
      };
      v_public_timetable: {
        Row: {
          class_group_id: string | null;
          class_name: string | null;
          subject: string | null;
          language: string | null;
          delivery_mode: string | null;
          capacity: number | null;
          day_of_week: number | null;
          starts_at_time: string | null;
          ends_at_time: string | null;
          tutor_slug: string | null;
          tutor_name: string | null;
        };
        Relationships: [];
      };
      v_retention_due: {
        Row: {
          record_class: string | null;
          subject_id: string | null;
          subject_label: string | null;
          left_on: string | null;
          retention_months: number | null;
          due_on: string | null;
        };
        Relationships: [];
      };
      v_revenue_per_learner: {
        Row: {
          month: string | null;
          learners_billed: number | null;
          invoiced_cents: number | null;
          avg_cents_per_learner: number | null;
        };
        Relationships: [];
      };
      v_tutor_session_load: {
        Row: {
          tutor_id: string | null;
          month: string | null;
          sessions: number | null;
          hours: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      activate_enrolment: { Args: Record<string, unknown>; Returns: unknown };
      apply_late_fees: { Args: Record<string, unknown>; Returns: unknown };
      create_learning_plan: { Args: Record<string, unknown>; Returns: unknown };
      create_tutor: { Args: Record<string, unknown>; Returns: unknown };
      generate_class_sessions: { Args: Record<string, unknown>; Returns: unknown };
      has_required_consents: { Args: Record<string, unknown>; Returns: unknown };
      invoice_late_fee_due: { Args: Record<string, unknown>; Returns: unknown };
      mark_thread_read: { Args: Record<string, unknown>; Returns: unknown };
      package_price_on: { Args: Record<string, unknown>; Returns: unknown };
      record_assessment: { Args: Record<string, unknown>; Returns: unknown };
      record_payment: { Args: Record<string, unknown>; Returns: unknown };
      run_monthly_invoices: { Args: Record<string, unknown>; Returns: unknown };
      save_progress_report: { Args: Record<string, unknown>; Returns: unknown };
      set_tutor_competency: { Args: Record<string, unknown>; Returns: unknown };
      set_tutor_pay_rate: { Args: Record<string, unknown>; Returns: unknown };
      start_thread: { Args: Record<string, unknown>; Returns: unknown };
      submit_enrolment: { Args: Record<string, unknown>; Returns: unknown };
    };
    Enums: {
      app_role: "parent" | "learner" | "tutor" | "admin";
    };
    CompositeTypes: Record<string, never>;
  };
};

/* Helpers. Prefer these over the aliases below - they can never be wrong
   about pluralisation, and they fail to compile on a renamed table. */
export type Row<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type Insert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type Update<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
export type ViewRow<T extends keyof Database["public"]["Views"]> =
  Database["public"]["Views"][T]["Row"];

/* Row aliases, named after the table. Plural, deliberately: guessing a
   singular form breaks on words like "expenses" and "addresses". */
export type AppRole = "parent" | "learner" | "tutor" | "admin";

export type AchievementLevels = Database["public"]["Tables"]["achievement_levels"]["Row"];
export type AssessmentDomains = Database["public"]["Tables"]["assessment_domains"]["Row"];
export type AssessmentScores = Database["public"]["Tables"]["assessment_scores"]["Row"];
export type AssessmentTypes = Database["public"]["Tables"]["assessment_types"]["Row"];
export type Assessments = Database["public"]["Tables"]["assessments"]["Row"];
export type AttendanceRecords = Database["public"]["Tables"]["attendance_records"]["Row"];
export type AuthorisedCollectors = Database["public"]["Tables"]["authorised_collectors"]["Row"];
export type BillingAccounts = Database["public"]["Tables"]["billing_accounts"]["Row"];
export type BillingSettings = Database["public"]["Tables"]["billing_settings"]["Row"];
export type CentreOperatingHours = Database["public"]["Tables"]["centre_operating_hours"]["Row"];
export type ClassEnrolments = Database["public"]["Tables"]["class_enrolments"]["Row"];
export type ClassGroupGrades = Database["public"]["Tables"]["class_group_grades"]["Row"];
export type ClassGroups = Database["public"]["Tables"]["class_groups"]["Row"];
export type ClassSchedules = Database["public"]["Tables"]["class_schedules"]["Row"];
export type ClassSessions = Database["public"]["Tables"]["class_sessions"]["Row"];
export type ConsentTypes = Database["public"]["Tables"]["consent_types"]["Row"];
export type Consents = Database["public"]["Tables"]["consents"]["Row"];
export type ContactEnquiries = Database["public"]["Tables"]["contact_enquiries"]["Row"];
export type CreditNoteAllocations = Database["public"]["Tables"]["credit_note_allocations"]["Row"];
export type CreditNotes = Database["public"]["Tables"]["credit_notes"]["Row"];
export type DataRetentionLog = Database["public"]["Tables"]["data_retention_log"]["Row"];
export type DataRetentionPolicies = Database["public"]["Tables"]["data_retention_policies"]["Row"];
export type EnrolmentSubjects = Database["public"]["Tables"]["enrolment_subjects"]["Row"];
export type Enrolments = Database["public"]["Tables"]["enrolments"]["Row"];
export type ExpenseCategories = Database["public"]["Tables"]["expense_categories"]["Row"];
export type Expenses = Database["public"]["Tables"]["expenses"]["Row"];
export type Grades = Database["public"]["Tables"]["grades"]["Row"];
export type Guardians = Database["public"]["Tables"]["guardians"]["Row"];
export type InvoiceLines = Database["public"]["Tables"]["invoice_lines"]["Row"];
export type InvoiceSequences = Database["public"]["Tables"]["invoice_sequences"]["Row"];
export type Invoices = Database["public"]["Tables"]["invoices"]["Row"];
export type Languages = Database["public"]["Tables"]["languages"]["Row"];
export type LearnerEmergencyContacts = Database["public"]["Tables"]["learner_emergency_contacts"]["Row"];
export type LearnerGuardians = Database["public"]["Tables"]["learner_guardians"]["Row"];
export type LearnerMedicalNotes = Database["public"]["Tables"]["learner_medical_notes"]["Row"];
export type Learners = Database["public"]["Tables"]["learners"]["Row"];
export type LearningPlanGoals = Database["public"]["Tables"]["learning_plan_goals"]["Row"];
export type LearningPlans = Database["public"]["Tables"]["learning_plans"]["Row"];
export type MessageReads = Database["public"]["Tables"]["message_reads"]["Row"];
export type MessageThreads = Database["public"]["Tables"]["message_threads"]["Row"];
export type Messages = Database["public"]["Tables"]["messages"]["Row"];
export type NotificationRecipients = Database["public"]["Tables"]["notification_recipients"]["Row"];
export type Notifications = Database["public"]["Tables"]["notifications"]["Row"];
export type PackagePrices = Database["public"]["Tables"]["package_prices"]["Row"];
export type Packages = Database["public"]["Tables"]["packages"]["Row"];
export type PaymentAllocations = Database["public"]["Tables"]["payment_allocations"]["Row"];
export type Payments = Database["public"]["Tables"]["payments"]["Row"];
export type Profiles = Database["public"]["Tables"]["profiles"]["Row"];
export type ProgrammeAttendanceRecords = Database["public"]["Tables"]["programme_attendance_records"]["Row"];
export type ProgrammeEnrolments = Database["public"]["Tables"]["programme_enrolments"]["Row"];
export type ProgrammeSessions = Database["public"]["Tables"]["programme_sessions"]["Row"];
export type Programmes = Database["public"]["Tables"]["programmes"]["Row"];
export type ProgressReportSubjects = Database["public"]["Tables"]["progress_report_subjects"]["Row"];
export type ProgressReports = Database["public"]["Tables"]["progress_reports"]["Row"];
export type ReportAcknowledgements = Database["public"]["Tables"]["report_acknowledgements"]["Row"];
export type ResourceAudiences = Database["public"]["Tables"]["resource_audiences"]["Row"];
export type Resources = Database["public"]["Tables"]["resources"]["Row"];
export type Reviews = Database["public"]["Tables"]["reviews"]["Row"];
export type Rooms = Database["public"]["Tables"]["rooms"]["Row"];
export type SchoolPhases = Database["public"]["Tables"]["school_phases"]["Row"];
export type SessionCheckIns = Database["public"]["Tables"]["session_check_ins"]["Row"];
export type SubjectOfferings = Database["public"]["Tables"]["subject_offerings"]["Row"];
export type Subjects = Database["public"]["Tables"]["subjects"]["Row"];
export type Terms = Database["public"]["Tables"]["terms"]["Row"];
export type ThreadParticipants = Database["public"]["Tables"]["thread_participants"]["Row"];
export type TutorCompetencies = Database["public"]["Tables"]["tutor_competencies"]["Row"];
export type TutorCompetencyMedia = Database["public"]["Tables"]["tutor_competency_media"]["Row"];
export type TutorDocuments = Database["public"]["Tables"]["tutor_documents"]["Row"];
export type TutorPayRates = Database["public"]["Tables"]["tutor_pay_rates"]["Row"];
export type TutorQualifications = Database["public"]["Tables"]["tutor_qualifications"]["Row"];
export type TutorReferences = Database["public"]["Tables"]["tutor_references"]["Row"];
export type TutorSpokenLanguages = Database["public"]["Tables"]["tutor_spoken_languages"]["Row"];
export type Tutors = Database["public"]["Tables"]["tutors"]["Row"];
export type UserRoles = Database["public"]["Tables"]["user_roles"]["Row"];
export type TutorRatingSummary = Database["public"]["Views"]["tutor_rating_summary"]["Row"];
export type VAccountStatement = Database["public"]["Views"]["v_account_statement"]["Row"];
export type VAssessmentImprovement = Database["public"]["Views"]["v_assessment_improvement"]["Row"];
export type VAttendance = Database["public"]["Views"]["v_attendance"]["Row"];
export type VAttendanceRate = Database["public"]["Views"]["v_attendance_rate"]["Row"];
export type VBreakEven = Database["public"]["Views"]["v_break_even"]["Row"];
export type VEnquiryFunnel = Database["public"]["Views"]["v_enquiry_funnel"]["Row"];
export type VInvoiceStatus = Database["public"]["Views"]["v_invoice_status"]["Row"];
export type VLearnerCounts = Database["public"]["Views"]["v_learner_counts"]["Row"];
export type VLearnerRetention = Database["public"]["Views"]["v_learner_retention"]["Row"];
export type VMonthlyExpenses = Database["public"]["Views"]["v_monthly_expenses"]["Row"];
export type VMonthlyRevenue = Database["public"]["Views"]["v_monthly_revenue"]["Row"];
export type VMyThreads = Database["public"]["Views"]["v_my_threads"]["Row"];
export type VOperatingSurplus = Database["public"]["Views"]["v_operating_surplus"]["Row"];
export type VOutstandingFees = Database["public"]["Views"]["v_outstanding_fees"]["Row"];
export type VPublicTimetable = Database["public"]["Views"]["v_public_timetable"]["Row"];
export type VRetentionDue = Database["public"]["Views"]["v_retention_due"]["Row"];
export type VRevenuePerLearner = Database["public"]["Views"]["v_revenue_per_learner"]["Row"];
export type VTutorSessionLoad = Database["public"]["Views"]["v_tutor_session_load"]["Row"];
