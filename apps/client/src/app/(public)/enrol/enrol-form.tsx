"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Button, Card, CardTitle, Field, FormMessage, Input, Select, cx } from "@skolopals/ui/ui";
import { submitEnrolment, type EnrolState } from "./actions";
import { money } from "@skolopals/shared/format";

type Option = { code: string; name: string };
type Pkg = Option & { subjectAllowance?: number; amountCents: number | null };
type ConsentType = { code: string; name: string; description: string; isRequired: boolean };

/** Covers `count` subjects: the first package, in display order, whose allowance is unlimited or big enough. */
const packageFor = (packages: Pkg[], count: number) =>
  packages.find((p) => p.subjectAllowance == null || p.subjectAllowance >= count);

export function EnrolForm({
  packages,
  grades,
  subjects,
  languages,
  tutors,
  consentTypes,
  defaultTutor,
  me,
}: {
  packages: Pkg[];
  grades: Option[];
  subjects: Option[];
  languages: Option[];
  tutors: { id: string; fullName: string }[];
  consentTypes: ConsentType[];
  defaultTutor?: string;
  me: { fullName: string; phone: string };
}) {
  const [state, action, pending] = useActionState<EnrolState, FormData>(submitEnrolment, {});
  const [packageCode, setPackageCode] = useState(packages[0]?.code ?? "");
  const [chosen, setChosen] = useState<string[]>([]);
  const [upgradedTo, setUpgradedTo] = useState<string | null>(null);
  const [ecSelf, setEcSelf] = useState(state.values?.ec_self === "on");
  const [colSelf, setColSelf] = useState(state.values?.col_self === "on");
  const v = state.values ?? {};

  const pkg = packages.find((p) => p.code === packageCode);
  const allowance = pkg?.subjectAllowance ?? null;

  // Picking more subjects than the package covers moves to the smallest package that covers
  // them, rather than blocking the checkbox. The database enforces the allowance either way.
  const toggle = (code: string) => {
    const next = chosen.includes(code) ? chosen.filter((c) => c !== code) : [...chosen, code];
    if (allowance !== null && next.length > allowance) {
      const bigger = packageFor(packages, next.length);
      if (!bigger) return;
      setPackageCode(bigger.code);
      setUpgradedTo(bigger.name);
    }
    setChosen(next);
  };

  const choosePackage = (p: Pkg) => {
    setPackageCode(p.code);
    setUpgradedTo(null);
    // Keep what still fits; drop the most recent picks beyond the new allowance.
    if (p.subjectAllowance != null) setChosen((prev) => prev.slice(0, p.subjectAllowance));
  };

  const required = consentTypes.filter((c) => c.isRequired);
  const optional = consentTypes.filter((c) => !c.isRequired);

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
                  {p.subjectAllowance ? `${p.subjectAllowance} subject(s)` : "All subjects"}
                </span>
              </span>
              <span className="flex items-center gap-3">
                <span className="text-[13px] text-ink">
                  {p.amountCents == null ? "—" : `${money(p.amountCents)}/month`}
                </span>
                <input
                  type="radio"
                  name="package_code"
                  value={p.code}
                  checked={packageCode === p.code}
                  onChange={() => choosePackage(p)}
                />
              </span>
            </label>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>2. About your child</CardTitle>
        <NameFields prefix="" values={v} required />
        <Field label="Date of birth" htmlFor="date_of_birth">
          <Input id="date_of_birth" name="date_of_birth" type="date" defaultValue={v.date_of_birth} required />
        </Field>
        <Field label="Grade in 2026" htmlFor="grade_code">
          <Select id="grade_code" name="grade_code" defaultValue={v.grade_code ?? ""} required>
            <option value="">Select a grade</option>
            {grades.map((g) => (
              <option key={g.code} value={g.code}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="School they attend" htmlFor="school_name">
          <Input id="school_name" name="school_name" defaultValue={v.school_name} />
        </Field>
        <Field label="Home language" htmlFor="home_language_code">
          <Select id="home_language_code" name="home_language_code" defaultValue={v.home_language_code ?? ""}>
            <option value="">Prefer not to say</option>
            {languages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="You are their" htmlFor="relationship">
          <Select id="relationship" name="relationship" defaultValue={v.relationship || "mother"}>
            {["mother", "father", "grandparent", "guardian", "other"].map((r) => (
              <option key={r} value={r}>
                {r[0].toUpperCase() + r.slice(1)}
              </option>
            ))}
          </Select>
        </Field>
      </Card>

      <Card>
        <CardTitle>3. Subjects</CardTitle>
        <p className="text-[11px] text-muted">
          {allowance
            ? `${pkg?.name} covers ${allowance} subject${allowance === 1 ? "" : "s"}. Choose more and we will move you to a package that covers them.`
            : `${pkg?.name ?? "This package"} covers all subjects.`}{" "}
          You can choose the language each subject is taught in. Mathematics in English and Physical
          Sciences in Afrikaans is a normal combination.
        </p>
        {upgradedTo ? (
          <FormMessage tone="success">
            You chose {chosen.length} subjects, so we moved you to {upgradedTo}. Check the price in step 1.
          </FormMessage>
        ) : null}
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
                    onChange={() => toggle(s.code)}
                  />
                  <span>{s.name}</span>
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
              {t.fullName}
            </option>
          ))}
        </Select>
      </Card>

      <Card>
        <CardTitle>5. Keeping your child safe</CardTitle>
        <p className="text-[11px] text-muted">
          We need someone we can reach in an emergency. You can also name people allowed to collect your
          child.
        </p>

        <p className="pt-2 text-[12px] font-bold text-ink">Emergency contact</p>
        <SelfToggle
          name="ec_self"
          checked={ecSelf}
          onChange={setEcSelf}
          label="I am the emergency contact"
          me={me}
          phoneName="self_phone"
          phoneValue={v.self_phone}
        />
        {ecSelf ? (
          <p className="text-[11px] text-muted">
            Please add a second person we can call if we cannot reach you.
          </p>
        ) : null}
        <ContactFields
          prefix="ec_"
          values={v}
          required
          heading={ecSelf ? "Second emergency contact" : undefined}
          relationshipPlaceholder="Aunt, grandparent…"
        />

        <p className="pt-4 text-[12px] font-bold text-ink">Authorised to collect (optional)</p>
        <SelfToggle
          name="col_self"
          checked={colSelf}
          onChange={setColSelf}
          label="I am authorised to collect my child"
          me={me}
          // One phone field serves both toggles; only render it once.
          phoneName={ecSelf ? undefined : "self_phone"}
          phoneValue={v.self_phone}
        />
        <ContactFields
          prefix="col_"
          values={v}
          heading={colSelf ? "Another person authorised to collect (optional)" : undefined}
        >
          <Field label="Last 4 digits of their ID" htmlFor="col_id_number_last4">
            <Input
              id="col_id_number_last4"
              name="col_id_number_last4"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              placeholder="4821"
              defaultValue={v.col_id4}
            />
          </Field>
          <p className="text-[11px] text-muted">
            Four digits only — enough to check at the door, not enough to be worth stealing.
          </p>
        </ContactFields>
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

function NameFields({
  prefix,
  values,
  required,
}: {
  prefix: string;
  values: Record<string, string>;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <Field label="First name" htmlFor={`${prefix}first_name`} className="flex-1">
        <Input
          id={`${prefix}first_name`}
          name={`${prefix}first_name`}
          defaultValue={values[`${prefix}first_name`]}
          required={required}
        />
      </Field>
      <Field label="Last name" htmlFor={`${prefix}last_name`} className="flex-1">
        <Input
          id={`${prefix}last_name`}
          name={`${prefix}last_name`}
          defaultValue={values[`${prefix}last_name`]}
          required={required}
        />
      </Field>
    </div>
  );
}

function ContactFields({
  prefix,
  values,
  required,
  heading,
  relationshipPlaceholder,
  children,
}: {
  prefix: string;
  values: Record<string, string>;
  required?: boolean;
  heading?: string;
  relationshipPlaceholder?: string;
  children?: ReactNode;
}) {
  return (
    <>
      {heading ? <p className="pt-2 text-[12px] font-semibold text-ink">{heading}</p> : null}
      <NameFields prefix={prefix} values={values} required={required} />
      <Field label="Relationship to your child" htmlFor={`${prefix}relationship`}>
        <Input
          id={`${prefix}relationship`}
          name={`${prefix}relationship`}
          placeholder={relationshipPlaceholder}
          defaultValue={values[`${prefix}relationship`]}
        />
      </Field>
      <Field label="Phone" htmlFor={`${prefix}phone`}>
        <Input
          id={`${prefix}phone`}
          name={`${prefix}phone`}
          type="tel"
          defaultValue={values[`${prefix}phone`]}
          required={required}
        />
      </Field>
      {children}
    </>
  );
}

function SelfToggle({
  name,
  checked,
  onChange,
  label,
  me,
  phoneName,
  phoneValue,
}: {
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  me: { fullName: string; phone: string };
  phoneName?: string;
  phoneValue?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-[8px] border border-line p-3">
      <label className="flex items-center gap-2 text-[13px] text-ink">
        <input type="checkbox" name={name} checked={checked} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
      {checked ? (
        <p className="text-[12px] text-muted">
          {me.fullName}
          {me.phone ? ` · ${me.phone}` : ""}
        </p>
      ) : null}
      {checked && !me.phone && phoneName ? (
        <Field label="Your phone number" htmlFor={phoneName}>
          <Input id={phoneName} name={phoneName} type="tel" defaultValue={phoneValue} required />
        </Field>
      ) : null}
    </div>
  );
}
