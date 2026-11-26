"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { Button, Card, CardTitle, DetailRow, Field, FieldRow, FormMessage, Input, Select, Switch, cx } from "@skolopals/ui/ui";
import { Stepper } from "@skolopals/ui/stepper";
import { UploadField, type UploadedFile } from "@/components/uploads/upload-field";
import { submitTutorApplication, type TutorApplicationPayload } from "./actions";

type Option = { code: string; name: string };
type Grade = Option & { sortOrder: number };

const STEPS = [
  { id: "about", label: "About you" },
  { id: "address", label: "Address" },
  { id: "subjects", label: "Subjects" },
  { id: "documents", label: "CV & qualifications" },
  { id: "identity", label: "Identity" },
  { id: "references", label: "References" },
  { id: "review", label: "Review" },
];

const MAX_QUALIFICATIONS = 3;
const SA = "South Africa";

type SubjectRow = { key: number; subjectCode: string; grades: string[]; languages: string[] };
type Qualification = { key: number; file: UploadedFile | null; title: string; institution: string; year: string };
type Reference = { fullName: string; relationship: string; phone: string; email: string };

const emptyReference = (): Reference => ({ fullName: "", relationship: "", phone: "", email: "" });

/**
 * The tutor application (SPEC-2026-11-tutor-applications.md §3.3). Like the
 * enrolment wizard, every step stays mounted and only the current one is
 * shown, so values survive going back and forth; each step is checked before
 * Next. The payload is nested (subjects, documents, references), so it is
 * sent to the server action as an object rather than as flat form fields.
 */
export function ApplyForm({
  subjects,
  grades,
  offerings,
  media,
  provinces,
  needs,
  policeClearanceRequired,
  me,
}: {
  subjects: Option[];
  grades: Grade[];
  /** subject code → grade codes the centre offers it at. */
  offerings: Record<string, string[]>;
  /** Languages the centre teaches in. */
  media: Option[];
  provinces: readonly string[];
  /** Subject codes the centre is short of this round, listed first. */
  needs: string[];
  policeClearanceRequired: boolean;
  me: { firstName: string; lastName: string; email: string; phone: string };
}) {
  const form = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  // Step 1–2
  const [firstName, setFirstName] = useState(me.firstName);
  const [lastName, setLastName] = useState(me.lastName);
  const [phone, setPhone] = useState(me.phone);
  const [sameWhatsApp, setSameWhatsApp] = useState(true);
  const [whatsapp, setWhatsapp] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState(SA);
  const [province, setProvince] = useState("");

  // Step 3
  const nextKey = useRef(1);
  const [rows, setRows] = useState<SubjectRow[]>([{ key: 0, subjectCode: "", grades: [], languages: [] }]);

  // Step 4–5
  const [cv, setCv] = useState<UploadedFile | null>(null);
  const [qualifications, setQualifications] = useState<Qualification[]>([
    { key: 0, file: null, title: "", institution: "", year: "" },
  ]);
  const [idFront, setIdFront] = useState<UploadedFile | null>(null);
  const [idBack, setIdBack] = useState<UploadedFile | null>(null);
  const [selfie, setSelfie] = useState<UploadedFile | null>(null);
  const [clearance, setClearance] = useState<UploadedFile | null>(null);

  // Step 6–7
  const [references, setReferences] = useState<Reference[]>([emptyReference(), emptyReference(), emptyReference()]);
  const [consents, setConsents] = useState({ popia: false, referencesAgreed: false, declaration: false });

  const needed = new Set(needs);
  const orderedSubjects = [...subjects.filter((s) => needed.has(s.code)), ...subjects.filter((s) => !needed.has(s.code))].filter(
    (s) => (offerings[s.code] ?? []).length > 0,
  );
  const subjectName = new Map(subjects.map((s) => [s.code, s.name]));
  const gradeName = new Map(grades.map((g) => [g.code, g.name]));
  const mediaName = new Map(media.map((m) => [m.code, m.name]));
  const gradeOrder = new Map(grades.map((g) => [g.code, g.sortOrder]));

  const updateRow = (key: number, patch: Partial<SubjectRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const toggleIn = (list: string[], code: string) => (list.includes(code) ? list.filter((c) => c !== code) : [...list, code]);
  const updateQualification = (key: number, patch: Partial<Qualification>) =>
    setQualifications((prev) => prev.map((q) => (q.key === key ? { ...q, ...patch } : q)));
  const updateReference = (i: number, patch: Partial<Reference>) =>
    setReferences((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  /** The browser's own validation for this step's fields, plus the rules it cannot express. */
  function stepIsValid(index: number) {
    const section = form.current?.querySelector<HTMLElement>(`[data-step="${index}"]`);
    const invalid = Array.from(
      section?.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input:not([type=file]), select") ?? [],
    ).find((el) => !el.checkValidity());
    if (invalid) {
      invalid.reportValidity();
      return false;
    }
    const fail = (message: string) => {
      setStepError(message);
      return false;
    };
    switch (STEPS[index]?.id) {
      case "subjects": {
        const filled = rows.filter((r) => r.subjectCode);
        if (filled.length === 0) return fail("Choose at least one subject you can teach.");
        if (filled.some((r) => r.grades.length === 0)) return fail("Tick at least one grade for each subject.");
        if (filled.some((r) => r.languages.length === 0)) return fail("Tick at least one teaching language for each subject.");
        const codes = filled.map((r) => r.subjectCode);
        if (new Set(codes).size !== codes.length) return fail("Each subject appears twice. Put all its grades in one row.");
        return true;
      }
      case "documents":
        if (!cv) return fail("Upload your CV.");
        if (!qualifications.some((q) => q.file)) return fail("Upload at least one qualification.");
        if (qualifications.some((q) => q.file && !q.title.trim())) return fail("Give each qualification a title.");
        return true;
      case "identity":
        if (!idFront) return fail("Upload a photo of your ID.");
        if (!selfie) return fail("Take a selfie.");
        if (policeClearanceRequired && !clearance) return fail("Upload your police clearance certificate.");
        return true;
      case "references": {
        const phones = references.map((r) => r.phone.replace(/\D/g, ""));
        if (new Set(phones).size !== phones.length) return fail("Each reference needs a different phone number.");
        return true;
      }
      default:
        return true;
    }
  }

  function go(to: number) {
    setStepError(null);
    setSubmitError(null);
    if (to > step && !stepIsValid(step)) return;
    setStep(to);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function payload(): TutorApplicationPayload {
    const documents: TutorApplicationPayload["documents"] = [];
    if (cv) documents.push({ ...cv, docType: "cv" });
    for (const q of qualifications) {
      if (!q.file) continue;
      documents.push({
        ...q.file,
        docType: "qualification",
        title: q.title.trim(),
        institution: q.institution.trim() || undefined,
        yearAwarded: q.year ? Number(q.year) : undefined,
      });
    }
    if (idFront) documents.push({ ...idFront, docType: "id" });
    if (idBack) documents.push({ ...idBack, docType: "id_back" });
    if (selfie) documents.push({ ...selfie, docType: "selfie" });
    if (clearance) documents.push({ ...clearance, docType: "police_clearance" });

    return {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      whatsappNumber: sameWhatsApp ? undefined : whatsapp.trim(),
      address: { line1: line1.trim(), line2: line2.trim(), city: city.trim(), province: province.trim(), country: country.trim() || SA },
      competencies: rows
        .filter((r) => r.subjectCode)
        .map((r) => ({ subjectCode: r.subjectCode, gradeCodes: r.grades, languageCodes: r.languages })),
      documents,
      references: references.map((r) => ({
        fullName: r.fullName.trim(),
        relationship: r.relationship.trim(),
        phone: r.phone.trim(),
        email: r.email.trim() || undefined,
      })),
      consents,
    };
  }

  function submit() {
    setSubmitError(null);
    if (!consents.popia || !consents.referencesAgreed || !consents.declaration) {
      setSubmitError("Tick all three statements to send your application.");
      return;
    }
    startTransition(async () => {
      const result = await submitTutorApplication(payload());
      if (result.error) setSubmitError(result.error);
      else setSent(true);
    });
  }

  if (sent) {
    return (
      <Card>
        <CardTitle>Application sent</CardTitle>
        <p className="text-[14px] leading-[1.6] text-ink">
          Thank you, {firstName}. The centre has your application and will be in touch. You can check its status on this
          page at any time.
        </p>
      </Card>
    );
  }

  const last = step === STEPS.length - 1;
  const gradesLabel = (codes: string[]) =>
    [...codes]
      .sort((a, b) => (gradeOrder.get(a) ?? 0) - (gradeOrder.get(b) ?? 0))
      .map((c) => gradeName.get(c) ?? c)
      .join(", ");

  return (
    <form
      ref={form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (last) submit();
        else go(step + 1);
      }}
      className="flex flex-col gap-5"
    >
      <Stepper steps={STEPS} current={step} onSelect={(i) => i < step && go(i)} label="Application steps" />

      <Section index={0} step={step} title="About you">
        <FieldRow>
          <Field label="First name" htmlFor="first_name">
            <Input id="first_name" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </Field>
          <Field label="Last name" htmlFor="last_name">
            <Input id="last_name" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </Field>
        </FieldRow>
        <Field label="Email" htmlFor="email" hint="From your account. We’ll use it to contact you about this application.">
          <Input id="email" value={me.email} readOnly disabled />
        </Field>
        <Field label="Phone number" htmlFor="phone">
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="072 123 4567"
            pattern="[0-9 +()\-]{10,16}"
            title="A South African phone number, for example 072 123 4567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </Field>
        <Switch
          checked={sameWhatsApp}
          onChange={(e) => setSameWhatsApp(e.target.checked)}
          label="My WhatsApp number is the same"
        />
        {sameWhatsApp ? null : (
          <Field label="WhatsApp number" htmlFor="whatsapp" hint="Include the country code if it isn’t a South African number, e.g. +44 7700 900123.">
            <Input
              id="whatsapp"
              type="tel"
              inputMode="tel"
              placeholder="072 123 4567"
              pattern="[0-9 +()\-]{10,18}"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              required
            />
          </Field>
        )}
      </Section>

      <Section index={1} step={step} title="Your address">
        <Field label="Address line 1" htmlFor="line1">
          <Input id="line1" autoComplete="address-line1" placeholder="12 Mampe Street" value={line1} onChange={(e) => setLine1(e.target.value)} required />
        </Field>
        <Field label="Address line 2 (optional)" htmlFor="line2">
          <Input id="line2" autoComplete="address-line2" placeholder="Unit, complex or suburb" value={line2} onChange={(e) => setLine2(e.target.value)} />
        </Field>
        <FieldRow>
          <Field label="Town / City" htmlFor="city">
            <Input id="city" autoComplete="address-level2" placeholder="Brits" value={city} onChange={(e) => setCity(e.target.value)} required />
          </Field>
          {country.trim().toLowerCase() === SA.toLowerCase() ? (
            <Field label="Province" htmlFor="province">
              <Select id="province" value={province} onChange={(e) => setProvince(e.target.value)} required>
                <option value="">Select a province</option>
                {provinces.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="Province / region" htmlFor="province">
              <Input id="province" autoComplete="address-level1" value={province} onChange={(e) => setProvince(e.target.value)} required />
            </Field>
          )}
        </FieldRow>
        <Field label="Country" htmlFor="country">
          <Input
            id="country"
            autoComplete="country-name"
            value={country}
            onChange={(e) => {
              // A province chosen from the South African list means nothing elsewhere.
              if ((e.target.value.trim().toLowerCase() === SA.toLowerCase()) !== (country.trim().toLowerCase() === SA.toLowerCase())) {
                setProvince("");
              }
              setCountry(e.target.value);
            }}
            required
          />
        </Field>
      </Section>

      <Section index={2} step={step} title="What you can teach">
        <p className="text-[13px] leading-[1.6] text-muted">
          Add each subject once, tick the grades you can teach it at and the languages you can teach it in.
          {needs.length > 0 ? " Subjects marked Needed are the ones we’re most short of." : ""}
        </p>
        {rows.map((row, i) => {
          const offered = offerings[row.subjectCode] ?? [];
          return (
            <div key={row.key} className="flex flex-col gap-3 rounded-[10px] border border-line p-4">
              <div className="flex items-end gap-3">
                <Field label={`Subject ${i + 1}`} htmlFor={`subject-${row.key}`} className="flex-1">
                  <Select
                    id={`subject-${row.key}`}
                    value={row.subjectCode}
                    onChange={(e) => updateRow(row.key, { subjectCode: e.target.value, grades: [] })}
                    required={i === 0}
                  >
                    <option value="">Select a subject</option>
                    {orderedSubjects.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.name}
                        {needed.has(s.code) ? " (Needed)" : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
                {rows.length > 1 ? (
                  <Button type="button" variant="secondary" onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}>
                    Remove
                  </Button>
                ) : null}
              </div>
              {row.subjectCode ? (
                <>
                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-1 text-[12px] font-semibold text-ink">Grades</legend>
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      {grades
                        .filter((g) => offered.includes(g.code))
                        .map((g) => (
                          <label key={g.code} className="flex min-h-9 items-center gap-2 text-[13px] text-ink">
                            <input
                              type="checkbox"
                              checked={row.grades.includes(g.code)}
                              onChange={() => updateRow(row.key, { grades: toggleIn(row.grades, g.code) })}
                            />
                            {g.name}
                          </label>
                        ))}
                    </div>
                  </fieldset>
                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-1 text-[12px] font-semibold text-ink">Languages you can teach it in</legend>
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      {media.map((m) => (
                        <label key={m.code} className="flex min-h-9 items-center gap-2 text-[13px] text-ink">
                          <input
                            type="checkbox"
                            checked={row.languages.includes(m.code)}
                            onChange={() => updateRow(row.key, { languages: toggleIn(row.languages, m.code) })}
                          />
                          {m.name}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </>
              ) : null}
            </div>
          );
        })}
        <Button
          type="button"
          variant="secondary"
          className="w-fit"
          onClick={() => setRows((prev) => [...prev, { key: nextKey.current++, subjectCode: "", grades: [], languages: [] }])}
        >
          Add another subject
        </Button>
      </Section>

      <Section index={3} step={step} title="CV and qualifications">
        <UploadField purpose="tutor_cv" label="CV / resume" value={cv} onChange={setCv} />
        {qualifications.map((q, i) => (
          <div key={q.key} className="flex flex-col gap-3 rounded-[10px] border border-line p-4">
            <UploadField
              purpose="tutor_qualification"
              label={`Qualification ${i + 1}`}
              hint="A degree, diploma or certificate. A clear photo of the certificate is fine."
              value={q.file}
              onChange={(file) => updateQualification(q.key, { file })}
            />
            <Field label="Title" htmlFor={`q-title-${q.key}`}>
              <Input
                id={`q-title-${q.key}`}
                placeholder="BEd Senior Phase and FET"
                value={q.title}
                onChange={(e) => updateQualification(q.key, { title: e.target.value })}
                required={!!q.file}
              />
            </Field>
            <FieldRow>
              <Field label="Institution (optional)" htmlFor={`q-inst-${q.key}`}>
                <Input
                  id={`q-inst-${q.key}`}
                  placeholder="North-West University"
                  value={q.institution}
                  onChange={(e) => updateQualification(q.key, { institution: e.target.value })}
                />
              </Field>
              <Field label="Year (optional)" htmlFor={`q-year-${q.key}`}>
                <Input
                  id={`q-year-${q.key}`}
                  type="number"
                  inputMode="numeric"
                  min={1950}
                  max={new Date().getFullYear()}
                  value={q.year}
                  onChange={(e) => updateQualification(q.key, { year: e.target.value })}
                />
              </Field>
            </FieldRow>
            {qualifications.length > 1 ? (
              <Button
                type="button"
                variant="secondary"
                className="w-fit"
                onClick={() => setQualifications((prev) => prev.filter((x) => x.key !== q.key))}
              >
                Remove this qualification
              </Button>
            ) : null}
          </div>
        ))}
        {qualifications.length < MAX_QUALIFICATIONS ? (
          <Button
            type="button"
            variant="secondary"
            className="w-fit"
            onClick={() =>
              setQualifications((prev) => [...prev, { key: nextKey.current++, file: null, title: "", institution: "", year: "" }])
            }
          >
            Add another qualification
          </Button>
        ) : null}
      </Section>

      <Section index={4} step={step} title="Confirm who you are">
        <p className="text-[13px] leading-[1.6] text-muted">
          The centre compares your ID with your selfie to confirm it’s really you. Only the centre’s administrators can see
          these, and they’re never shown on your public profile.
        </p>
        <UploadField
          purpose="tutor_id_document"
          label="Photo of your ID"
          hint="The front of your smart ID card, or the photo page of your green ID book or passport. Make sure every corner is in the picture."
          value={idFront}
          onChange={setIdFront}
        />
        <UploadField
          purpose="tutor_id_document"
          label="Back of your smart ID card (optional)"
          value={idBack}
          onChange={setIdBack}
        />
        <UploadField
          purpose="tutor_selfie"
          label="Selfie"
          hint="Face the camera in good light, with no hat or sunglasses."
          capture="user"
          photoOnly
          value={selfie}
          onChange={setSelfie}
        />
        {policeClearanceRequired ? (
          <UploadField
            purpose="tutor_police_clearance"
            label="Police clearance certificate"
            hint="Required this round. A PDF or a clear photo of your SAPS certificate."
            value={clearance}
            onChange={setClearance}
          />
        ) : null}
      </Section>

      <Section index={5} step={step} title="Three references">
        <p className="text-[13px] leading-[1.6] text-muted">
          People who know your work, such as a principal, head of department or colleague. Ask them first: we will phone them.
        </p>
        {references.map((r, i) => (
          <fieldset key={i} className="flex flex-col gap-3 rounded-[10px] border border-line p-4">
            <legend className="px-1 text-[13px] font-bold text-ink">Reference {i + 1}</legend>
            <FieldRow>
              <Field label="Full name" htmlFor={`ref-name-${i}`}>
                <Input id={`ref-name-${i}`} value={r.fullName} onChange={(e) => updateReference(i, { fullName: e.target.value })} required />
              </Field>
              <Field label="How they know you" htmlFor={`ref-rel-${i}`}>
                <Input
                  id={`ref-rel-${i}`}
                  placeholder="Former principal"
                  value={r.relationship}
                  onChange={(e) => updateReference(i, { relationship: e.target.value })}
                  required
                />
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="Phone number" htmlFor={`ref-phone-${i}`}>
                <Input
                  id={`ref-phone-${i}`}
                  type="tel"
                  inputMode="tel"
                  pattern="[0-9 +()\-]{10,18}"
                  value={r.phone}
                  onChange={(e) => updateReference(i, { phone: e.target.value })}
                  required
                />
              </Field>
              <Field label="Email (optional)" htmlFor={`ref-email-${i}`}>
                <Input id={`ref-email-${i}`} type="email" value={r.email} onChange={(e) => updateReference(i, { email: e.target.value })} />
              </Field>
            </FieldRow>
          </fieldset>
        ))}
      </Section>

      <Section index={6} step={step} title="Check and send">
        <Summary title="About you" onEdit={() => go(0)}>
          <DetailRow label="Name" value={`${firstName} ${lastName}`} />
          <DetailRow label="Phone" value={phone} />
          <DetailRow label="WhatsApp" value={sameWhatsApp ? "Same as phone" : whatsapp} />
          <DetailRow label="Address" value={[line1, line2, city, province, country].filter((x) => x.trim()).join(", ")} />
        </Summary>
        <Summary title="Subjects" onEdit={() => go(2)}>
          {rows
            .filter((r) => r.subjectCode)
            .map((r) => (
              <DetailRow
                key={r.key}
                label={subjectName.get(r.subjectCode) ?? r.subjectCode}
                value={`${gradesLabel(r.grades)} · ${r.languages.map((l) => mediaName.get(l) ?? l).join(", ")}`}
              />
            ))}
        </Summary>
        <Summary title="Documents" onEdit={() => go(3)}>
          <DetailRow label="CV" value={cv?.originalName ?? "—"} />
          {qualifications
            .filter((q) => q.file)
            .map((q) => (
              <DetailRow key={q.key} label="Qualification" value={q.title} />
            ))}
          <DetailRow label="ID" value={idFront ? `✓ ${idBack ? "front and back" : "front"}` : "—"} />
          <DetailRow label="Selfie" value={selfie ? "✓" : "—"} />
          {policeClearanceRequired ? <DetailRow label="Police clearance" value={clearance ? "✓" : "—"} /> : null}
        </Summary>
        <Summary title="References" onEdit={() => go(5)}>
          {references.map((r, i) => (
            <DetailRow key={i} label={r.fullName || `Reference ${i + 1}`} value={`${r.relationship} · ${r.phone}`} />
          ))}
        </Summary>

        <div className="flex flex-col gap-2">
          <Consent
            checked={consents.popia}
            onChange={(popia) => setConsents((c) => ({ ...c, popia }))}
            label="I agree that Skolopals may process my information, including my ID and photo, to assess my application and confirm who I am."
            hint="Only the centre’s administrators see it. If your application isn’t successful, it is deleted 12 months after the decision."
          />
          <Consent
            checked={consents.referencesAgreed}
            onChange={(referencesAgreed) => setConsents((c) => ({ ...c, referencesAgreed }))}
            label="My references have agreed to be contacted."
          />
          <Consent
            checked={consents.declaration}
            onChange={(declaration) => setConsents((c) => ({ ...c, declaration }))}
            label="The information I’ve given is true."
          />
        </div>
      </Section>

      {stepError ? <FormMessage>{stepError}</FormMessage> : null}
      {submitError ? <FormMessage>{submitError}</FormMessage> : null}

      <div className="flex flex-wrap justify-between gap-3">
        {step > 0 ? (
          <Button type="button" variant="secondary" onClick={() => go(step - 1)} disabled={pending}>
            Back
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={pending}>
          {last ? (pending ? "Sending…" : "Send application") : "Next"}
        </Button>
      </div>
    </form>
  );
}

function Section({ index, step, title, children }: { index: number; step: number; title: string; children: ReactNode }) {
  return (
    <section data-step={index} className={cx(step !== index && "hidden")}>
      <Card>
        <CardTitle>{title}</CardTitle>
        {children}
      </Card>
    </section>
  );
}

function Summary({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-line p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[14px] font-bold text-ink">{title}</h3>
        <button type="button" onClick={onEdit} className="text-[13px] text-link hover:underline">
          Edit
        </button>
      </div>
      {children}
    </div>
  );
}

function Consent({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-3 rounded-[8px] border border-line p-3">
      <input type="checkbox" className="mt-1" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="flex flex-col gap-1">
        <span className="text-[13px] font-bold text-ink">{label}</span>
        {hint ? <span className="text-[12px] text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}
