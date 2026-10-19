import type { Metadata } from "next";
import { DataTable, PageHeading } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { shortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Resources" };

export default async function ResourcesPage() {
  const supabase = await createClient();
  const { data: resources } = await supabase
    .from("resources")
    .select("*, tutors(full_name)")
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeading title="Resources" description="Worksheets, notes and links shared by your tutors." />
      <DataTable
        rows={resources ?? []}
        rowKey={(r) => r.id}
        empty="Your tutors haven’t shared any resources yet."
        columns={[
          {
            header: "Resource",
            primary: true,
            cell: (r) =>
              r.url ? (
                <a href={r.url} target="_blank" rel="noreferrer" className="hover:text-brand hover:underline">
                  {r.title}
                </a>
              ) : (
                r.title
              ),
          },
          { header: "Subject", cell: (r) => r.subject || "—" },
          { header: "Shared by", cell: (r) => r.tutors?.full_name ?? "Skolopals" },
          { header: "Added", cell: (r) => shortDate(r.created_at) },
        ]}
      />
    </>
  );
}
