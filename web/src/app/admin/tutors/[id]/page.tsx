import { notFound } from "next/navigation";
import { Badge, Card, CardTitle, DetailRow, PageHeading } from "@/components/ui";
import {
  CompetencyForm,
  PayRateForm,
  RemoveCompetencyButton,
  SpokenLanguagesForm,
  StatusForm,
} from "../tutor-forms";
import { createClient } from "@/lib/supabase/server";
import { getGrades, getLanguages, getSubjects } from "@/lib/queries";
import { money, shortDate } from "@/lib/format";

export const metadata = { title: "Tutor" };

const BASIS_LABEL: Record<string, string> = {
  monthly_salary: "Monthly salary",
  per_session: "Per session",
  per_hour: "Per hour",
};

export default async function AdminTutorPage({ params }: PageProps<"/admin/tutors/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: tutor }, subjects, grades, languages] = await Promise.all([
    supabase
      .from("tutors")
      .select(
        "*, profiles(full_name, phone), tutor_competencies(id, subject_code, grade_code, subjects(name), grades(name, sort_order), tutor_competency_media(languages(code, name))), tutor_spoken_languages(language_code), tutor_qualifications(*), tutor_references(*), tutor_pay_rates(*)",
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

  return (
    <>
      <PageHeading title={tutor.profiles?.full_name ?? tutor.slug} description={tutor.headline} />

      <Card>
        <CardTitle>Details</CardTitle>
        <DetailRow
          label="Status"
          value={<Badge tone={tutor.status === "active" ? "success" : "neutral"}>{tutor.status}</Badge>}
        />
        <DetailRow label="Employment" value={tutor.employment_type === "salaried" ? "Salaried" : "Sessional"} />
        <DetailRow label="Phone" value={tutor.profiles?.phone ?? "—"} />
        <DetailRow label="Started" value={shortDate(tutor.started_on)} />
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
          languages={languages.map((l) => ({ code: l.code, name: l.name }))}
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
        <SpokenLanguagesForm
          tutorId={tutor.id}
          languages={languages.map((l) => ({ code: l.code, name: l.name }))}
          selected={spoken}
        />
      </Card>
    </>
  );
}
