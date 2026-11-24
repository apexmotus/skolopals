"use client";

import { useActionState, useRef, useState, type ReactNode } from "react";
import { Button, Card, CardTitle, DetailRow, Field, FormMessage, Input, Select, cx } from "@skolopals/ui/ui";
import { Stepper } from "@skolopals/ui/stepper";
import { money } from "@skolopals/shared/format";
import { UploadField, type UploadedFile } from "@/components/uploads/upload-field";
import { submitEnrolment, type EnrolState } from "./actions";

type Option = { code: string; name: string };
type Pkg = Option & { subjectAllowance?: number; amountCents: number | null };
type ConsentType = { code: string; name: string; description: string; isRequired: boolean };
/** `GET /enrolments/quote` for a package, if accepted today. */
export type Quote = { registrationCents: number; tuitionCents: number; totalCents: number; daysCharged: number; daysInMonth: number };

const STEPS = [
  { id: "package", label: "Package" },
  { id: "child", label: "About your child" },
  { id: "report", label: "Report card" },
  { id: "subjects", label: "Subjects" },
  { id: "tutor", label: "Tutor" },
  { id: "safety", label: "Safety & consent" },
];

/** Covers `count` subjects: the first package, in display order, whose allowance is unlimited or big enough. */
const packageFor = (packages: Pkg[], count: number) =>
  packages.find((p) => p.subjectAllowance == null || p.subjectAllowance >= count);

/**
 * The application wizard (SPEC §4.1). Every step stays in one form and only
 * the current one is shown, so the values survive moving back and forth and
 * the submit action receives them all. Each step is checked before Next.
 */
export function EnrolForm({
  packages,
  grades,
  subjects,
  languages,
  media,
  tutors,
  consentTypes,
  defaultTutor,
  me,
  quotes,
  currentYear,
}: {
  packages: Pkg[];
  grades: Option[];
  subjects: Option[];
  languages: Option[];
  /** Languages the centre teaches in. `languages` is every official language, for home language. */
  media: Option[];
  tutors: { id: string; fullName: string }[];
  consentTypes: ConsentType[];
  defaultTutor?: string;
  me: { fullName: string; phone: string };
  quotes: Record<string, Quote>;
  currentYear: number;
}) {
  const [state, action, pending] = useActionState<EnrolState, FormData>(submitEnrolment, {});
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [packageCode, setPackageCode] = useState(packages[0]?.code ?? "");
  const [chosen, setChosen] = useState<string[]>([]);
  const [upgradedTo, setUpgradedTo] = useState<string | null>(null);
  const [ecSelf, setEcSelf] = useState(state.values?.ec_self === "on");
  const [colSelf, setColSelf] = useState(state.values?.col_self === "on");
  const [reportCard, setReportCard] = useState<UploadedFile | null>(null);
  const [childName, setChildName] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const v = state.values ?? {};

  const pkg = packages.find((p) => p.code === packageCode);
  const allowance = pkg?.subjectAllowance ?? null;
  const quote = quotes[packageCode];

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

  /** The browser's own validation for the fields on this step, plus the rules it cannot express. */
  function stepIsValid(index: number) {
    const section = form.current?.querySelector<HTMLElement>(`[data-step="${index}"]`);
    const invalid = Array.from(section?.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select") ?? []).find(
      (el) => !el.checkValidity(),
    );
    if (invalid) {
      invalid.reportValidity();
      return false;
    }
    if (STEPS[index]?.id === "report" && !reportCard) {
      setStepError("Upload your child’s most recent school report to continue.");
      return false;
    }
    if (STEPS[index]?.id === "subjects" && chosen.length === 0) {
      setStepError("Choose at least one subject.");
      return false;
    }
    return true;
  }

  function go(to: number) {
    setStepError(null);
    if (to > step && !stepIsValid(step)) return;
    if (to === STEPS.length - 1) {
      const field = (id: string) => form.current?.querySelector<HTMLInputElement>(`#${id}`)?.value ?? "";
      setChildName([field("first_name"), field("last_name")].filter(Boolean).join(" "));
    }
    setStep(to);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const required = consentTypes.filter((c) => c.isRequired);
  const optional = consentTypes.filter((c) => !c.isRequired);
  const last = step === STEPS.length - 1;

  return (
    <form
      ref={form}
      action={action}
      noValidate
      onSubmit={(e) => {
        if (!last || !stepIsValid(step)) e.preventDefault();
      }}
      className="flex flex-col gap-5"
    >
      <Stepper steps={STEPS} current={step} onSelect={(i) => i < step && go(i)} label="Application steps" />

      <section data-step={0} className={cx(step !== 0 && "hidden")}>
        <Card>
          <CardTitle>Choose a package</CardTitle>
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
                  <span className="text-[12px] text-muted">
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
      </section>

      <section data-step={1} className={cx(step !== 1 && "hidden")}>
        <Card>
          <CardTitle>About your child</CardTitle>
          <NameFields prefix="" values={v} required />
          <Field label="Date of birth" htmlFor="date_of_birth">
            <Input id="date_of_birth" name="date_of_birth" type="date" defaultValue={v.date_of_birth} required />
          </Field>
          <Field label={`Grade in ${currentYear}`} htmlFor="grade_code">
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
      </section>

      <section data-step={2} className={cx(step !== 2 && "hidden")}>
        <Card>
          <CardTitle>School report card</CardTitle>
          <p className="text-[13px] leading-[1.6] text-ink">
            Upload your child’s most recent school report. The centre reads it, with a short aptitude test, to decide
            on the application and where your child should start.
          </p>
          <UploadField
            purpose="report_card"
            label="Most recent report card"
            hint="No school report yet? Contact the centre before applying."
            value={reportCard}
            onChange={setReportCard}
          />
          <input type="hidden" name="report_path" value={reportCard?.path ?? ""} />
          <input type="hidden" name="report_mime" value={reportCard?.mimeType ?? ""} />
          <input type="hidden" name="report_size" value={reportCard?.sizeBytes ?? ""} />
          <input type="hidden" name="report_name" value={reportCard?.originalName ?? ""} />
          <div className="flex flex-col gap-4 sm:flex-row">
            <Field label="Year it covers" htmlFor="report_year" className="flex-1">
              <Select id="report_year" name="report_year" defaultValue={String(currentYear)} required>
                {[currentYear, currentYear - 1].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Term" htmlFor="report_term" className="flex-1">
              <Select id="report_term" name="report_term" defaultValue="" required>
                <option value="">Select a term</option>
                {[1, 2, 3, 4].map((t) => (
                  <option key={t} value={t}>
                    Term {t}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>
      </section>

      <section data-step={3} className={cx(step !== 3 && "hidden")}>
        <Card>
          <CardTitle>Subjects</CardTitle>
          <p className="text-[12px] text-muted">
            {allowance
              ? `${pkg?.name} covers ${allowance} subject${allowance === 1 ? "" : "s"}. Choose more and we will move you to a package that covers them.`
              : `${pkg?.name ?? "This package"} covers all subjects.`}{" "}
            You can choose the language each subject is taught in. Mathematics in English and Physical Sciences in
            Afrikaans is a normal combination.
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
                    <input type="checkbox" name="subject" value={s.code} checked={picked} onChange={() => toggle(s.code)} />
                    <span>{s.name}</span>
                  </label>
                  {picked ? (
                    <Select name={`medium_${s.code}`} defaultValue="english" className="max-w-[200px]">
                      {media.map((l) => (
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
      </section>

      <section data-step={4} className={cx(step !== 4 && "hidden")}>
        <Card>
          <CardTitle>Preferred tutor (optional)</CardTitle>
          <p className="text-[12px] text-muted">
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
      </section>

      <section data-step={5} className={cx("flex flex-col gap-5", step !== 5 && "hidden")}>
        <Card>
          <CardTitle>Keeping your child safe</CardTitle>
          <p className="text-[12px] text-muted">
            We need someone we can reach in an emergency. You can also name people allowed to collect your child.
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
            <p className="text-[12px] text-muted">Please add a second person we can call if we cannot reach you.</p>
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
            <p className="text-[12px] text-muted">
              Four digits only — enough to check at the door, not enough to be worth stealing.
            </p>
          </ContactFields>
        </Card>

        <Card>
          <CardTitle>Your permission</CardTitle>
          <p className="text-[12px] text-muted">
            The law requires a parent or guardian’s consent before we may process a child’s information. You can
            withdraw any of these at any time.
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
          <p className="text-[12px] text-muted">Declining an optional consent does not affect your child’s place.</p>
        </Card>

        <Card>
          <CardTitle>Check and send</CardTitle>
          <DetailRow label="Child" value={childName || "—"} />
          <DetailRow label="Package" value={pkg ? `${pkg.name}${pkg.amountCents != null ? ` · ${money(pkg.amountCents)}/month` : ""}` : "—"} />
          <DetailRow
            label="Subjects"
            value={subjects.filter((s) => chosen.includes(s.code)).map((s) => s.name).join(", ") || "—"}
          />
          <DetailRow label="Report card" value={reportCard?.originalName ?? "—"} />
          {quote ? (
            <p className="rounded-[10px] border-l-4 border-accent bg-white/[0.04] px-4 py-3 text-[13px] leading-[1.6] text-ink">
              If accepted today, your first payment would be <span className="font-bold">{money(quote.totalCents)}</span>
              {quote.registrationCents > 0 ? ` (${money(quote.registrationCents)} registration` : " ("}
              {quote.tuitionCents > 0
                ? `${quote.registrationCents > 0 ? " + " : ""}${money(quote.tuitionCents)} for the rest of this month, ${quote.daysCharged} of ${quote.daysInMonth} days`
                : ""}
              ). You only pay once the centre accepts the application; nothing is charged now.
            </p>
          ) : null}
          <p className="text-[12px] text-muted">
            After you send this, your child does a short aptitude test (about 20 minutes). You can do it now or later.
          </p>
        </Card>
      </section>

      {stepError ? <FormMessage>{stepError}</FormMessage> : null}
      {state.error && last ? <FormMessage>{state.error}</FormMessage> : null}
      <div className="flex flex-wrap gap-3">
        {step > 0 ? (
          <Button type="button" variant="secondary" onClick={() => go(step - 1)} disabled={pending}>
            Back
          </Button>
        ) : null}
        {last ? (
          <Button type="submit" disabled={pending}>
            {pending ? "Sending…" : "Send application"}
          </Button>
        ) : (
          <Button type="button" onClick={() => go(step + 1)}>
            Next
          </Button>
        )}
      </div>
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
