export interface TutorRow {
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
  created_at: Date;
}

/** From `public.tutor_rating_summary` (a view, `security_invoker = true`). `rating` is `numeric` — `pg` returns it as a string, never auto-parsed to a JS number. */
export interface TutorRatingRow {
  tutor_id: string;
  review_count: string;
  rating: string;
}
