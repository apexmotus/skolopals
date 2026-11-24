import { AppShell } from "@skolopals/ui/app-shell";
import { isSuperAdminRole, requireAdmin } from "@skolopals/shared/auth";
import { signOut } from "@/app/(auth)/actions";
import { countProofsToCheck } from "@/lib/admin";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const [{ profile, roles }, proofs] = await Promise.all([requireAdmin(), countProofsToCheck()]);
  const isSuperAdmin = isSuperAdminRole(roles);
  return (
    <AppShell
      profile={profile}
      role={isSuperAdmin ? "superadmin" : "admin"}
      subtitle={isSuperAdmin ? "Super Administrator" : "Administrator"}
      signOutAction={signOut}
      badges={{ "/admin/payments": proofs }}
    >
      {children}
    </AppShell>
  );
}
