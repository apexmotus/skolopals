import type { Metadata } from "next";
import { ButtonLink, Card, CardTitle, PageHeading } from "@skolopals/ui/ui";
import { clientHomeFor, getSession } from "@skolopals/shared/auth";
import { api } from "@skolopals/shared/api";
import { longDate, shortDate } from "@skolopals/shared/format";
import { createClient } from "@skolopals/shared/supabase/server";
import { getGrades, getLanguages, getSubjects, type SubjectOffering } from "@/lib/queries";
import {
  getMyTutorApplication,
  getRecruitmentStatusNow,
  SA_PROVINCES,
  type MyTutorApplication,
} from "@/lib/tutor-applications";
import { ApplyForm } from "./apply-form";
import { ApplicationStatusCard } from "./status-card";

export const metadata: Metadata = { title: "Apply to teach" };

const LIVE = new Set<MyTutorApplication["status"]>(["submitted", "shortlisted"]);

function Shell({ description, children }: { description?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-5 px-4 py-6 md:px-[24px]">
      <PageHeading title="Apply to teach" description={description} />
      <div className="flex max-w-[760px] flex-col gap-5">{children}</div>
    </div>
  );
}

/**
 * One page, several states (SPEC-2026-11-tutor-applications.md §3.2): closed,
 * signed out, already staff, already applied, or the form. The status is read
 * uncached here: the form must never open after the admin has closed it.
 */
export default async function TeachPage() {
  const [status, session] = await Promise.all([getRecruitmentStatusNow(), getSession()]);

  if (session && (session.roles.includes("tutor") || session.roles.includes("admin") || session.roles.includes("superadmin"))) {
    return (
      <Shell>
        <Card>
          <CardTitle>You already work with us</CardTitle>
          <p className="text-[14px] leading-[1.6] text-muted">Your account is already a staff account, so there’s nothing to apply for.</p>
          <ButtonLink href={clientHomeFor(session.roles)} className="w-fit">
            Go to your portal
          </ButtonLink>
        </Card>
      </Shell>
    );
  }

  const mine = session ? await getMyTutorApplication() : null;
  // An application still being decided shows whatever round it came from; a
  // decided one only while its own round is open (a new round means a new chance).
  const showMine = mine && (LIVE.has(mine.status) || mine.roundId === status.roundId);
  if (mine && showMine) {
    return (
      <Shell>
        <ApplicationStatusCard
          applicationId={mine.id}
          status={mine.status}
          submittedOn={longDate(mine.submittedAt)}
          clearanceRequested={!!mine.policeClearanceRequestedAt && !mine.hasPoliceClearance && LIVE.has(mine.status)}
          clearanceNote={mine.policeClearanceRequestNote}
        />
      </Shell>
    );
  }

  if (!status.isOpen) {
    return (
      <Shell>
        <Card>
          <CardTitle>We’re not taking tutor applications right now</CardTitle>
          <p className="text-[14px] leading-[1.6] text-muted">
            When the centre is recruiting, an Apply to teach button appears on the home page.
          </p>
          <ButtonLink href="/" variant="secondary" className="w-fit">
            Back to the home page
          </ButtonLink>
        </Card>
      </Shell>
    );
  }

  const intro = status.message || "Teach small groups of learners in Damonsville, after school and on Saturday mornings.";
  const closes = status.closesAt ? `Applications close ${shortDate(status.closesAt)}.` : undefined;

  if (!session) {
    return (
      <Shell description={closes}>
        <Card>
          <CardTitle>We’re looking for tutors</CardTitle>
          <p className="whitespace-pre-wrap text-[14px] leading-[1.6] text-ink">{intro}</p>
          {status.needs && status.needs.length > 0 ? (
            <p className="text-[14px] text-ink">
              <span className="font-semibold">Most needed:</span> {status.needs.map((n) => n.name).join(", ")}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 text-[14px] leading-[1.6] text-muted">
            <p className="font-semibold text-ink">You’ll need:</p>
            <ul className="list-disc pl-5">
              <li>your CV and at least one qualification (a photo of the certificate is fine)</li>
              <li>your ID, and a phone camera to take a selfie</li>
              <li>three references who have agreed to be contacted</li>
              {status.policeClearanceRequired ? <li>a police clearance certificate</li> : null}
            </ul>
            <p>It takes about 15 minutes. First, create an account or sign in.</p>
          </div>
          <div className="flex flex-wrap gap-[10px]">
            <ButtonLink href="/signup?next=/teach">Create an account</ButtonLink>
            <ButtonLink href="/login?next=/teach" variant="secondary">
              I already have one
            </ButtonLink>
          </div>
        </Card>
      </Shell>
    );
  }

  const supabase = await createClient();
  const [{ data: claims }, subjects, grades, languages, offerings] = await Promise.all([
    supabase.auth.getClaims(),
    getSubjects(),
    getGrades(),
    getLanguages(),
    api.public.get<SubjectOffering[]>("/reference/subject-offerings", "reference"),
  ]);
  const offeredAt: Record<string, string[]> = {};
  for (const o of offerings) (offeredAt[o.subjectCode] ??= []).push(o.gradeCode);

  return (
    <Shell description={[intro, closes].filter(Boolean).join(" ")}>
      <ApplyForm
        subjects={subjects.map((s) => ({ code: s.code, name: s.name }))}
        grades={grades.map((g) => ({ code: g.code, name: g.name, sortOrder: g.sortOrder }))}
        offerings={offeredAt}
        media={languages.filter((l) => l.isInstructionMedium).map((l) => ({ code: l.code, name: l.name }))}
        provinces={SA_PROVINCES}
        needs={(status.needs ?? []).map((n) => n.code)}
        policeClearanceRequired={!!status.policeClearanceRequired}
        me={{
          firstName: session.profile.first_name,
          lastName: session.profile.last_name,
          email: typeof claims?.claims.email === "string" ? claims.claims.email : "",
          phone: session.profile.phone ?? "",
        }}
      />
    </Shell>
  );
}
