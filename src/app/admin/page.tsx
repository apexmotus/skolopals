import type { Metadata } from "next";
import Link from "next/link";
import { DataTable, PageHeading, StatCard } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { TUTOR_STATUS_LABEL, money, shortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Admin dashboard" };

export default async function AdminDashboard() {
  const supabase = await createClient();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const [tutors, pending, bookings, payments, recent] = await Promise.all([
    supabase.from("tutors").select("id", { count: "exact", head: true }).eq("status", "approved"),
    supabase.from("tutor_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("bookings").select("id", { count: "exact", head: true }).gte("created_at", monthStart).neq("status", "cancelled"),
    supabase.from("payments").select("platform_fee_cents").eq("status", "paid").gte("created_at", monthStart),
    supabase.from("tutor_applications").select("*").order("submitted_at", { ascending: false }).limit(3),
  ]);
  const revenue = (payments.data ?? []).reduce((s, p) => s + (p.platform_fee_cents ?? 0), 0);

  return (
    <>
      <PageHeading title="Admin dashboard" description="Marketplace health, applications and revenue." />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-start">
        <StatCard label="Active tutors" value={tutors.count ?? 0} />
        <StatCard label="Pending" value={pending.count ?? 0} hint="Applications to review" />
        <StatCard label="Bookings this month" value={bookings.count ?? 0} />
        <StatCard label="Platform revenue" value={money(revenue)} />
      </div>
      <DataTable
        rows={recent.data ?? []}
        rowKey={(a) => a.id}
        empty="No applications yet."
        columns={[
          {
            header: "Applicant",
            primary: true,
            cell: (a) => (
              <Link href={`/admin/applications/${a.id}`} className="hover:text-brand hover:underline">
                {a.full_name}
              </Link>
            ),
          },
          { header: "Subjects", cell: (a) => a.subjects },
          { header: "Submitted", cell: (a) => shortDate(a.submitted_at) },
          { header: "Status", cell: (a) => TUTOR_STATUS_LABEL[a.status] },
        ]}
      />
    </>
  );
}
