import { AppShell } from "@skolopals/ui/app-shell";
import { requireClientRole } from "@skolopals/shared/auth";
import { signOut } from "@/app/(auth)/actions";

export default async function LearnerLayout({ children }: LayoutProps<"/learner">) {
  const { profile } = await requireClientRole("learner");
  return (
    <AppShell profile={profile} role="learner" subtitle="Learner" signOutAction={signOut} helpHref="/contact">
      {children}
    </AppShell>
  );
}
