import type { Metadata } from "next";
import { ButtonLink, Card, CardTitle, PageHeading } from "@/components/ui";
import { EnrolForm } from "./enrol-form";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getGrades, getLanguages, getPackages, getSubjects, searchTutors } from "@/lib/queries";
import { money } from "@/lib/format";

export const metadata: Metadata = { title: "Enrol a learner" };

export default async function EnrolPage({ searchParams }: PageProps<"/enrol">) {
  const sp = await searchParams;
  const tutorSlug = Array.isArray(sp.tutor) ? sp.tutor[0] : sp.tutor;

  const [session, packages, grades, subjects, languages, tutors] = await Promise.all([
    getSession(),
    getPackages(),
    getGrades(),
    getSubjects(),
    getLanguages(),
    searchTutors(),
  ]);

  const monthly = packages.filter((p) => p.billing_period === "monthly");
  const registration = packages.find((p) => p.code === "registration")?.amount_cents ?? 15000;

  if (!session) {
    return (
      <div className="flex flex-col gap-5 p-4 md:p-7">
        <PageHeading
          title="Enrol a learner"
          description="Register once as a parent or guardian, then add each of your children."
        />
        <Card className="max-w-[640px]">
          <CardTitle>Create an account to continue</CardTitle>
          <p className="text-[13px] leading-[1.6] text-black">
            We ask you to sign in first because an enrolment records your child’s personal information,
            and the law requires us to know who is giving permission for it.
          </p>
          <div className="flex flex-wrap gap-[10px]">
            <ButtonLink href="/signup">Create an account</ButtonLink>
            <ButtonLink href="/login?next=/enrol" variant="secondary">
              I already have one
            </ButtonLink>
          </div>
        </Card>
      </div>
    );
  }

  // Only tutors the centre could actually assign are offered as a preference.
  const supabase = await createClient();
  const { data: consentTypes } = await supabase
    .from("consent_types")
    .select("code, name, description, is_required")
    .order("sort_order");

  const preferred = tutorSlug ? tutors.find((t) => t.slug === tutorSlug)?.id : undefined;

  return (
    <div className="flex flex-col gap-5 p-4 md:p-7">
      <PageHeading
        title="Enrol a learner"
        description={`Signed in as ${session.profile.full_name}. A once-off registration fee of ${money(registration)} applies when the place is confirmed.`}
      />
      <div className="max-w-[760px]">
        <EnrolForm
          packages={monthly.map((p) => ({
            code: p.code,
            name: p.name,
            subject_allowance: p.subject_allowance,
            amount_cents: p.amount_cents,
          }))}
          grades={grades.map((g) => ({ code: g.code, name: g.name }))}
          subjects={subjects.map((s) => ({ code: s.code, name: s.name }))}
          languages={languages.map((l) => ({ code: l.code, name: l.name }))}
          tutors={tutors.map((t) => ({ id: t.id, full_name: t.full_name }))}
          consentTypes={consentTypes ?? []}
          defaultTutor={preferred}
        />
      </div>
    </div>
  );
}
