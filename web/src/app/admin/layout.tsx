import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { profile } = await requireRole("admin");
  return (
    <AppShell profile={profile} role="admin" subtitle="Administrator">
      {children}
    </AppShell>
  );
}
