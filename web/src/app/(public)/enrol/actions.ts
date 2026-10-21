"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { POLICY_VERSION } from "@/lib/consent";

export type EnrolState = { error?: string; values?: Record<string, string> };

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function submitEnrolment(_prev: EnrolState, formData: FormData): Promise<EnrolState> {
  const session = await getSession();
  if (!session) redirect("/login?next=/enrol");

  const values = {
    package_code: text(formData, "package_code"),
    full_name: text(formData, "full_name"),
    date_of_birth: text(formData, "date_of_birth"),
    grade_code: text(formData, "grade_code"),
    school_name: text(formData, "school_name"),
    home_language_code: text(formData, "home_language_code"),
    relationship: text(formData, "relationship"),
    ec_name: text(formData, "ec_name"),
    ec_relationship: text(formData, "ec_relationship"),
    ec_phone: text(formData, "ec_phone"),
    col_name: text(formData, "col_name"),
    col_relationship: text(formData, "col_relationship"),
    col_phone: text(formData, "col_phone"),
    col_id4: text(formData, "col_id_number_last4"),
    preferred_tutor: text(formData, "preferred_tutor"),
  };

  if (!values.package_code) return { error: "Choose a package.", values };
  if (!values.full_name) return { error: "Enter your child’s full name.", values };
  if (!values.date_of_birth) return { error: "Enter your child’s date of birth.", values };
  if (!values.grade_code) return { error: "Choose your child’s grade.", values };
  if (!values.ec_name || !values.ec_phone) {
    return { error: "An emergency contact name and phone number are required.", values };
  }

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

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_enrolment", {
    p_learner: {
      full_name: values.full_name,
      date_of_birth: values.date_of_birth,
      grade_code: values.grade_code,
      school_name: values.school_name,
      home_language_code: values.home_language_code,
      relationship: values.relationship || "guardian",
    },
    p_package_code: values.package_code,
    p_subjects: subjects,
    p_emergency: [
      {
        full_name: values.ec_name,
        relationship: values.ec_relationship || "guardian",
        phone: values.ec_phone,
        priority: 1,
      },
    ],
    p_collectors: values.col_name
      ? [
          {
            full_name: values.col_name,
            relationship: values.col_relationship || "family",
            phone: values.col_phone,
            id_number_last4: values.col_id4,
          },
        ]
      : [],
    p_consents: consents,
    p_policy_version: POLICY_VERSION,
    p_preferred_tutor: values.preferred_tutor || null,
  });

  if (error) {
    return { error: error.message.replace(/^.*?:\s*/, "") || "We could not submit the enrolment.", values };
  }
  redirect("/enrol/submitted");
}
