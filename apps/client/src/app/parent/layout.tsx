import { AppShell } from "@skolopals/ui/app-shell";
import { requireClientRole } from "@skolopals/shared/auth";
import { signOut } from "@/app/(auth)/actions";

export default async function ParentLayout({ children }: LayoutProps<"/parent">) {
  const { profile } = await requireClientRole("parent");
  return (
    <AppShell profile={profile} role="parent" subtitle="Parent / guardian" signOutAction={signOut} helpHref="/contact">
      {children}
    </AppShell>
  );
}
