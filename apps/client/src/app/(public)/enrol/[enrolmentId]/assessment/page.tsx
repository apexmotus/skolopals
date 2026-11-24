import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ButtonLink, Card, CardTitle, PageHeading } from "@skolopals/ui/ui";
import { api, ApiError } from "@skolopals/shared/api";
import { getSession } from "@skolopals/shared/auth";
import { firstName } from "@skolopals/shared/format";
import { createClient } from "@skolopals/shared/supabase/server";
import { AssessmentRunner, ApplicationSent } from "./assessment-runner";
import { nextQuestion } from "./actions";

export const metadata: Metadata = { title: "Aptitude test" };

/** Grade R to 3: the bank notes a grown-up may need to read the questions aloud. */
const YOUNG_GRADES = new Set(["grade_r", "grade_1", "grade_2", "grade_3"]);

/**
 * The adaptive aptitude test that ends an application (SPEC §4.1 step 7,
 * §4.3). Reached straight after submitting the enrolment form, or later from
 * the parent portal. Leaving part-way is fine: every answer is saved, and
 * coming back resumes at the next question.
 */
export default async function AssessmentPage({ params }: PageProps<"/enrol/[enrolmentId]/assessment">) {
  const { enrolmentId } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/enrol/${enrolmentId}/assessment`)}`);

  // RLS returns nothing for another family's application, which becomes a 404.
  const supabase = await createClient();
  const { data: enrolment } = await supabase
    .from("enrolments")
    .select("id, status, learners(full_name, grade_code)")
    .eq("id", enrolmentId)
    .maybeSingle();
  if (!enrolment) notFound();

  const name = enrolment.learners?.full_name ?? "your child";

  let attempt: { attemptId: string; status: string };
  try {
    attempt = await api.post("/aptitude/attempts", { enrolmentId });
  } catch (err) {
    return (
      <Shell>
        <PageHeading title="Aptitude test" />
        <Card className="max-w-[640px]">
          <CardTitle>The test is not available</CardTitle>
          <p className="text-[13px] leading-[1.6] text-ink">
            {err instanceof ApiError && err.status < 500
              ? err.message
              : "We could not reach the centre. Please try again in a moment."}
          </p>
          <ButtonLink href="/parent" className="w-fit">
            Go to your portal
          </ButtonLink>
        </Card>
      </Shell>
    );
  }

  if (attempt.status === "completed") {
    return (
      <Shell>
        <ApplicationSent name={name} />
      </Shell>
    );
  }

  // Fetching here, not on Start, lets the intro say "carry on from question 8" on a return visit.
  const first = await nextQuestion(attempt.attemptId);

  return (
    <Shell>
      <AssessmentRunner
        attemptId={attempt.attemptId}
        childName={firstName(name)}
        fullName={name}
        young={YOUNG_GRADES.has(enrolment.learners?.grade_code ?? "")}
        first={first}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5 p-4 md:p-7">{children}</div>;
}
