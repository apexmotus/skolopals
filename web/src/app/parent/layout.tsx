import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";

export default async function ParentLayout({ children }: LayoutProps<"/parent">) {
  const { profile } = await requireRole("parent");
  return (
    <AppShell profile={profile} role="parent" subtitle="Parent / guardian">
      {children}
    </AppShell>
  );
}
