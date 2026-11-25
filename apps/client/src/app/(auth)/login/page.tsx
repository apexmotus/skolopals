import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Login" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, confirm } = await searchParams;
  // /auth/confirm sends people here when an emailed link (confirmation, invite or reset) fails.
  const notice = confirm === "failed" ? "That link has expired or has already been used. Log in, or ask for a new link." : "";
  return <LoginForm next={typeof next === "string" ? next : ""} notice={notice} />;
}
