import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";

export default async function LearnerLayout({ children }: LayoutProps<"/learner">) {
  const { profile } = await requireRole("learner");
  return (
    <AppShell profile={profile} role="learner" subtitle="Learner">
      {children}
    </AppShell>
  );
}
