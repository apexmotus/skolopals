// Mirrors the Supabase schema in supabase/migrations.
// Regenerate with: npx supabase gen types typescript --project-id dhmjzshlznhqohvkdcpz

export type UserRole = "student" | "tutor" | "admin";
export type TutorStatus = "pending" | "approved" | "declined" | "more_info" | "suspended";
export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled";
export type PaymentStatus = "pending" | "paid" | "declined" | "refunded";

export type Profile = {
  id: string;
  role: UserRole;
  full_name: string;
  grade_level: string | null;
  created_at: string;
};

export type Tutor = {
  id: string;
  profile_id: string | null;
  slug: string;
  full_name: string;
  headline: string;
  bio: string;
  qualifications: string;
  subjects: string[];
  topics: string[];
  grades: string;
  languages: string[];
  hourly_rate_cents: number;
  rating: number;
  review_count: number;
  photo_url: string | null;
  status: TutorStatus;
  created_at: string;
};

export type AvailabilitySlot = {
  id: string;
  tutor_id: string;
  starts_at: string;
  is_booked: boolean;
};

export type TutorApplication = {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  subjects: string;
  grades: string;
  qualifications: string;
  experience: string;
  documents: string[];
  status: TutorStatus;
  admin_notes: string | null;
  submitted_at: string;
  reviewed_at: string | null;
};

export type Booking = {
  id: string;
  student_id: string;
  tutor_id: string;
  slot_id: string | null;
  subject: string;
  learning_goal: string;
  starts_at: string;
  duration_minutes: number;
  format: string;
  price_cents: number;
  status: BookingStatus;
  created_at: string;
};

export type Payment = {
  id: string;
  booking_id: string;
  amount_cents: number;
  platform_fee_cents: number | null;
  tutor_payout_cents: number | null;
  status: PaymentStatus;
  card_last4: string | null;
  created_at: string;
};

export type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export type Review = {
  id: string;
  tutor_id: string;
  student_id: string | null;
  booking_id: string | null;
  author_name: string;
  rating: number;
  comment: string;
  created_at: string;
};

export type ProgressReport = {
  id: string;
  student_id: string;
  tutor_id: string;
  subject: string;
  score_label: string;
  trend: string;
  summary: string;
  created_at: string;
};

export type Resource = {
  id: string;
  tutor_id: string | null;
  student_id: string | null;
  title: string;
  subject: string;
  url: string;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string | null;
  audience: UserRole | null;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export type ContactMessage = {
  id: string;
  name: string;
  email: string;
  topic: string;
  message: string;
  created_at: string;
};

type Rel<Name extends string, Col extends string, Ref extends string, OneToOne extends boolean = false> = {
  foreignKeyName: Name;
  columns: [Col];
  isOneToOne: OneToOne;
  referencedRelation: Ref;
  referencedColumns: ["id"];
};

type Table<Row, Required extends keyof Row = never, Rels extends unknown[] = []> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
  Relationships: Rels;
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile, "id">;
      tutors: Table<Tutor, "slug" | "full_name" | "hourly_rate_cents", [Rel<"tutors_profile_id_fkey", "profile_id", "profiles", true>]>;
      availability_slots: Table<AvailabilitySlot, "tutor_id" | "starts_at", [Rel<"availability_slots_tutor_id_fkey", "tutor_id", "tutors">]>;
      tutor_applications: Table<TutorApplication, "full_name" | "email" | "subjects">;
      bookings: Table<
        Booking,
        "student_id" | "tutor_id" | "subject" | "starts_at" | "price_cents",
        [
          Rel<"bookings_slot_id_fkey", "slot_id", "availability_slots">,
          Rel<"bookings_student_id_fkey", "student_id", "profiles">,
          Rel<"bookings_tutor_id_fkey", "tutor_id", "tutors">,
        ]
      >;
      payments: Table<Payment, "booking_id" | "amount_cents", [Rel<"payments_booking_id_fkey", "booking_id", "bookings">]>;
      messages: Table<
        Message,
        "sender_id" | "recipient_id" | "body",
        [Rel<"messages_recipient_id_fkey", "recipient_id", "profiles">, Rel<"messages_sender_id_fkey", "sender_id", "profiles">]
      >;
      reviews: Table<
        Review,
        "tutor_id" | "author_name" | "rating",
        [
          Rel<"reviews_booking_id_fkey", "booking_id", "bookings", true>,
          Rel<"reviews_student_id_fkey", "student_id", "profiles">,
          Rel<"reviews_tutor_id_fkey", "tutor_id", "tutors">,
        ]
      >;
      progress_reports: Table<
        ProgressReport,
        "student_id" | "tutor_id" | "subject" | "score_label",
        [Rel<"progress_reports_student_id_fkey", "student_id", "profiles">, Rel<"progress_reports_tutor_id_fkey", "tutor_id", "tutors">]
      >;
      resources: Table<
        Resource,
        "title",
        [Rel<"resources_student_id_fkey", "student_id", "profiles">, Rel<"resources_tutor_id_fkey", "tutor_id", "tutors">]
      >;
      notifications: Table<Notification, "title", [Rel<"notifications_user_id_fkey", "user_id", "profiles">]>;
      contact_messages: Table<ContactMessage, "name" | "email" | "message">;
    };
    Views: { [_ in never]: never };
    Functions: {
      book_lesson: {
        Args: {
          p_slot_id: string;
          p_subject: string;
          p_learning_goal: string;
          p_duration_minutes: number;
          p_card_last4: string;
        };
        Returns: { booking_id: string; payment_status: PaymentStatus }[];
      };
      cancel_booking: { Args: { p_booking_id: string }; Returns: undefined };
      review_application: {
        Args: { p_application_id: string; p_decision: TutorStatus; p_notes: string };
        Returns: undefined;
      };
    };
    Enums: {
      user_role: UserRole;
      tutor_status: TutorStatus;
      booking_status: BookingStatus;
      payment_status: PaymentStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
