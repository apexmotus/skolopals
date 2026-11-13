import type { Metadata } from "next";
import { ButtonLink, Card, CardTitle, PageHeading } from "@skolopals/ui/ui";
import { EnrolForm } from "./enrol-form";
import { getSession } from "@skolopals/shared/auth";
import { api } from "@skolopals/shared/api";
import { getGrades, getLanguages, getPackages, getSubjects, searchTutors } from "@/lib/queries";
import { money } from "@skolopals/shared/format";

export const metadata: Metadata = { title: "Enrol a learner" };

type ConsentType = { code: string; name: string; description: string; isRequired: boolean };

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

  const monthly = packages.filter((p) => p.billingPeriod === "monthly");
  const registration = packages.find((p) => p.code === "registration")?.amountCents ?? 15000;

  if (!session) {
    return (
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-5 px-4 py-6 md:px-[24px]">
        <PageHeading
          title="Enrol a learner"
          description="Register once as a parent or guardian, then add each of your children."
        />
        <Card className="max-w-[640px]">
          <CardTitle>Create an account to continue</CardTitle>
          <p className="text-[14px] leading-[1.6] text-muted">
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

  const consentTypes = await api.get<ConsentType[]>("/reference/consent-types");

  // Only tutors the centre could actually assign are offered as a preference.
  const preferred = tutorSlug ? tutors.find((t) => t.slug === tutorSlug)?.id : undefined;

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-5 px-4 py-6 md:px-[24px]">
      <PageHeading
        title="Enrol a learner"
        description={`Signed in as ${session.profile.full_name}. A once-off registration fee of ${money(registration)} applies when the place is confirmed.`}
      />
      <div className="max-w-[760px]">
        <EnrolForm
          packages={monthly.map((p) => ({
            code: p.code,
            name: p.name,
            subjectAllowance: p.subjectAllowance,
            amountCents: p.amountCents,
          }))}
          grades={grades.map((g) => ({ code: g.code, name: g.name }))}
          subjects={subjects.map((s) => ({ code: s.code, name: s.name }))}
          languages={languages.map((l) => ({ code: l.code, name: l.name }))}
          tutors={tutors.map((t) => ({ id: t.id, fullName: t.fullName }))}
          consentTypes={consentTypes}
          defaultTutor={preferred}
        />
      </div>
    </div>
  );
}
