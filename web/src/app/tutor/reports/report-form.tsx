"use client";

import { useActionState, useState } from "react";
import { Button, Card, CardTitle, Field, FormMessage, Select, Textarea } from "@/components/ui";
import { saveReport, type ReportState } from "./actions";

type Option = { code: string; name: string };

export function ReportForm({
  learners,
  subjects,
  levels,
  terms,
}: {
  learners: { id: string; full_name: string }[];
  subjects: Option[];
  levels: { code: number; label: string }[];
  terms: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState<ReportState, FormData>(saveReport, {});
  const [chosen, setChosen] = useState<string[]>(subjects.slice(0, 2).map((s) => s.code));

  const toggle = (code: string) =>
    setChosen((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  return (
    <Card>
      <CardTitle>Write a termly report</CardTitle>
      <p className="text-[11px] text-muted">
        Saving keeps it as a draft. The parent sees nothing until you publish, and publishing cannot be
        undone.
      </p>
      <form action={action} className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 md:flex-row">
          <Field label="Learner" htmlFor="report_learner">
            <Select id="report_learner" name="learner_id" required>
              {learners.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.full_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Term" htmlFor="report_term">
            <Select id="report_term" name="term_id" required>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Overall summary" htmlFor="summary">
          <Textarea id="summary" name="summary" rows={3} placeholder="How the term went, in plain words" />
        </Field>
        <Field label="Attendance note" htmlFor="attendance_note">
          <Textarea id="attendance_note" name="attendance_note" rows={2} placeholder="e.g. attended 17 of 18 sessions" />
        </Field>

        <p className="pt-2 text-[12px] font-bold text-ink">Subjects covered</p>
        <div className="flex flex-wrap gap-3">
          {subjects.map((s) => (
            <label key={s.code} className="flex items-center gap-1.5 text-[12px] text-ink">
              <input type="checkbox" checked={chosen.includes(s.code)} onChange={() => toggle(s.code)} />
              {s.name}
            </label>
          ))}
        </div>

        {chosen.map((code) => {
          const subject = subjects.find((s) => s.code === code);
          return (
            <div key={code} className="flex flex-col gap-2 border-t border-line pt-3">
              <input type="hidden" name="subject_code" value={code} />
              <p className="text-[13px] font-bold text-ink">{subject?.name}</p>
              <Select name={`level_${code}`} defaultValue="" aria-label={`${subject?.name} achievement`}>
                <option value="">Achievement level</option>
                {levels.map((l) => (
                  <option key={l.code} value={l.code}>
                    Level {l.code} — {l.label}
                  </option>
                ))}
              </Select>
              <Textarea name={`strengths_${code}`} rows={2} placeholder="Strengths" />
              <Textarea name={`improve_${code}`} rows={2} placeholder="Areas for improvement" />
              <Textarea name={`intervention_${code}`} rows={2} placeholder="Recommended intervention" />
            </div>
          );
        })}

        {state.error ? <FormMessage>{state.error}</FormMessage> : null}
        {state.ok ? <FormMessage tone="success">{state.ok}</FormMessage> : null}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" name="publish" value="no" variant="secondary" disabled={pending}>
            {pending ? "Saving…" : "Save draft"}
          </Button>
          <Button type="submit" name="publish" value="yes" disabled={pending}>
            {pending ? "Publishing…" : "Publish to parent"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
