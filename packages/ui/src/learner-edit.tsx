"use client";

import { useActionState } from "react";
import { Button, Card, CardTitle, Field, FormMessage, Input, Select } from "./ui";

/** Edit forms for a learner record, shared by the parent and admin portals. Each app passes its own server actions. */

type State = { error?: string; ok?: string };
type Action = (prev: State, formData: FormData) => Promise<State>;
type Option = { code: string; name: string };

export type LearnerEditActions = {
  update: Action;
  addContact: Action;
  removeContact: Action;
  addCollector: Action;
  removeCollector: Action;
};

type Learner = {
  id: string;
  first: string;
  last: string;
  date_of_birth: string;
  grade_code: string;
  school_name: string;
  home_language_code: string | null;
  status: string;
  left_on: string | null;
};

type Contact = { id: string; full_name: string; relationship: string; phone: string; priority?: number };

function Result({ state }: { state: State }) {
  if (state.error) return <FormMessage>{state.error}</FormMessage>;
  if (state.ok) return <FormMessage tone="success">{state.ok}</FormMessage>;
  return null;
}

function NameRow({ prefix, first, last }: { prefix: string; first?: string; last?: string }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <Field label="First name" htmlFor={`${prefix}first_name`} className="flex-1">
        <Input id={`${prefix}first_name`} name="first_name" defaultValue={first} required />
      </Field>
      <Field label="Last name" htmlFor={`${prefix}last_name`} className="flex-1">
        <Input id={`${prefix}last_name`} name="last_name" defaultValue={last} required />
      </Field>
    </div>
  );
}

export function LearnerDetailsForm({
  learner,
  grades,
  languages,
  action,
  allowStatus,
}: {
  learner: Learner;
  grades: Option[];
  languages: Option[];
  action: Action;
  allowStatus?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <Card>
      <CardTitle>Details</CardTitle>
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="learner_id" value={learner.id} />
        <NameRow prefix="learner-" first={learner.first} last={learner.last} />
        <Field label="Date of birth" htmlFor="date_of_birth">
          <Input id="date_of_birth" name="date_of_birth" type="date" defaultValue={learner.date_of_birth} required />
        </Field>
        <Field label="Grade" htmlFor="grade_code">
          <Select id="grade_code" name="grade_code" defaultValue={learner.grade_code} required>
            {grades.map((g) => (
              <option key={g.code} value={g.code}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="School they attend" htmlFor="school_name">
          <Input id="school_name" name="school_name" defaultValue={learner.school_name} />
        </Field>
        <Field label="Home language" htmlFor="home_language_code">
          <Select id="home_language_code" name="home_language_code" defaultValue={learner.home_language_code ?? ""}>
            <option value="">Prefer not to say</option>
            {languages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>
        {allowStatus ? (
          <div className="flex flex-col gap-4 sm:flex-row">
            <Field label="Status" htmlFor="status" className="flex-1">
              <Select id="status" name="status" defaultValue={learner.status}>
                {["prospective", "active", "paused", "left"].map((s) => (
                  <option key={s} value={s}>
                    {s[0].toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Left on (only if status is Left)" htmlFor="left_on" className="flex-1">
              <Input id="left_on" name="left_on" type="date" defaultValue={learner.left_on ?? ""} />
            </Field>
          </div>
        ) : null}
        <Result state={state} />
        <Button type="submit" className="w-fit" disabled={pending}>
          {pending ? "Saving…" : "Save details"}
        </Button>
      </form>
    </Card>
  );
}

function RemoveButton({
  action,
  learnerId,
  idName,
  id,
  label,
}: {
  action: Action;
  learnerId: string;
  idName: string;
  id: string;
  label: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="learner_id" value={learnerId} />
      <input type="hidden" name={idName} value={id} />
      <Button type="submit" variant="secondary" disabled={pending} aria-label={label}>
        {pending ? "Removing…" : "Remove"}
      </Button>
      {state.error ? <p className="max-w-[260px] text-right text-[11px] text-danger">{state.error}</p> : null}
    </form>
  );
}

function AddPersonForm({
  learnerId,
  action,
  submitLabel,
  withId,
  prefix,
}: {
  learnerId: string;
  prefix: string;
  action: Action;
  submitLabel: string;
  withId?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4 border-t border-line pt-4">
      <input type="hidden" name="learner_id" value={learnerId} />
      <NameRow prefix={prefix} />
      <div className="flex flex-col gap-4 sm:flex-row">
        <Field label="Relationship to the learner" htmlFor={`${prefix}relationship`} className="flex-1">
          <Input id={`${prefix}relationship`} name="relationship" placeholder="Aunt, grandparent…" />
        </Field>
        <Field label="Phone" htmlFor={`${prefix}phone`} className="flex-1">
          <Input id={`${prefix}phone`} name="phone" type="tel" required />
        </Field>
      </div>
      {withId ? (
        <Field label="Last 4 digits of their ID" htmlFor={`${prefix}id_number_last4`}>
          <Input
            id={`${prefix}id_number_last4`}
            name="id_number_last4"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            placeholder="4821"
            required
          />
        </Field>
      ) : null}
      <Result state={state} />
      <Button type="submit" variant="secondary" className="w-fit" disabled={pending}>
        {pending ? "Adding…" : submitLabel}
      </Button>
    </form>
  );
}

function PeopleCard({
  title,
  description,
  people,
  learnerId,
  idName,
  remove,
  add,
  addLabel,
  withId,
  empty,
}: {
  title: string;
  description: string;
  people: Contact[];
  learnerId: string;
  idName: string;
  remove: Action;
  add: Action;
  addLabel: string;
  withId?: boolean;
  empty: string;
}) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <p className="text-[11px] text-muted">{description}</p>
      {people.length === 0 ? (
        <p className="text-[13px] text-muted">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {people.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
              <span className="flex flex-col gap-[2px]">
                <span className="text-[13px] font-bold text-ink">
                  {p.priority ? `${p.priority}. ` : ""}
                  {p.full_name}
                </span>
                <span className="text-[12px] text-muted">
                  {p.relationship} · {p.phone}
                </span>
              </span>
              <RemoveButton
                action={remove}
                learnerId={learnerId}
                idName={idName}
                id={p.id}
                label={`Remove ${p.full_name}`}
              />
            </li>
          ))}
        </ul>
      )}
      <AddPersonForm prefix={`${idName}-`} learnerId={learnerId} action={add} submitLabel={addLabel} withId={withId} />
    </Card>
  );
}

export function LearnerEditor({
  learner,
  contacts,
  collectors,
  grades,
  languages,
  actions,
  allowStatus,
}: {
  learner: Learner;
  contacts: Contact[];
  collectors: Contact[];
  grades: Option[];
  languages: Option[];
  actions: LearnerEditActions;
  allowStatus?: boolean;
}) {
  return (
    <div className="flex max-w-[760px] flex-col gap-5">
      <LearnerDetailsForm
        learner={learner}
        grades={grades}
        languages={languages}
        action={actions.update}
        allowStatus={allowStatus}
      />
      <PeopleCard
        title="Emergency contacts"
        description="We call these people, in this order, if something happens and we cannot reach the parent. At least one is required."
        people={contacts}
        learnerId={learner.id}
        idName="contact_id"
        remove={actions.removeContact}
        add={actions.addContact}
        addLabel="Add emergency contact"
        empty="No emergency contacts yet."
      />
      <PeopleCard
        title="Authorised to collect"
        description="People other than the parent who may collect the learner. Staff check the last four digits of their ID at the door."
        people={collectors}
        learnerId={learner.id}
        idName="collector_id"
        remove={actions.removeCollector}
        add={actions.addCollector}
        addLabel="Add person"
        withId
        empty="Nobody else is authorised to collect."
      />
    </div>
  );
}
