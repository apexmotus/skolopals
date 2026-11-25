import { redirect } from "next/navigation";
import { Card, CardTitle, EmptyState, PageHeading } from "@skolopals/ui/ui";
import { getSession } from "@skolopals/shared/auth";
import { createClient } from "@skolopals/shared/supabase/server";
import { dateTime, time } from "@skolopals/shared/format";
import { JoinForm } from "./join-form";

export const metadata = { title: "Join a class" };

/**
 * The family's way into an online or hybrid class. Opening it records nothing; pressing Join
 * records the click (for the tutor's register) and then opens the meeting.
 */
export default async function JoinPage({ params }: PageProps<"/join/[sessionId]">) {
  const { sessionId } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/join/${sessionId}`)}`);

  const supabase = await createClient();
  const { data: classSession } = await supabase
    .from("class_sessions")
    .select("id, starts_at, ends_at, status, class_group_id, class_groups(name, delivery_mode)")
    .eq("id", sessionId)
    .maybeSingle();

  // RLS shows a parent their own children's placements and a learner their own.
  const { data: placed } = classSession
    ? await supabase
        .from("class_enrolments")
        .select("learner_id, learners(full_name)")
        .eq("class_group_id", classSession.class_group_id)
        .is("left_on", null)
    : { data: [] };
  const learners = (placed ?? []).map((p) => ({ id: p.learner_id, name: p.learners?.full_name ?? "Learner" }));

  if (!classSession || learners.length === 0) {
    return (
      <EmptyState
        title="This class isn’t one of yours"
        description="Open the join link from your timetable, signed in as the learner’s parent or the learner."
      />
    );
  }

  const name = classSession.class_groups?.name ?? "Class";
  return (
    <>
      <PageHeading title={`Join ${name}`} description={dateTime(classSession.starts_at)} />
      <Card>
        <CardTitle>Ready to join?</CardTitle>
        <p className="text-[13px] leading-[1.6] text-ink">
          The link opens 15 minutes before the class starts ({time(classSession.starts_at)}) and closes when it ends (
          {time(classSession.ends_at)}). Joining lets the tutor see you&rsquo;re there; they confirm the register at the
          end of the class.
        </p>
        <JoinForm sessionId={classSession.id} learners={learners} />
      </Card>
    </>
  );
}
