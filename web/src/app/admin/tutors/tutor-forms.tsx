"use client";

import { useActionState } from "react";
import { Button, Card, CardTitle, Field, FormMessage, Input, Select } from "@/components/ui";
import {
  addCompetency,
  createTutor,
  removeCompetency,
  setPayRate,
  setSpokenLanguages,
  setTutorStatus,
  type TutorState,
} from "./actions";

type Option = { code: string; name: string };

function Result({ state }: { state: TutorState }) {
  if (state.error) return <FormMessage>{state.error}</FormMessage>;
  if (state.ok) return <FormMessage tone="success">{state.ok}</FormMessage>;
  return null;
}

export function CreateTutorForm() {
  const [state, action, pending] = useActionState<TutorState, FormData>(createTutor, {});
  return (
    <Card>
      <CardTitle>Add a tutor</CardTitle>
      <p className="text-[11px] text-muted">
        The person signs up on the website first, then you add them here. There is no public tutor
        application.
      </p>
      <form action={action} className="flex flex-col gap-3">
        <Field label="Their account email" htmlFor="email">
          <Input id="email" name="email" type="email" placeholder="naledi@example.com" required />
        </Field>
        <div className="flex flex-col gap-3 md:flex-row">
          <Field label="Profile link (optional)" htmlFor="slug">
            <Input id="slug" name="slug" placeholder="naledi-dube" />
          </Field>
          <Field label="Employment" htmlFor="employment_type">
            <Select id="employment_type" name="employment_type" defaultValue="sessional">
              <option value="sessional">Sessional</option>
              <option value="salaried">Salaried</option>
            </Select>
          </Field>
        </div>
        <Field label="Headline" htmlFor="headline">
          <Input id="headline" name="headline" placeholder="Mathematics and English, Grades 4–9" />
        </Field>
        <Result state={state} />
        <Button type="submit" className="w-fit" disabled={pending}>
          {pending ? "Adding…" : "Add tutor"}
        </Button>
      </form>
    </Card>
  );
}

export function CompetencyForm({
  tutorId,
  subjects,
  grades,
  languages,
}: {
  tutorId: string;
  subjects: Option[];
  grades: Option[];
  languages: Option[];
}) {
  const [state, action, pending] = useActionState<TutorState, FormData>(addCompetency, {});
  return (
    <form action={action} className="flex flex-col gap-3 border-t border-line pt-4">
      <input type="hidden" name="tutor_id" value={tutorId} />
      <p className="text-[12px] font-bold text-ink">Add what they teach</p>
      <p className="text-[11px] text-muted">
        Subject, grade and the language it is taught in — together. A tutor who teaches Mathematics in
        English and Physical Sciences in Afrikaans does not teach Mathematics in Afrikaans.
      </p>
      <div className="flex flex-col gap-3 md:flex-row">
        <Field label="Subject" htmlFor={`subj-${tutorId}`}>
          <Select id={`subj-${tutorId}`} name="subject_code" required>
            {subjects.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Grade" htmlFor={`grade-${tutorId}`}>
          <Select id={`grade-${tutorId}`} name="grade_code" required>
            {grades.map((g) => (
              <option key={g.code} value={g.code}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Taught in" htmlFor={`langs-${tutorId}`}>
        <div className="flex flex-wrap gap-3 pt-1">
          {languages.map((l) => (
            <label key={l.code} className="flex items-center gap-1.5 text-[12px] text-ink">
              <input type="checkbox" name="language_code" value={l.code} defaultChecked={l.code === "english"} />
              {l.name}
            </label>
          ))}
        </div>
      </Field>
      <Result state={state} />
      <Button type="submit" variant="secondary" className="w-fit" disabled={pending}>
        {pending ? "Saving…" : "Add competency"}
      </Button>
    </form>
  );
}

export function RemoveCompetencyButton({ tutorId, competencyId }: { tutorId: string; competencyId: string }) {
  const [state, action, pending] = useActionState<TutorState, FormData>(removeCompetency, {});
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="tutor_id" value={tutorId} />
      <input type="hidden" name="competency_id" value={competencyId} />
      <button type="submit" disabled={pending} className="text-[11px] text-muted hover:text-danger hover:underline">
        {pending ? "Removing…" : "Remove"}
      </button>
      {state.error ? <span className="text-[11px] text-danger">{state.error}</span> : null}
    </form>
  );
}

export function PayRateForm({ tutorId, today }: { tutorId: string; today: string }) {
  const [state, action, pending] = useActionState<TutorState, FormData>(setPayRate, {});
  return (
    <form action={action} className="flex flex-col gap-3 border-t border-line pt-4">
      <input type="hidden" name="tutor_id" value={tutorId} />
      <p className="text-[12px] font-bold text-ink">Set a pay rate</p>
      <div className="flex flex-col gap-3 md:flex-row">
        <Field label="Basis" htmlFor={`basis-${tutorId}`}>
          <Select id={`basis-${tutorId}`} name="pay_basis" defaultValue="per_hour">
            <option value="per_hour">Per hour</option>
            <option value="per_session">Per session</option>
            <option value="monthly_salary">Monthly salary</option>
          </Select>
        </Field>
        <Field label="Amount in Rand" htmlFor={`amt-${tutorId}`}>
          <Input id={`amt-${tutorId}`} name="amount_rand" inputMode="decimal" placeholder="120" required />
        </Field>
        <Field label="From" htmlFor={`from-${tutorId}`}>
          <Input id={`from-${tutorId}`} name="effective_from" type="date" defaultValue={today} />
        </Field>
      </div>
      <Result state={state} />
      <Button type="submit" variant="secondary" className="w-fit" disabled={pending}>
        {pending ? "Saving…" : "Set rate"}
      </Button>
    </form>
  );
}

export function SpokenLanguagesForm({
  tutorId,
  languages,
  selected,
}: {
  tutorId: string;
  languages: Option[];
  selected: string[];
}) {
  const [state, action, pending] = useActionState<TutorState, FormData>(setSpokenLanguages, {});
  return (
    <form action={action} className="flex flex-col gap-3 border-t border-line pt-4">
      <input type="hidden" name="tutor_id" value={tutorId} />
      <p className="text-[12px] font-bold text-ink">Languages they speak</p>
      <p className="text-[11px] text-muted">For parent meetings and messages — separate from what they teach in.</p>
      <div className="flex flex-wrap gap-3">
        {languages.map((l) => (
          <label key={l.code} className="flex items-center gap-1.5 text-[12px] text-ink">
            <input
              type="checkbox"
              name="language_code"
              value={l.code}
              defaultChecked={selected.includes(l.code)}
            />
            {l.name}
          </label>
        ))}
      </div>
      <Result state={state} />
      <Button type="submit" variant="secondary" className="w-fit" disabled={pending}>
        {pending ? "Saving…" : "Save languages"}
      </Button>
    </form>
  );
}

export function StatusForm({ tutorId, status }: { tutorId: string; status: string }) {
  const [state, action, pending] = useActionState<TutorState, FormData>(setTutorStatus, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-3 border-t border-line pt-4">
      <input type="hidden" name="tutor_id" value={tutorId} />
      <Field label="Status" htmlFor={`status-${tutorId}`}>
        <Select id={`status-${tutorId}`} name="status" defaultValue={status}>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="inactive">Inactive</option>
        </Select>
      </Field>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Update"}
      </Button>
      <Result state={state} />
    </form>
  );
}
