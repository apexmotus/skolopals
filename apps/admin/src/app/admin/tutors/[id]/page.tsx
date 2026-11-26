import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, CardTitle, DetailRow, FormMessage, PageHeading } from "@skolopals/ui/ui";
import { RequestPoliceClearanceButton } from "../../tutor-applications/review-forms";
import {
  CompetencyForm,
  PayRateForm,
  RemoveCompetencyButton,
  SpokenLanguagesForm,
  StatusForm,
} from "../tutor-forms";
import { createClient } from "@skolopals/shared/supabase/server";
import { getGrades, getLanguages, getSubjects } from "@skolopals/shared/reference";
import { money, shortDate } from "@skolopals/shared/format";

export const metadata = { title: "Tutor" };

const BASIS_LABEL: Record<string, string> = {
  monthly_salary: "Monthly salary",
  per_session: "Per session",
  per_hour: "Per hour",
};

export default async function AdminTutorPage({ params, searchParams }: PageProps<"/admin/tutors/[id]">) {
  const [{ id }, { from, skipped }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();

  const [{ data: tutor }, subjects, grades, languages] = await Promise.all([
    supabase
      .from("tutors")
      .select(
        "*, profiles(full_name, phone), tutor_competencies(id, subject_code, grade_code, subjects(name), grades(name, sort_order), tutor_competency_media(languages(code, name))), tutor_spoken_languages(language_code), tutor_qualifications(*), tutor_references(*), tutor_pay_rates(*), tutor_documents(doc_type, uploaded_at)",
      )
      .eq("id", id)
      .maybeSingle(),
    getSubjects(),
    getGrades(),
    getLanguages(),
  ]);

  if (!tutor) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const competencies = [...(tutor.tutor_competencies ?? [])].sort(
    (a, b) =>
      (a.subjects?.name ?? "").localeCompare(b.subjects?.name ?? "") ||
      (a.grades?.sort_order ?? 0) - (b.grades?.sort_order ?? 0),
  );
  const rates = [...(tutor.tutor_pay_rates ?? [])].sort((a, b) =>
    b.effective_from.localeCompare(a.effective_from),
  );
  const spoken = (tutor.tutor_spoken_languages ?? []).map((l) => l.language_code);
  const clearance = (tutor.tutor_documents ?? [])
    .filter((d) => d.doc_type === "police_clearance")
    .sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at))[0];
  const skippedCount = typeof skipped === "string" ? Number(skipped) : 0;

  return (
    <>
      <PageHeading title={tutor.profiles?.full_name ?? tutor.slug} description={tutor.headline} />
      {from === "application" ? (
        <FormMessage tone="success">
          Approved. Their subjects, documents and references are below. Set a pay rate, check their references, then
          activate them.
          {skippedCount > 0
            ? ` ${skippedCount} subject${skippedCount === 1 ? "" : "s"} could not be copied because the centre no longer offers ${skippedCount === 1 ? "it" : "them"} at that grade.`
            : ""}
        </FormMessage>
      ) : null}

      <Card>
        <CardTitle>Details</CardTitle>
        <DetailRow
          label="Status"
          value={<Badge tone={tutor.status === "active" ? "success" : "neutral"}>{tutor.status}</Badge>}
        />
        <DetailRow label="Employment" value={tutor.employment_type === "salaried" ? "Salaried" : "Sessional"} />
        <DetailRow label="Phone" value={tutor.profiles?.phone ?? "—"} />
        <DetailRow label="Started" value={shortDate(tutor.started_on)} />
        {tutor.application_id ? (
          <DetailRow
            label="Applied through the website"
            value={
              <Link href={`/admin/tutor-applications/${tutor.application_id}`} className="text-link hover:underline">
                Open application
              </Link>
            }
          />
        ) : null}
        <StatusForm tutorId={tutor.id} status={tutor.status} />
      </Card>

      <Card>
        <CardTitle>What they teach</CardTitle>
        {competencies.length === 0 ? (
          <p className="text-[13px] text-muted">
            Nothing recorded. This tutor cannot be given a class until a competency exists.
          </p>
        ) : (
          competencies.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2">
              <DetailRow
                label={`${c.subjects?.name ?? c.subject_code} · ${c.grades?.name ?? c.grade_code}`}
                value={
                  (c.tutor_competency_media ?? [])
                    .map((m) => m.languages?.name)
                    .filter(Boolean)
                    .join(", ") || "No medium set"
                }
              />
              <RemoveCompetencyButton tutorId={tutor.id} competencyId={c.id} />
            </div>
          ))
        )}
        <CompetencyForm
          tutorId={tutor.id}
          subjects={subjects.map((s) => ({ code: s.code, name: s.name }))}
          grades={grades.map((g) => ({ code: g.code, name: g.name }))}
          languages={languages.filter((l) => l.isInstructionMedium).map((l) => ({ code: l.code, name: l.name }))}
        />
      </Card>

      <Card>
        <CardTitle>Pay</CardTitle>
        {rates.length === 0 ? (
          <p className="text-[13px] text-muted">No rate recorded.</p>
        ) : (
          rates.map((r) => (
            <DetailRow
              key={r.id}
              label={`${BASIS_LABEL[r.pay_basis] ?? r.pay_basis} from ${shortDate(r.effective_from)}${
                r.effective_to ? ` to ${shortDate(r.effective_to)}` : " (current)"
              }`}
              value={money(r.amount_cents)}
            />
          ))
        )}
        <PayRateForm tutorId={tutor.id} today={today} />
      </Card>

      <Card>
        <CardTitle>Vetting and languages</CardTitle>
        <DetailRow label="Qualifications" value={String((tutor.tutor_qualifications ?? []).length)} />
        <DetailRow
          label="References checked"
          value={String((tutor.tutor_references ?? []).filter((r) => r.checked_at).length)}
        />
        <DetailRow
          label="Police clearance"
          value={
            clearance
              ? `Received ${shortDate(clearance.uploaded_at)}`
              : tutor.police_clearance_requested_at
                ? `Requested ${shortDate(tutor.police_clearance_requested_at)}, waiting`
                : "None on file"
          }
        />
        {clearance ? null : (
          <RequestPoliceClearanceButton tutorId={tutor.id} again={!!tutor.police_clearance_requested_at} />
        )}
        <SpokenLanguagesForm
          tutorId={tutor.id}
          languages={languages.map((l) => ({ code: l.code, name: l.name }))}
          selected={spoken}
        />
      </Card>
    </>
  );
}
