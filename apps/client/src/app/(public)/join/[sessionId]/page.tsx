import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Card, CardTitle, EmptyState, PageHeading } from "@skolopals/ui/ui";
import { getSession } from "@skolopals/shared/auth";
import { createClient } from "@skolopals/shared/supabase/server";
import { dateTime, nowMs, time } from "@skolopals/shared/format";
import { JoinForm } from "./join-form";

export const metadata = { title: "Join a class" };

const JOIN_OPENS_MINUTES = 15;

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
      <Shell>
        <EmptyState
          title="This class isn’t one of yours"
          description="Open the join link from your timetable, signed in as the learner’s parent or the learner."
        />
      </Shell>
    );
  }

  const name = classSession.class_groups?.name ?? "Class";
  // Same window as public.join_session, which enforces it.
  const now = nowMs();
  const opensAt = new Date(classSession.starts_at).getTime() - JOIN_OPENS_MINUTES * 60_000;
  const state =
    classSession.status === "cancelled"
      ? "cancelled"
      : now > new Date(classSession.ends_at).getTime()
        ? "ended"
        : now < opensAt
          ? "early"
          : "open";

  return (
    <Shell>
      <PageHeading title={`Join ${name}`} description={dateTime(classSession.starts_at)} />
      <Card>
        <CardTitle>
          {state === "open"
            ? "Ready to join?"
            : state === "early"
              ? "Not open yet"
              : state === "ended"
                ? "This class has ended"
                : "This class was cancelled"}
        </CardTitle>
        <p className="text-[13px] leading-[1.6] text-ink">
          {state === "early"
            ? `Come back from ${dateTime(new Date(opensAt).toISOString())}. `
            : state === "cancelled"
              ? "The centre cancelled this session. Check your notifications for the reason. "
              : ""}
          The link opens {JOIN_OPENS_MINUTES} minutes before the class starts ({time(classSession.starts_at)}) and closes
          when it ends ({time(classSession.ends_at)}). Joining lets the tutor see you&rsquo;re there; they confirm the
          register at the end of the class.
        </p>
        {state === "open" ? <JoinForm sessionId={classSession.id} learners={learners} /> : null}
      </Card>
    </Shell>
  );
}

/** The public pages' gutter, so the card doesn't touch the edge of a phone screen. */
function Shell({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5 px-4 py-6 md:px-[24px]">{children}</div>;
}
