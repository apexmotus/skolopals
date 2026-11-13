import { AppShell } from "@skolopals/ui/app-shell";
import { requireAdmin } from "@skolopals/shared/auth";
import { signOut } from "@/app/(auth)/actions";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { profile } = await requireAdmin();
  return (
    <AppShell profile={profile} role="admin" subtitle="Administrator" signOutAction={signOut}>
      {children}
    </AppShell>
  );
}
