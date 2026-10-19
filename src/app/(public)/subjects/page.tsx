import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeading } from "@/components/ui";
import { SUBJECTS } from "@/lib/queries";

export const metadata: Metadata = { title: "Subjects" };

export default function SubjectsPage() {
  return (
    <div className="flex flex-col gap-5 p-4 md:p-7">
      <PageHeading title="Explore subjects" description="Verified tutors for every subject and stage." />
      <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2 lg:grid-cols-3">
        {SUBJECTS.map((s) => (
          <Link key={s} href={`/tutors?subject=${encodeURIComponent(s)}`}>
            <Card className="h-full hover:border-brand">
              <p className="text-[15px] font-bold text-ink">{s}</p>
              <p className="text-[12px] text-muted">Find a {s.toLowerCase()} tutor →</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
