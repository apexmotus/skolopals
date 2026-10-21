import Link from "next/link";
import type { ReactNode } from "react";
import {
  Banknote,
  Bell,
  BookOpen,
  Calendar,
  ChartColumn,
  ClipboardCheck,
  FileText,
  GraduationCap,
  LayoutDashboard,
  MessagesSquare,
  Receipt,
  Users,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";
import { NavLink } from "@/components/nav-link";
import { Logo } from "@/components/logo";
import { initials } from "@/lib/format";
import type { AppRole, Row } from "@/lib/database.types";
import { signOut } from "@/app/(auth)/actions";

// Icons exported from Figma live in /public/icons; the rest come from Lucide,
// the same icon set the design uses.
type NavIcon = { src: string } | { lucide: LucideIcon };
type NavItem = { href: string; label: string; icon: NavIcon; exact?: boolean };

const NAV: Record<AppRole, { workspace: string; items: NavItem[] }> = {
  parent: {
    workspace: "Parent portal",
    items: [
      { href: "/parent", label: "Overview", icon: { src: "/icons/chart-network.svg" }, exact: true },
      { href: "/parent/learners", label: "My learners", icon: { lucide: Users } },
      { href: "/parent/timetable", label: "Timetable", icon: { lucide: Calendar } },
      { href: "/parent/attendance", label: "Attendance", icon: { lucide: ClipboardCheck } },
      { href: "/parent/progress", label: "Progress reports", icon: { src: "/icons/chart-line.svg" } },
      { href: "/parent/account", label: "Fees & statement", icon: { lucide: Receipt } },
      { href: "/parent/messages", label: "Messages", icon: { src: "/icons/message-square.svg" } },
      { href: "/parent/resources", label: "Resources", icon: { src: "/icons/database.svg" } },
    ],
  },
  learner: {
    workspace: "Learner portal",
    items: [
      { href: "/learner", label: "Overview", icon: { src: "/icons/chart-network.svg" }, exact: true },
      { href: "/learner/timetable", label: "My timetable", icon: { lucide: Calendar } },
      { href: "/learner/progress", label: "My reports", icon: { src: "/icons/chart-line.svg" } },
      { href: "/learner/resources", label: "Resources", icon: { src: "/icons/database.svg" } },
      { href: "/learner/messages", label: "Messages", icon: { src: "/icons/message-square.svg" } },
    ],
  },
  tutor: {
    workspace: "Tutor workspace",
    items: [
      { href: "/tutor", label: "Overview", icon: { src: "/icons/chart-network.svg" }, exact: true },
      { href: "/tutor/schedule", label: "My schedule", icon: { lucide: Calendar } },
      { href: "/tutor/register", label: "Attendance register", icon: { lucide: ClipboardCheck } },
      { href: "/tutor/learners", label: "My learners", icon: { lucide: GraduationCap } },
      { href: "/tutor/assessments", label: "Assessments", icon: { lucide: BookOpen } },
      { href: "/tutor/reports", label: "Progress reports", icon: { lucide: FileText } },
      { href: "/tutor/sessions", label: "Sessions taught", icon: { src: "/icons/chart-line.svg" } },
      { href: "/tutor/messages", label: "Messages", icon: { lucide: MessagesSquare } },
      { href: "/tutor/reviews", label: "Reviews", icon: { src: "/icons/message-square.svg" } },
    ],
  },
  admin: {
    workspace: "Admin workspace",
    items: [
      { href: "/admin", label: "Dashboard", icon: { lucide: LayoutDashboard }, exact: true },
      { href: "/admin/enrolments", label: "Enrolment queue", icon: { lucide: UserRoundCheck } },
      { href: "/admin/learners", label: "Learners", icon: { lucide: GraduationCap } },
      { href: "/admin/tutors", label: "Tutors", icon: { lucide: Users } },
      { href: "/admin/timetable", label: "Timetable", icon: { lucide: Calendar } },
      { href: "/admin/billing", label: "Billing", icon: { lucide: Receipt } },
      { href: "/admin/expenses", label: "Expenses", icon: { lucide: Banknote } },
      { href: "/admin/enquiries", label: "Enquiries", icon: { lucide: MessagesSquare } },
      { href: "/admin/notifications", label: "Announcements", icon: { lucide: Bell } },
      { href: "/admin/reports", label: "KPIs", icon: { lucide: ChartColumn } },
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
  role,
  subtitle,
  children,
}: {
  profile: Row<"profiles">;
  role: AppRole;
  subtitle?: string;
  children: ReactNode;
}) {
  const nav = NAV[role];

  return (
    <div className="flex min-h-screen w-full flex-col md:flex-row">
      <aside className="flex w-full shrink-0 flex-col gap-[22px] bg-night p-5 md:sticky md:top-0 md:h-screen md:w-[220px]">
        <Link href="/" className="w-fit">
          <Logo height={38} />
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
              <span className="text-[11px] text-white/70">{subtitle ?? nav.workspace}</span>
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
