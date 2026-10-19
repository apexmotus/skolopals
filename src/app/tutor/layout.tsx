import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";

export default async function TutorLayout({ children }: LayoutProps<"/tutor">) {
  const profile = await requireRole("tutor");
  return (
    <AppShell profile={profile} subtitle="Tutor">
      {children}
    </AppShell>
  );
}
