import type { Metadata } from "next";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { role } = await searchParams;
  return <SignupForm defaultRole={role === "tutor" ? "tutor" : "student"} />;
}
