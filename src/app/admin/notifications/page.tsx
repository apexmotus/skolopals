import type { Metadata } from "next";
import Link from "next/link";
import { DataTable, PageHeading } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { relativeDay } from "@/lib/format";

export const metadata: Metadata = { title: "Notifications" };

type Item = { id: string; type: string; detail: string; at: string; href?: string };

export default async function AdminNotificationsPage() {
  const supabase = await createClient();
  const [apps, contacts, cancels] = await Promise.all([
    supabase.from("tutor_applications").select("id, full_name, status, submitted_at").order("submitted_at", { ascending: false }).limit(10),
    supabase.from("contact_messages").select("*").order("created_at", { ascending: false }).limit(10),
    supabase.from("bookings").select("id, subject, created_at, starts_at").eq("status", "cancelled").order("created_at", { ascending: false }).limit(10),
  ]);

  const items: Item[] = [
    ...(apps.data ?? []).map((a) => ({
      id: `a-${a.id}`,
      type: "Application",
      detail: `${a.full_name} applied to teach`,
      at: a.submitted_at,
      href: `/admin/applications/${a.id}`,
    })),
    ...(contacts.data ?? []).map((c) => ({
      id: `c-${c.id}`,
      type: "Support",
      detail: `${c.topic || "Message"} from ${c.name} (${c.email}): ${c.message.slice(0, 80)}`,
      at: c.created_at,
    })),
    ...(cancels.data ?? []).map((b) => ({ id: `b-${b.id}`, type: "Cancellation", detail: `${b.subject} lesson cancelled`, at: b.created_at })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <>
      <PageHeading title="Notifications" description="Applications, support messages and cancellations." />
      <DataTable
        rows={items}
        rowKey={(i) => i.id}
        empty="All caught up."
        columns={[
          { header: "Type", primary: true, cell: (i) => i.type },
          {
            header: "Detail",
            cell: (i) =>
              i.href ? (
                <Link href={i.href} className="hover:text-brand hover:underline">
                  {i.detail}
                </Link>
              ) : (
                i.detail
              ),
          },
          { header: "When", cell: (i) => relativeDay(i.at) },
        ]}
      />
    </>
  );
}
