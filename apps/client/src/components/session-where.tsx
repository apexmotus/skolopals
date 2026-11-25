import { DELIVERY_MODE_LABEL, meetingPlatform } from "@skolopals/shared/format";

/** Where a session happens: the room, the online meeting link, or both for hybrid. */
export function SessionWhere({
  mode,
  room,
  meetingUrl,
  joinHref,
}: {
  mode: string | undefined;
  room: string | null | undefined;
  meetingUrl: string | null | undefined;
  /** For families: Skolopals' own join link, which records who joined before opening the meeting. */
  joinHref?: string;
}) {
  const place = room ?? DELIVERY_MODE_LABEL.in_centre;
  if (mode !== "online" && mode !== "hybrid") return <>{place}</>;

  const join = meetingUrl ? (
    <a
      href={joinHref ?? meetingUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent hover:underline"
    >
      Join on {meetingPlatform(meetingUrl)}
    </a>
  ) : (
    <span>{DELIVERY_MODE_LABEL.online} (link to follow)</span>
  );

  return mode === "hybrid" ? (
    <span>
      {place} or {join}
    </span>
  ) : (
    join
  );
}
