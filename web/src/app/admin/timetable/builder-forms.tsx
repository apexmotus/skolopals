"use client";

import { useActionState, useState } from "react";
import { Button, Card, CardTitle, Field, FormMessage, Input, Select } from "@/components/ui";
import {
  createClassGroup,
  createRoom,
  createTerm,
  regenerateSessions,
  type BuilderState,
} from "./actions";

type Option = { code: string; name: string };

const DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

function Result({ state }: { state: BuilderState }) {
  if (state.error) return <FormMessage>{state.error}</FormMessage>;
  if (state.ok) return <FormMessage tone="success">{state.ok}</FormMessage>;
  return null;
}

export function TermForm() {
  const [state, action, pending] = useActionState<BuilderState, FormData>(createTerm, {});
  return (
    <Card>
      <CardTitle>Add a term</CardTitle>
      <p className="text-[11px] text-muted">
        Term dates are entered here, not seeded, so the system never disagrees with the schools your
        learners attend.
      </p>
      <form action={action} className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 md:flex-row">
          <Field label="Year" htmlFor="year">
            <Input id="year" name="year" inputMode="numeric" defaultValue="2026" required />
          </Field>
          <Field label="Term" htmlFor="term_number">
            <Select id="term_number" name="term_number" defaultValue="1" required>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  Term {n}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="flex flex-col gap-3 md:flex-row">
          <Field label="Starts" htmlFor="starts_on">
            <Input id="starts_on" name="starts_on" type="date" required />
          </Field>
          <Field label="Ends" htmlFor="ends_on">
            <Input id="ends_on" name="ends_on" type="date" required />
          </Field>
        </div>
        <Result state={state} />
        <Button type="submit" className="w-fit" disabled={pending}>
          {pending ? "Adding…" : "Add term"}
        </Button>
      </form>
    </Card>
  );
}

export function RoomForm() {
  const [state, action, pending] = useActionState<BuilderState, FormData>(createRoom, {});
  return (
    <Card>
      <CardTitle>Add a room</CardTitle>
      <form action={action} className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 md:flex-row">
          <Field label="Name" htmlFor="room_name">
            <Input id="room_name" name="name" placeholder="Main Room" required />
          </Field>
          <Field label="Capacity" htmlFor="capacity">
            <Input id="capacity" name="capacity" inputMode="numeric" defaultValue="8" required />
          </Field>
        </div>
        <Result state={state} />
        <Button type="submit" className="w-fit" disabled={pending}>
          {pending ? "Adding…" : "Add room"}
        </Button>
      </form>
    </Card>
  );
}

export function ClassForm({
  subjects,
  languages,
  grades,
  tutors,
  terms,
  rooms,
}: {
  subjects: Option[];
  languages: Option[];
  grades: Option[];
  tutors: { id: string; full_name: string }[];
  terms: { id: string; label: string }[];
  rooms: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<BuilderState, FormData>(createClassGroup, {});
  const [mode, setMode] = useState("in_centre");

  return (
    <Card>
      <CardTitle>Add a class</CardTitle>
      <p className="text-[11px] text-muted">
        The tutor must already be recorded as teaching this subject, in this language, at every grade the
        class covers. Sessions for the whole term are generated when you save.
      </p>
      <form action={action} className="flex flex-col gap-3">
        <Field label="Class name" htmlFor="class_name">
          <Input id="class_name" name="name" placeholder="Grade 7 Mathematics (English)" required />
        </Field>
        <div className="flex flex-col gap-3 md:flex-row">
          <Field label="Subject" htmlFor="subject_code">
            <Select id="subject_code" name="subject_code" required>
              {subjects.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Taught in" htmlFor="language_code">
            <Select id="language_code" name="language_code" defaultValue="english" required>
              {languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Grades covered" htmlFor="grades">
          <div className="flex flex-wrap gap-3 pt-1">
            {grades.map((g) => (
              <label key={g.code} className="flex items-center gap-1.5 text-[12px] text-ink">
                <input type="checkbox" name="grade_code" value={g.code} />
                {g.name}
              </label>
            ))}
          </div>
        </Field>
        <div className="flex flex-col gap-3 md:flex-row">
          <Field label="Tutor" htmlFor="tutor_id">
            <Select id="tutor_id" name="tutor_id" required>
              {tutors.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Term" htmlFor="term_id">
            <Select id="term_id" name="term_id" required>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="flex flex-col gap-3 md:flex-row">
          <Field label="Delivery" htmlFor="delivery_mode">
            <Select
              id="delivery_mode"
              name="delivery_mode"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <option value="in_centre">At the centre</option>
              <option value="online">Online</option>
              <option value="hybrid">Hybrid</option>
            </Select>
          </Field>
          <Field label="Room" htmlFor="room_id">
            <Select id="room_id" name="room_id" disabled={mode === "online"}>
              <option value="">{mode === "online" ? "Not needed" : "Choose a room"}</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Capacity" htmlFor="class_capacity">
            <Input id="class_capacity" name="capacity" inputMode="numeric" defaultValue="6" required />
          </Field>
        </div>
        <Field label="Meets on" htmlFor="days">
          <div className="flex flex-wrap gap-3 pt-1">
            {DAYS.map((d) => (
              <label key={d.value} className="flex items-center gap-1.5 text-[12px] text-ink">
                <input type="checkbox" name="day_of_week" value={d.value} />
                {d.label}
              </label>
            ))}
          </div>
        </Field>
        <div className="flex flex-col gap-3 md:flex-row">
          <Field label="From" htmlFor="starts_at_time">
            <Input id="starts_at_time" name="starts_at_time" type="time" defaultValue="15:00" required />
          </Field>
          <Field label="To" htmlFor="ends_at_time">
            <Input id="ends_at_time" name="ends_at_time" type="time" defaultValue="16:00" required />
          </Field>
        </div>
        <Result state={state} />
        <Button type="submit" className="w-fit" disabled={pending}>
          {pending ? "Creating…" : "Create class and generate sessions"}
        </Button>
      </form>
    </Card>
  );
}

export function RegenerateButton({ classGroupId }: { classGroupId: string }) {
  const [state, action, pending] = useActionState<BuilderState, FormData>(regenerateSessions, {});
  return (
    <form action={action} className="flex items-center gap-3">
      <input type="hidden" name="class_group_id" value={classGroupId} />
      <button
        type="submit"
        disabled={pending}
        className="text-[12px] text-brand underline-offset-2 hover:underline"
      >
        {pending ? "Generating…" : "Regenerate sessions"}
      </button>
      {state.error ? <span className="text-[11px] text-danger">{state.error}</span> : null}
      {state.ok ? <span className="text-[11px] text-success">{state.ok}</span> : null}
    </form>
  );
}
