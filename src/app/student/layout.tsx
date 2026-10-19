import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";

export default async function StudentLayout({ children }: LayoutProps<"/student">) {
  const profile = await requireRole("student");
  return <AppShell profile={profile}>{children}</AppShell>;
}
