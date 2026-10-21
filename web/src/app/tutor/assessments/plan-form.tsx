"use client";

import { useActionState, useState } from "react";
import { Button, Card, CardTitle, Field, FormMessage, Input, Select } from "@/components/ui";
import { createLearningPlan, type AssessState } from "./actions";

type Option = { code: string; name: string };

export function PlanForm({
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
  const [state, action, pending] = useActionState<AssessState, FormData>(createLearningPlan, {});
  const [rows, setRows] = useState([0, 1]);

  return (
    <Card>
      <CardTitle>Write a learning plan</CardTitle>
      <p className="text-[11px] text-muted">
        Goals follow the assessment. Creating a plan supersedes the learner&rsquo;s previous one — the old
        plan is kept, not deleted.
      </p>
      <form action={action} className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 md:flex-row">
          <Field label="Learner" htmlFor="plan_learner">
            <Select id="plan_learner" name="learner_id" required>
              {learners.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.full_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Term" htmlFor="plan_term">
            <Select id="plan_term" name="term_id" defaultValue={terms[0]?.id ?? ""}>
              <option value="">Not linked to a term</option>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {rows.map((i) => (
          <div key={i} className="flex flex-col gap-2 border-t border-line pt-3">
            <div className="flex flex-col gap-2 md:flex-row">
              <Select name="goal_subject" defaultValue={subjects[0]?.code} aria-label="Subject">
                {subjects.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <Select name={`goal_level_${i}`} defaultValue="" aria-label="Target level">
                <option value="">No target level</option>
                {levels.map((l) => (
                  <option key={l.code} value={l.code}>
                    Level {l.code} — {l.label}
                  </option>
                ))}
              </Select>
              <Input name={`goal_date_${i}`} type="date" aria-label="Target date" />
            </div>
            <Input name={`goal_text_${i}`} placeholder="What should improve, in plain words" />
          </div>
        ))}

        <button
          type="button"
          onClick={() => setRows((r) => [...r, r.length])}
          className="w-fit text-[12px] text-brand hover:underline"
        >
          Add another goal
        </button>

        {state.error ? <FormMessage>{state.error}</FormMessage> : null}
        {state.ok ? <FormMessage tone="success">{state.ok}</FormMessage> : null}
        <Button type="submit" className="w-fit" disabled={pending}>
          {pending ? "Saving…" : "Create learning plan"}
        </Button>
      </form>
    </Card>
  );
}
