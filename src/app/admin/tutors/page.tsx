import type { Metadata } from "next";
import Link from "next/link";
import { Badge, DataTable, PageHeading } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { TUTOR_STATUS_LABEL, hourlyRate } from "@/lib/format";

export const metadata: Metadata = { title: "Tutor accounts" };

export default async function TutorAccountsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("tutors").select("*").order("full_name");

  return (
    <>
      <PageHeading title="Tutor accounts" />
      <DataTable
        rows={data ?? []}
        rowKey={(t) => t.id}
        columns={[
          {
            header: "Tutor",
            primary: true,
            cell: (t) => (
              <Link href={`/admin/tutors/${t.id}`} className="hover:text-brand hover:underline">
                {t.full_name}
              </Link>
            ),
          },
          { header: "Subjects", cell: (t) => t.subjects.join(", ") },
          { header: "Rate · rating", cell: (t) => `${hourlyRate(t.hourly_rate_cents)} · ★ ${Number(t.rating).toFixed(1)}` },
          {
            header: "Status",
            cell: (t) => <Badge tone={t.status === "approved" ? "success" : t.status === "suspended" ? "danger" : "neutral"}>{TUTOR_STATUS_LABEL[t.status]}</Badge>,
          },
        ]}
      />
    </>
  );
}
