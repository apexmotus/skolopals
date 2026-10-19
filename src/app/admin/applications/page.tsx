import type { Metadata } from "next";
import Link from "next/link";
import { DataTable, Input, PageHeading, Select, buttonClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { TUTOR_STATUS_LABEL, shortDate } from "@/lib/format";
import type { TutorStatus } from "@/lib/database.types";

export const metadata: Metadata = { title: "Tutor applications" };

const STATUSES: TutorStatus[] = ["pending", "more_info", "approved", "declined"];

export default async function ApplicationsPage({ searchParams }: PageProps<"/admin/applications">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.replace(/[,()%*\\]/g, " ").trim() : "";
  const status = typeof sp.status === "string" && STATUSES.includes(sp.status as TutorStatus) ? (sp.status as TutorStatus) : "";
  const subject = typeof sp.subject === "string" ? sp.subject.replace(/[,()%*\\]/g, " ").trim() : "";

  const supabase = await createClient();
  let query = supabase.from("tutor_applications").select("*").order("submitted_at", { ascending: false }).limit(100);
  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
  if (status) query = query.eq("status", status);
  if (subject) query = query.ilike("subjects", `%${subject}%`);
  const { data } = await query;

  return (
    <>
      <PageHeading title="Tutor applications" description="Review new tutors before their profiles go live." />
      <form className="flex flex-col gap-[10px] md:flex-row md:items-end">
        <div className="flex flex-1 flex-col gap-[6px]">
          <label htmlFor="q" className="text-[11px] text-ink">
            Search
          </label>
          <Input id="q" name="q" placeholder="Search name or email" defaultValue={q} />
        </div>
        <div className="flex flex-1 flex-col gap-[6px]">
          <label htmlFor="status" className="text-[11px] text-ink">
            Status
          </label>
          <Select id="status" name="status" defaultValue={status}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {TUTOR_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-1 flex-col gap-[6px]">
          <label htmlFor="subject" className="text-[11px] text-ink">
            Subject
          </label>
          <Input id="subject" name="subject" placeholder="Any subject" defaultValue={subject} />
        </div>
        <button className={buttonClass("primary")}>Filter</button>
      </form>
      <DataTable
        rows={data ?? []}
        rowKey={(a) => a.id}
        empty="No applications match."
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
