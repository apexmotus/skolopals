import type { Metadata } from "next";
import { ButtonLink, Card, CardTitle, PageHeading } from "@skolopals/ui/ui";
import { EnrolForm, type Quote } from "./enrol-form";
import { getSession } from "@skolopals/shared/auth";
import { api } from "@skolopals/shared/api";
import { getGrades, getLanguages, getPackages, getSubjects, searchTutors } from "@/lib/queries";
import { money } from "@skolopals/shared/format";

export const metadata: Metadata = { title: "Enrol a learner" };

type ConsentType = { code: string; name: string; description: string; isRequired: boolean };

export default async function EnrolPage({ searchParams }: PageProps<"/enrol">) {
  const sp = await searchParams;
  const tutorSlug = Array.isArray(sp.tutor) ? sp.tutor[0] : sp.tutor;

  const [session, packages, grades, subjects, languages, tutors, consentTypes] = await Promise.all([
    getSession(),
    getPackages(),
    getGrades(),
    getSubjects(),
    getLanguages(),
    searchTutors(),
    api.public.get<ConsentType[]>("/reference/consent-types", "reference"),
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

  // Enrolment records a guardian's consent for a child (POPIA s35), so only a parent account
  // may submit one. Flag anyone else up front rather than after they have filled in the form.
  if (!session.roles.includes("parent")) {
    return (
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-5 px-4 py-6 md:px-[24px]">
        <PageHeading title="Enrol a learner" description={`Signed in as ${session.profile.full_name}.`} />
        <Card className="max-w-[640px] border-danger">
          <CardTitle>Only a parent or guardian can enrol a learner</CardTitle>
          <p className="text-[14px] leading-[1.6] text-muted">
            Your account is not a parent or guardian account, so you cannot complete this form. An
            enrolment records a parent’s or guardian’s permission to process their child’s information,
            and the law requires that permission to come from them.
          </p>
          <p className="text-[14px] leading-[1.6] text-muted">
            Ask the parent or guardian to create their own account and enrol their child. Their request
            then appears in the admin enrolment queue for approval.
          </p>
          <div className="flex flex-wrap gap-[10px]">
            <ButtonLink href="/">Back to the home page</ButtonLink>
          </div>
        </Card>
      </div>
    );
  }

  // Only tutors the centre could actually assign are offered as a preference.
  const preferred = tutorSlug ? tutors.find((t) => t.slug === tutorSlug)?.id : undefined;

  // The review step's estimate: what acceptance today would cost, from the same SQL as the invoice.
  const quotes = Object.fromEntries(
    await Promise.all(
      monthly.map(async (p) => {
        const quote = await api
          .get<Quote>(`/enrolments/quote?packageCode=${encodeURIComponent(p.code)}`)
          .catch(() => null);
        return [p.code, quote] as const;
      }),
    ).then((entries) => entries.filter((e): e is readonly [string, Quote] => e[1] !== null)),
  );
  const currentYear = Number(new Date().toLocaleDateString("en-ZA", { year: "numeric", timeZone: "Africa/Johannesburg" }));

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-5 px-4 py-6 md:px-[24px]">
      <PageHeading
        title="Enrol a learner"
        description={`Signed in as ${session.profile.full_name}. Nothing is paid now: once the centre accepts the application you pay a once-off registration fee of ${money(registration)} and the rest of that month’s tuition.`}
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
          media={languages.filter((l) => l.isInstructionMedium).map((l) => ({ code: l.code, name: l.name }))}
          tutors={tutors.map((t) => ({ id: t.id, fullName: t.fullName }))}
          consentTypes={consentTypes}
          defaultTutor={preferred}
          me={{ fullName: session.profile.full_name, phone: session.profile.phone ?? "" }}
          quotes={quotes}
          currentYear={currentYear}
        />
      </div>
    </div>
  );
}
