import { AppShell } from "@skolopals/ui/app-shell";
import { requireClientRole } from "@skolopals/shared/auth";
import { signOut } from "@/app/(auth)/actions";

export default async function TutorLayout({ children }: LayoutProps<"/tutor">) {
  const { profile } = await requireClientRole("tutor");
  return (
    <AppShell profile={profile} role="tutor" subtitle="Tutor" signOutAction={signOut} helpHref="/contact">
      {children}
    </AppShell>
  );
}
