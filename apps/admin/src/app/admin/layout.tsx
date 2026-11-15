import { AppShell } from "@skolopals/ui/app-shell";
import { isSuperAdminRole, requireAdmin } from "@skolopals/shared/auth";
import { signOut } from "@/app/(auth)/actions";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { profile, roles } = await requireAdmin();
  const isSuperAdmin = isSuperAdminRole(roles);
  return (
    <AppShell
      profile={profile}
      role={isSuperAdmin ? "superadmin" : "admin"}
      subtitle={isSuperAdmin ? "Super Administrator" : "Administrator"}
      signOutAction={signOut}
    >
      {children}
    </AppShell>
  );
}
