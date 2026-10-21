"use client";

import { useActionState, useState } from "react";
import { Button, Card, CardTitle, Field, FormMessage, Input, Select, cx } from "@/components/ui";
import { submitEnrolment, type EnrolState } from "./actions";
import { money } from "@/lib/format";

type Option = { code: string; name: string };
type Pkg = Option & { subject_allowance: number | null; amount_cents: number | null };
type ConsentType = { code: string; name: string; description: string; is_required: boolean };

export function EnrolForm({
  packages,
  grades,
  subjects,
  languages,
  tutors,
  consentTypes,
  defaultTutor,
}: {
  packages: Pkg[];
  grades: Option[];
  subjects: Option[];
  languages: Option[];
  tutors: { id: string; full_name: string }[];
  consentTypes: ConsentType[];
  defaultTutor?: string;
}) {
  const [state, action, pending] = useActionState<EnrolState, FormData>(submitEnrolment, {});
  const [packageCode, setPackageCode] = useState(packages[0]?.code ?? "");
  const [chosen, setChosen] = useState<string[]>([]);

  const pkg = packages.find((p) => p.code === packageCode);
  const allowance = pkg?.subject_allowance ?? null;
  const atLimit = allowance !== null && chosen.length >= allowance;

  const toggle = (code: string) =>
    setChosen((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : atLimit ? prev : [...prev, code],
    );

  const required = consentTypes.filter((c) => c.is_required);
  const optional = consentTypes.filter((c) => !c.is_required);

  return (
    <form action={action} className="flex flex-col gap-5">
      <Card>
        <CardTitle>1. Choose a package</CardTitle>
        <div className="flex flex-col gap-2">
          {packages.map((p) => (
            <label
              key={p.code}
              className={cx(
                "flex cursor-pointer items-start justify-between gap-3 rounded-[8px] border p-3",
                packageCode === p.code ? "border-brand ring-1 ring-brand" : "border-line",
              )}
            >
              <span className="flex flex-col gap-[2px]">
                <span className="text-[13px] font-bold text-ink">{p.name}</span>
                <span className="text-[11px] text-muted">
                  {p.subject_allowance ? `${p.subject_allowance} subject(s)` : "All subjects"}
                </span>
              </span>
              <span className="flex items-center gap-3">
                <span className="text-[13px] text-ink">
                  {p.amount_cents == null ? "—" : `${money(p.amount_cents)}/month`}
                </span>
                <input
                  type="radio"
                  name="package_code"
                  value={p.code}
                  checked={packageCode === p.code}
                  onChange={() => {
                    setPackageCode(p.code);
                    setChosen([]);
                  }}
                />
              </span>
            </label>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>2. About your child</CardTitle>
        <Field label="Full name" htmlFor="full_name">
          <Input id="full_name" name="full_name" defaultValue={state.values?.full_name} required />
        </Field>
        <Field label="Date of birth" htmlFor="date_of_birth">
          <Input id="date_of_birth" name="date_of_birth" type="date" defaultValue={state.values?.date_of_birth} required />
        </Field>
        <Field label="Grade in 2026" htmlFor="grade_code">
          <Select id="grade_code" name="grade_code" defaultValue={state.values?.grade_code ?? ""} required>
            <option value="">Select a grade</option>
            {grades.map((g) => (
              <option key={g.code} value={g.code}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="School they attend" htmlFor="school_name">
          <Input id="school_name" name="school_name" defaultValue={state.values?.school_name} />
        </Field>
        <Field label="Home language" htmlFor="home_language_code">
          <Select id="home_language_code" name="home_language_code" defaultValue={state.values?.home_language_code ?? ""}>
            <option value="">Prefer not to say</option>
            {languages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="You are their" htmlFor="relationship">
          <Select id="relationship" name="relationship" defaultValue="mother">
            {["mother", "father", "grandparent", "guardian", "other"].map((r) => (
              <option key={r} value={r}>
                {r[0].toUpperCase() + r.slice(1)}
              </option>
            ))}
          </Select>
        </Field>
      </Card>

      <Card>
        <CardTitle>
          3. Subjects{allowance ? ` — choose up to ${allowance}` : ""}
        </CardTitle>
        <p className="text-[11px] text-muted">
          You can choose the language each subject is taught in. Mathematics in English and Physical
          Sciences in Afrikaans is a normal combination.
        </p>
        <div className="flex flex-col gap-2">
          {subjects.map((s) => {
            const picked = chosen.includes(s.code);
            return (
              <div key={s.code} className="flex flex-wrap items-center gap-3">
                <label className="flex min-w-[220px] flex-1 items-center gap-2 text-[13px] text-ink">
                  <input
                    type="checkbox"
                    name="subject"
                    value={s.code}
                    checked={picked}
                    disabled={!picked && atLimit}
                    onChange={() => toggle(s.code)}
                  />
                  <span className={cx(!picked && atLimit && "text-muted")}>{s.name}</span>
                </label>
                {picked ? (
                  <Select name={`medium_${s.code}`} defaultValue="english" className="max-w-[200px]">
                    {languages.map((l) => (
                      <option key={l.code} value={l.code}>
                        Taught in {l.name}
                      </option>
                    ))}
                  </Select>
                ) : null}
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardTitle>4. Preferred tutor (optional)</CardTitle>
        <p className="text-[11px] text-muted">
          We will do our best to match your preference. Placement depends on the timetable.
        </p>
        <Select name="preferred_tutor" defaultValue={defaultTutor ?? ""}>
          <option value="">No preference</option>
          {tutors.map((t) => (
            <option key={t.id} value={t.id}>
              {t.full_name}
            </option>
          ))}
        </Select>
      </Card>

      <Card>
        <CardTitle>5. Keeping your child safe</CardTitle>
        <p className="text-[11px] text-muted">
          We need someone we can reach in an emergency. You can also name one other person allowed to
          collect your child.
        </p>
        <Field label="Emergency contact name" htmlFor="ec_name">
          <Input id="ec_name" name="ec_name" defaultValue={state.values?.ec_name} required />
        </Field>
        <Field label="Relationship to your child" htmlFor="ec_relationship">
          <Input id="ec_relationship" name="ec_relationship" placeholder="Aunt, grandparent…" />
        </Field>
        <Field label="Emergency contact phone" htmlFor="ec_phone">
          <Input id="ec_phone" name="ec_phone" type="tel" defaultValue={state.values?.ec_phone} required />
        </Field>

        <p className="pt-2 text-[12px] font-bold text-ink">Authorised to collect (optional)</p>
        <Field label="Name" htmlFor="col_name">
          <Input id="col_name" name="col_name" />
        </Field>
        <Field label="Relationship" htmlFor="col_relationship">
          <Input id="col_relationship" name="col_relationship" />
        </Field>
        <Field label="Phone" htmlFor="col_phone">
          <Input id="col_phone" name="col_phone" type="tel" />
        </Field>
        <Field label="Last 4 digits of their ID" htmlFor="col_id_number_last4">
          <Input
            id="col_id_number_last4"
            name="col_id_number_last4"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            placeholder="4821"
          />
        </Field>
        <p className="text-[11px] text-muted">
          Four digits only — enough to check at the door, not enough to be worth stealing.
        </p>
      </Card>

      <Card>
        <CardTitle>6. Your permission</CardTitle>
        <p className="text-[11px] text-muted">
          The law requires a parent or guardian’s consent before we may process a child’s information.
          You can withdraw any of these at any time.
        </p>

        {required.map((c) => (
          <label key={c.code} className="flex items-start gap-3 rounded-[8px] border border-line p-3">
            <input type="checkbox" name={`consent_${c.code}`} className="mt-1" required />
            <input type="hidden" name="required_consent" value={c.code} />
            <span className="flex flex-col gap-1">
              <span className="text-[13px] font-bold text-ink">
                {c.name} <span className="font-normal text-danger">Required</span>
              </span>
              <span className="text-[12px] text-muted">{c.description}</span>
            </span>
          </label>
        ))}

        {optional.map((c) => (
          <label key={c.code} className="flex items-start gap-3 rounded-[8px] border border-line p-3">
            {/* Deliberately unchecked. Bundling an optional consent with
                enrolment would invalidate the consent entirely. */}
            <input type="checkbox" name={`consent_${c.code}`} className="mt-1" />
            <input type="hidden" name="optional_consent" value={c.code} />
            <span className="flex flex-col gap-1">
              <span className="text-[13px] font-bold text-ink">
                {c.name} <span className="font-normal text-muted">Optional</span>
              </span>
              <span className="text-[12px] text-muted">{c.description}</span>
            </span>
          </label>
        ))}
        <p className="text-[11px] text-muted">
          Declining an optional consent does not affect your child’s place.
        </p>
      </Card>

      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      <Button type="submit" className="w-fit" disabled={pending}>
        {pending ? "Submitting…" : "Submit enrolment"}
      </Button>
    </form>
  );
}
