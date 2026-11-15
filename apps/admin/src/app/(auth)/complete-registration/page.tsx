import type { Metadata } from "next";
import { CompleteRegistrationForm } from "./complete-registration-form";

export const metadata: Metadata = { title: "Complete registration" };

export default function CompleteRegistrationPage() {
  return <CompleteRegistrationForm />;
}
