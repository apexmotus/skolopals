import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getTutorBySlug } from "@/lib/queries";

export const DURATIONS = [30, 45, 60, 90] as const;

export function priceFor(hourlyCents: number, minutes: number) {
  return Math.round((hourlyCents * minutes) / 60);
}

/** Tutor + chosen open slot for a booking step, or null if either is gone. */
export async function loadBookingContext(slug: string, slotId: string | undefined) {
  const tutor = await getTutorBySlug(slug);
  if (!tutor) return null;
  if (!slotId) return { tutor, slot: null };
  const supabase = await createClient();
  const { data: slot } = await supabase
    .from("availability_slots")
    .select("*")
    .eq("id", slotId)
    .eq("tutor_id", tutor.id)
    .eq("is_booked", false)
    .gt("starts_at", new Date().toISOString())
    .maybeSingle();
  return { tutor, slot };
}

export function parseDuration(v: unknown) {
  const n = Number(v);
  return (DURATIONS as readonly number[]).includes(n) ? n : 60;
}
