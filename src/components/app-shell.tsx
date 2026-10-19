import Link from "next/link";
import type { ReactNode } from "react";
import {
  AppWindow,
  Bell,
  Calendar,
  ChartColumn,
  History,
  LayoutDashboard,
  MessagesSquare,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";
import { NavLink } from "@/components/nav-link";
import { initials } from "@/lib/format";
import type { Profile, UserRole } from "@/lib/database.types";
import { signOut } from "@/app/(auth)/actions";

// Icons exported from Figma live in /public/icons; the rest come from Lucide,
// the same icon set the design uses.
type NavIcon = { src: string } | { lucide: LucideIcon };
type NavItem = { href: string; label: string; icon: NavIcon; exact?: boolean };

const NAV: Record<UserRole, { workspace: string; items: NavItem[] }> = {
  student: {
    workspace: "Student workspace",
    items: [
      { href: "/student", label: "Overview", icon: { src: "/icons/chart-network.svg" }, exact: true },
      { href: "/student/upcoming", label: "Upcoming lessons", icon: { src: "/icons/calendar-plus.svg" } },
      { href: "/student/past", label: "Past lessons", icon: { src: "/icons/book-check.svg" } },
      { href: "/student/messages", label: "Messages", icon: { src: "/icons/message-square.svg" } },
      { href: "/student/progress", label: "Progress reports", icon: { src: "/icons/chart-line.svg" } },
      { href: "/student/resources", label: "Resources", icon: { src: "/icons/database.svg" } },
    ],
  },
  tutor: {
    workspace: "Tutor workspace",
    items: [
      { href: "/tutor", label: "Overview", icon: { src: "/icons/chart-network.svg" }, exact: true },
      { href: "/tutor/schedule", label: "Schedule", icon: { lucide: Calendar } },
      { href: "/tutor/earnings", label: "Earnings", icon: { src: "/icons/chart-line.svg" } },
      { href: "/tutor/requests", label: "Student requests", icon: { lucide: UserRoundCheck } },
      { href: "/tutor/history", label: "Lesson history", icon: { lucide: History } },
      { href: "/tutor/messages", label: "Messages", icon: { lucide: MessagesSquare } },
      { href: "/tutor/reviews", label: "Reviews", icon: { src: "/icons/message-square.svg" } },
      { href: "/tutor/application", label: "Application status", icon: { lucide: AppWindow } },
    ],
  },
  admin: {
    workspace: "Admin workspace",
    items: [
      { href: "/admin", label: "Dashboard", icon: { lucide: LayoutDashboard }, exact: true },
      { href: "/admin/applications", label: "Tutor applications", icon: { lucide: AppWindow } },
      { href: "/admin/tutors", label: "Tutor accounts", icon: { lucide: UserRoundCheck } },
      { href: "/admin/notifications", label: "Notifications", icon: { lucide: Bell } },
      { href: "/admin/reports", label: "Reports", icon: { lucide: ChartColumn } },
    ],
  },
};

function Icon({ icon }: { icon: NavIcon }) {
  if ("src" in icon) return <img src={icon.src} alt="" width={18} height={18} className="shrink-0" />;
  const L = icon.lucide;
  return <L aria-hidden size={18} strokeWidth={1} className="shrink-0 text-white" />;
}

export function AppShell({
  profile,
  subtitle,
  children,
}: {
  profile: Profile;
  subtitle?: string;
  children: ReactNode;
}) {
  const nav = NAV[profile.role];

  return (
    <div className="flex min-h-screen w-full flex-col md:flex-row">
      <aside className="flex w-full shrink-0 flex-col gap-[22px] bg-night p-5 md:sticky md:top-0 md:h-screen md:w-[220px]">
        <Link href="/" className="text-[21px] font-extrabold text-white">
          Skolopals
        </Link>
        <span className="w-fit rounded-full bg-white/[0.09] px-[10px] py-[5px] text-[11px] text-white">
          {nav.workspace}
        </span>
        <nav aria-label="Workspace" className="flex flex-row flex-wrap gap-[6px] md:flex-col md:flex-nowrap">
          {nav.items.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              exact={item.exact}
              className="flex items-start gap-[10px] rounded-[6px] px-3 py-[10px] text-[13px] text-white hover:bg-white/[0.05]"
              activeClassName="bg-white/[0.09] hover:bg-white/[0.09]"
            >
              <Icon icon={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden flex-1 md:block" />
        <div className="flex flex-col gap-[10px] rounded-[10px] border border-white/[0.08] bg-white/[0.05] p-3">
          <div className="flex items-center gap-[10px]">
            <span className="flex size-9 items-center justify-center rounded-[18px] bg-white/[0.08] text-[12px] font-bold text-white">
              {initials(profile.full_name || "?")}
            </span>
            <div className="flex min-w-0 flex-col gap-[2px]">
              <span className="truncate text-[13px] font-semibold text-white">{profile.full_name}</span>
              <span className="text-[11px] text-white/70">{subtitle ?? profile.grade_level ?? nav.workspace}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/contact" className="rounded-full bg-white/[0.07] px-[10px] py-[6px] text-[11px] font-semibold text-white">
              Help
            </Link>
            <form action={signOut}>
              <button className="rounded-full bg-white/[0.07] px-[10px] py-[6px] text-[11px] font-semibold text-white">
                Log out
              </button>
            </form>
          </div>
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col gap-5 p-4 md:p-[30px]">{children}</main>
    </div>
  );
}
