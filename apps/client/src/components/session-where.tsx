import { DELIVERY_MODE_LABEL, meetingPlatform } from "@skolopals/shared/format";

/** Where a session happens: the room, the online meeting link, or both for hybrid. */
export function SessionWhere({
  mode,
  room,
  meetingUrl,
}: {
  mode: string | undefined;
  room: string | null | undefined;
  meetingUrl: string | null | undefined;
}) {
  const place = room ?? DELIVERY_MODE_LABEL.in_centre;
  if (mode !== "online" && mode !== "hybrid") return <>{place}</>;

  const join = meetingUrl ? (
    <a href={meetingUrl} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
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
