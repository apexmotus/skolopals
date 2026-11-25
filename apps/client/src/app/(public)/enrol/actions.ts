"use server";

import { redirect } from "next/navigation";
import { api, ApiError } from "@skolopals/shared/api";
import { getSession } from "@skolopals/shared/auth";
import { POLICY_VERSION } from "@/lib/consent";

export type EnrolState = { error?: string; values?: Record<string, string> };

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const joinName = (first: string, last: string) => [first, last].filter(Boolean).join(" ");

export async function submitEnrolment(_prev: EnrolState, formData: FormData): Promise<EnrolState> {
  const session = await getSession();
  if (!session) redirect("/login?next=/enrol");
  if (!session.roles.includes("parent")) {
    return { error: "Only a parent or guardian can enrol a learner." };
  }

  const values = {
    package_code: text(formData, "package_code"),
    first_name: text(formData, "first_name"),
    last_name: text(formData, "last_name"),
    date_of_birth: text(formData, "date_of_birth"),
    grade_code: text(formData, "grade_code"),
    school_name: text(formData, "school_name"),
    home_language_code: text(formData, "home_language_code"),
    relationship: text(formData, "relationship"),
    ec_self: text(formData, "ec_self"),
    ec_first_name: text(formData, "ec_first_name"),
    ec_last_name: text(formData, "ec_last_name"),
    ec_relationship: text(formData, "ec_relationship"),
    ec_phone: text(formData, "ec_phone"),
    col_self: text(formData, "col_self"),
    col_first_name: text(formData, "col_first_name"),
    col_last_name: text(formData, "col_last_name"),
    col_relationship: text(formData, "col_relationship"),
    col_phone: text(formData, "col_phone"),
    col_id4: text(formData, "col_id_number_last4"),
    self_phone: text(formData, "self_phone"),
    preferred_tutor: text(formData, "preferred_tutor"),
    report_path: text(formData, "report_path"),
    report_mime: text(formData, "report_mime"),
    report_size: text(formData, "report_size"),
    report_name: text(formData, "report_name"),
    report_year: text(formData, "report_year"),
    report_term: text(formData, "report_term"),
  };

  const ecSelf = values.ec_self === "on";
  const colSelf = values.col_self === "on";
  // The parent's own details come from their profile, never from the form.
  const selfName = session.profile.full_name;
  const selfPhone = session.profile.phone || values.self_phone;
  const selfRelationship = values.relationship || "guardian";

  if (!values.package_code) return { error: "Choose a package.", values };
  if (!values.first_name || !values.last_name) {
    return { error: "Enter your child’s first name and last name.", values };
  }
  if (!values.date_of_birth) return { error: "Enter your child’s date of birth.", values };
  if (!values.grade_code) return { error: "Choose your child’s grade.", values };
  // D3: a report card is required, no exceptions. The upload was checked by the API on confirm.
  if (!values.report_path) return { error: "Upload your child’s most recent school report.", values };
  if ((ecSelf || colSelf) && !selfPhone) {
    return { error: "Add your phone number so we can reach you.", values };
  }
  if (!values.ec_first_name || !values.ec_last_name || !values.ec_phone) {
    return {
      error: ecSelf
        ? "Add a second emergency contact’s first name, last name and phone number."
        : "An emergency contact’s first name, last name and phone number are required.",
      values,
    };
  }
  const colName = joinName(values.col_first_name, values.col_last_name);
  if (colName && !values.col_phone) {
    return { error: "Add a phone number for the person authorised to collect.", values };
  }
  // Staff check these digits at the door before handing a child to anyone but the parent.
  if (colName && !/^[0-9]{4}$/.test(values.col_id4)) {
    return { error: `Add the last four digits of ${colName}’s ID, so staff can check them at the door.`, values };
  }

  const emergency = [
    ...(ecSelf ? [{ full_name: selfName, relationship: selfRelationship, phone: selfPhone }] : []),
    {
      full_name: joinName(values.ec_first_name, values.ec_last_name),
      relationship: values.ec_relationship || "guardian",
      phone: values.ec_phone,
    },
  ].map((c, i) => ({ ...c, priority: i + 1 }));

  const collectors = [
    ...(colSelf
      ? [{ full_name: selfName, relationship: selfRelationship, phone: selfPhone, id_number_last4: "" }]
      : []),
    ...(colName
      ? [
          {
            full_name: colName,
            relationship: values.col_relationship || "family",
            phone: values.col_phone,
            id_number_last4: values.col_id4,
          },
        ]
      : []),
  ];

  // Subjects arrive as subject_code[] with a matching medium_<code> field.
  const subjects = formData
    .getAll("subject")
    .map(String)
    .filter(Boolean)
    .map((code) => ({
      subject_code: code,
      preferred_language_code: text(formData, `medium_${code}`),
    }));

  // Required consents must each be ticked. Optional ones are recorded as
  // given or withheld — never assumed, and never bundled with the rest.
  const required = formData.getAll("required_consent").map(String);
  const missing = required.filter((code) => formData.get(`consent_${code}`) !== "on");
  if (missing.length > 0) {
    return { error: "Please give each of the required consents to continue.", values };
  }
  const optional = formData.getAll("optional_consent").map(String);
  const consents = [
    ...required.map((code) => ({ consent_type_code: code, granted: true })),
    ...optional.map((code) => ({
      consent_type_code: code,
      granted: formData.get(`consent_${code}`) === "on",
    })),
  ];

  // POST /enrolments files the report card under the new learner in the same transaction.
  let enrolmentId: string;
  try {
    const enrolment = await api.post<{ id: string }>("/enrolments", {
      learner: {
        fullName: joinName(values.first_name, values.last_name),
        dateOfBirth: values.date_of_birth,
        gradeCode: values.grade_code,
        schoolName: values.school_name || undefined,
        homeLanguageCode: values.home_language_code || undefined,
        relationship: values.relationship || "guardian",
      },
      packageCode: values.package_code,
      subjects: subjects.map((s) => ({
        subjectCode: s.subject_code,
        preferredLanguageCode: s.preferred_language_code || undefined,
      })),
      emergencyContacts: emergency.map((c) => ({
        fullName: c.full_name,
        relationship: c.relationship,
        phone: c.phone,
        priority: c.priority,
      })),
      collectors: collectors.map((c) => ({
        fullName: c.full_name,
        relationship: c.relationship,
        phone: c.phone,
        idNumberLast4: c.id_number_last4 || undefined,
      })),
      consents: consents.map((c) => ({ consentTypeCode: c.consent_type_code, granted: c.granted })),
      policyVersion: POLICY_VERSION,
      preferredTutorId: values.preferred_tutor || undefined,
      reportCard: {
        path: values.report_path,
        mimeType: values.report_mime,
        sizeBytes: Number(values.report_size),
        originalName: values.report_name || "report-card",
        year: values.report_year ? Number(values.report_year) : undefined,
        term: values.report_term ? Number(values.report_term) : undefined,
      },
    });
    enrolmentId = enrolment.id;
  } catch (err) {
    return {
      error: err instanceof ApiError && err.status < 500 ? err.message : "We could not send the application. Please try again.",
      values,
    };
  }
  // The application is only sent for review once the aptitude test is done (SPEC §4.1 step 7).
  redirect(`/enrol/${enrolmentId}/assessment`);
}
