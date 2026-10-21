"use client";

import { useActionState, useState } from "react";
import { Button, Card, CardTitle, Field, FormMessage, Input, Select, Textarea } from "@/components/ui";
import { recordAssessment, type AssessState } from "./actions";

type Option = { code: string; name: string };
type Learner = { id: string; full_name: string; grade_code: string };

export function AssessmentForm({
  learners,
  types,
  domains,
  subjects,
  terms,
  today,
}: {
  learners: Learner[];
  types: Option[];
  domains: Option[];
  subjects: Option[];
  terms: { id: string; label: string }[];
  today: string;
}) {
  const [state, action, pending] = useActionState<AssessState, FormData>(recordAssessment, {});
  const [learnerId, setLearnerId] = useState(learners[0]?.id ?? "");
  const [type, setType] = useState("initial");

  const learner = learners.find((l) => l.id === learnerId);
  // The initial assessment spans the six domains rather than one subject.
  const isInitial = type === "initial";

  return (
    <Card>
      <CardTitle>Record an assessment</CardTitle>
      <form action={action} className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 md:flex-row">
          <Field label="Learner" htmlFor="learner_id">
            <Select
              id="learner_id"
              name="learner_id"
              value={learnerId}
              onChange={(e) => setLearnerId(e.target.value)}
              required
            >
              {learners.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.full_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Type" htmlFor="assessment_type_code">
            <Select
              id="assessment_type_code"
              name="assessment_type_code"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {types.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <input type="hidden" name="grade_code" value={learner?.grade_code ?? ""} />

        <div className="flex flex-col gap-3 md:flex-row">
          <Field label="Date" htmlFor="assessed_on">
            <Input id="assessed_on" name="assessed_on" type="date" defaultValue={today} required />
          </Field>
          <Field label="Term" htmlFor="term_id">
            <Select id="term_id" name="term_id" defaultValue={terms[0]?.id ?? ""}>
              <option value="">Not linked to a term</option>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          {!isInitial ? (
            <Field label="Subject" htmlFor="subject_code">
              <Select id="subject_code" name="subject_code">
                <option value="">Across subjects</option>
                {subjects.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
        </div>

        <p className="pt-2 text-[12px] font-bold text-ink">Marks</p>
        <p className="text-[11px] text-muted">
          Leave a row blank if it was not assessed — that is not the same as a zero. The achievement level
          is worked out from the mark, so there is nothing to choose.
        </p>
        <div className="flex flex-col gap-2">
          {domains.map((d) => (
            <div key={d.code} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="domain" value={d.code} />
              <span className="min-w-[140px] flex-1 text-[13px] text-ink">{d.name}</span>
              <Input
                name={`raw_${d.code}`}
                inputMode="decimal"
                placeholder="mark"
                className="max-w-[90px]"
                aria-label={`${d.name} mark`}
              />
              <span className="text-[12px] text-muted">out of</span>
              <Input
                name={`max_${d.code}`}
                inputMode="decimal"
                placeholder="total"
                defaultValue={isInitial ? "50" : ""}
                className="max-w-[90px]"
                aria-label={`${d.name} total`}
              />
            </div>
          ))}
        </div>

        <Field label="Notes" htmlFor="notes">
          <Textarea id="notes" name="notes" rows={3} placeholder="What you observed during the assessment" />
        </Field>

        {state.error ? <FormMessage>{state.error}</FormMessage> : null}
        {state.ok ? <FormMessage tone="success">{state.ok}</FormMessage> : null}
        <Button type="submit" className="w-fit" disabled={pending}>
          {pending ? "Saving…" : "Record assessment"}
        </Button>
      </form>
    </Card>
  );
}
