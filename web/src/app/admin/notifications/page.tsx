import { DataTable, EmptyState, PageHeading } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { dateTime } from "@/lib/format";

export const metadata = { title: "Announcements" };

export default async function AnnouncementsPage() {
  const supabase = await createClient();
  const { data: notifications } = await supabase
    .from("notifications")
    .select("*, notification_recipients(profile_id, read_at)")
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = notifications ?? [];

  return (
    <>
      <PageHeading
        title="Announcements"
        description="Messages sent to parents, learners or staff. Read state is tracked per recipient."
      />
      {rows.length === 0 ? (
        <EmptyState title="Nothing sent yet" description="Announcements you send to families appear here." />
      ) : (
        <DataTable
          rows={rows}
          rowKey={(n) => n.id}
          columns={[
            { header: "Title", cell: (n) => n.title, primary: true },
            { header: "Sent", cell: (n) => dateTime(n.created_at) },
            { header: "Recipients", cell: (n) => String(n.notification_recipients?.length ?? 0) },
            {
              header: "Read",
              cell: (n) => String((n.notification_recipients ?? []).filter((r) => r.read_at).length),
            },
          ]}
        />
      )}
    </>
  );
}
