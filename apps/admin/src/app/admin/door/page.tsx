import Link from "next/link";
import { Badge, Card, CardTitle, EmptyState, PageHeading } from "@skolopals/ui/ui";
import { DoorPanel } from "@skolopals/ui/door";
import { checkLatePickups, getDoorSession, getStillAtCentre } from "@skolopals/shared/door";
import { createClient } from "@skolopals/shared/supabase/server";
import { nowMs, time, todayAtCentre } from "@skolopals/shared/format";
import { doorSignIn, doorSignOut, doorUndo } from "./actions";

export const metadata = { title: "At the door" };

export default async function DoorPage({ searchParams }: PageProps<"/admin/door">) {
  const sp = await searchParams;
  const chosen = Array.isArray(sp.session) ? sp.session[0] : sp.session;
  const today = todayAtCentre();
  await checkLatePickups().catch(() => undefined);

  const supabase = await createClient();
  const [{ data: sessions }, stillHere] = await Promise.all([
    supabase
      .from("class_sessions")
      .select("id, starts_at, ends_at, class_groups!inner(name, delivery_mode)")
      .eq("session_date", today)
      .neq("status", "cancelled")
      .eq("class_groups.delivery_mode", "in_centre")
      .order("starts_at"),
    getStillAtCentre(today),
  ]);

  const list = sessions ?? [];
  // Open the class happening now, else the next one, else the last of the day.
  const now = nowMs();
  const current =
    list.find((s) => new Date(s.starts_at).getTime() <= now && now <= new Date(s.ends_at).getTime()) ??
    list.find((s) => new Date(s.starts_at).getTime() > now) ??
    list[list.length - 1];
  const selected = (chosen && list.find((s) => s.id === chosen)) || current;
  const door = selected ? await getDoorSession(selected.id) : null;

  return (
    <>
      <PageHeading
        title="At the door"
        description="Today’s classes at the centre. Sign learners in when they arrive and out to the person collecting them."
      />

      <Card>
        <CardTitle>Still at the centre</CardTitle>
        {stillHere.length === 0 ? (
          <p className="text-[13px] text-muted">Nobody is signed in right now.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {stillHere.map((s) => {
              const overdue = s.endsAt ? now - new Date(s.endsAt).getTime() : 0;
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-ink">
                  <span>
                    {s.learner} <span className="text-muted">· {s.className}</span>
                  </span>
                  {overdue > 30 * 60_000 ? (
                    <Badge tone="danger">Class ended {s.endsAt ? time(s.endsAt) : ""}: not collected</Badge>
                  ) : overdue > 0 ? (
                    <Badge tone="warning">Class ended {s.endsAt ? time(s.endsAt) : ""}</Badge>
                  ) : (
                    <Badge tone="neutral">In class</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {list.length === 0 ? (
        <EmptyState title="No classes at the centre today" description="Online classes don’t use the door." />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {list.map((s) => (
              <Link
                key={s.id}
                href={`?session=${s.id}`}
                className={`rounded-full border px-3 py-[6px] text-[12px] ${
                  s.id === selected?.id ? "border-brand bg-canvas text-ink" : "border-line text-muted hover:text-ink"
                }`}
              >
                {time(s.starts_at)} · {s.class_groups?.name}
              </Link>
            ))}
          </div>
          {door ? (
            <Card>
              <CardTitle>
                {door.session.className} · {time(door.session.startsAt)}–{time(door.session.endsAt)}
              </CardTitle>
              <DoorPanel
                sessionId={door.session.id}
                learners={door.learners}
                actions={{ signIn: doorSignIn, signOut: doorSignOut, undo: doorUndo }}
              />
            </Card>
          ) : null}
        </>
      )}
    </>
  );
}
