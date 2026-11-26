import { AppShell } from "@skolopals/ui/app-shell";
import { isSuperAdminRole, requireAdmin } from "@skolopals/shared/auth";
import { signOut } from "@/app/(auth)/actions";
import { countNewTutorApplications, countProofsToCheck } from "@/lib/admin";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const [{ profile, roles }, proofs, tutorApplications] = await Promise.all([
    requireAdmin(),
    countProofsToCheck(),
    countNewTutorApplications(),
  ]);
  const isSuperAdmin = isSuperAdminRole(roles);
  return (
    <AppShell
      profile={profile}
      role={isSuperAdmin ? "superadmin" : "admin"}
      subtitle={isSuperAdmin ? "Super Administrator" : "Administrator"}
      signOutAction={signOut}
      badges={{ "/admin/payments": proofs, "/admin/tutor-applications": tutorApplications }}
    >
      {children}
    </AppShell>
  );
}
