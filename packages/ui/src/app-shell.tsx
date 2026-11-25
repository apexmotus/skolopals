import { Button } from "./button";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  Banknote,
  Bell,
  Wallet,
  BookOpen,
  Calendar,
  ChartColumn,
  ClipboardCheck,
  FileText,
  GraduationCap,
  LayoutDashboard,
  MessagesSquare,
  Receipt,
  UserPlus,
  Users,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";
import { MobileNav } from "./mobile-nav";
import { NavLink } from "./nav-link";
import { Logo } from "./logo";
import { initials } from "@skolopals/shared/format";
import type { AppRole, Row } from "@skolopals/shared/database.types";

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
      { href: "/admin/users", label: "Users", icon: { lucide: UserPlus } },
      { href: "/admin/enrolments", label: "Applications", icon: { lucide: UserRoundCheck } },
      { href: "/admin/payments", label: "Payments", icon: { lucide: Wallet } },
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
  superadmin: {
    workspace: "Admin workspace",
    items: [
      { href: "/admin", label: "Dashboard", icon: { lucide: LayoutDashboard }, exact: true },
      { href: "/admin/users", label: "Users", icon: { lucide: UserPlus } },
      { href: "/admin/enrolments", label: "Applications", icon: { lucide: UserRoundCheck } },
      { href: "/admin/payments", label: "Payments", icon: { lucide: Wallet } },
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
  signOutAction,
  helpHref,
  badges,
  notifications,
  children,
}: {
  profile: Row<"profiles">;
  role: AppRole;
  subtitle?: string;
  signOutAction: () => Promise<void>;
  helpHref?: string | null;
  /** A count beside a nav item, by href (e.g. proofs of payment to check). Zero shows nothing. */
  badges?: Record<string, number>;
  /** The notifications bell, beside the logo and in the phone top bar. */
  notifications?: ReactNode;
  children: ReactNode;
}) {
  const nav = NAV[role];

  // One body for both places it appears. In the drawer it is always full
  // width; in the sidebar it collapses to an icon rail between md and lg.
  const body = (rail: boolean) => {
    const hideOnRail = rail ? "md:max-lg:sr-only" : "";
    return (
      <>
        <span
          className={`w-fit rounded-full bg-white/[0.09] px-[10px] py-[5px] text-[12px] text-white ${rail ? "md:max-lg:hidden" : ""}`}
        >
          {nav.workspace}
        </span>
        <nav aria-label="Workspace" className="flex flex-col gap-[6px]">
          {nav.items.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              exact={item.exact}
              className={`flex min-h-11 items-center gap-[10px] rounded-[6px] px-3 py-[10px] text-[14px] text-white hover:bg-white/[0.05] md:text-[13px] ${rail ? "md:max-lg:justify-center md:max-lg:px-0" : ""}`}
              activeClassName="bg-white/[0.09] font-semibold shadow-[inset_3px_0_0_var(--color-sun)] hover:bg-white/[0.09]"
              title={rail ? item.label : undefined}
            >
              <span className="relative shrink-0">
                <Icon icon={item.icon} />
                {badges?.[item.href] ? (
                  <span className={`absolute -right-2 -top-2 hidden min-w-4 rounded-full bg-sun px-1 text-center text-[10px] font-bold leading-4 text-plum-950 ${rail ? "md:max-lg:block" : ""}`}>
                    {badges[item.href]}
                  </span>
                ) : null}
              </span>
              <span className={hideOnRail}>{item.label}</span>
              {badges?.[item.href] ? (
                <span
                  className={`ml-auto rounded-full bg-sun px-2 text-[12px] font-bold leading-5 text-plum-950 ${rail ? "md:max-lg:hidden" : ""}`}
                  aria-label={`${badges[item.href]} waiting`}
                >
                  {badges[item.href]}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>
        <div className="flex-1" />
        <div
          className={`flex flex-col gap-[10px] rounded-[10px] border border-white/[0.08] bg-white/[0.05] p-3 ${rail ? "md:max-lg:items-center md:max-lg:p-2" : ""}`}
        >
          <div className="flex items-center gap-[10px]">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[18px] bg-white/[0.08] text-[12px] font-bold text-white">
              {initials(profile.full_name || "?")}
            </span>
            <div className={`flex min-w-0 flex-col gap-[2px] ${rail ? "md:max-lg:hidden" : ""}`}>
              <span className="truncate text-[13px] font-semibold text-white">{profile.full_name}</span>
              <span className="text-[12px] text-white/70">{subtitle ?? nav.workspace}</span>
            </div>
          </div>
          <div className={`flex gap-2 ${rail ? "md:max-lg:flex-col" : ""}`}>
            {helpHref ? (
              <Link
                href={helpHref}
                className="flex min-h-9 items-center justify-center rounded-full bg-white/[0.07] px-3 text-[12px] font-semibold text-white"
              >
                Help
              </Link>
            ) : null}
            <form action={signOutAction}>
              <Button
                variant="bare"
                className="min-h-9 rounded-full bg-white/[0.07] px-3 text-[12px] font-semibold text-white"
              >
                Log out
              </Button>
            </form>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="flex min-h-screen w-full flex-col md:flex-row">
      <MobileNav
        items={nav.items.map(({ href, label, exact }) => ({ href, label, exact }))}
        workspace={nav.workspace}
        actions={notifications}
      >
        {body(false)}
      </MobileNav>
      <aside className="hidden shrink-0 flex-col gap-[22px] bg-night p-5 md:sticky md:top-0 md:flex md:h-screen md:w-[84px] md:overflow-y-auto md:px-3 lg:w-[220px] lg:px-5">
        <div className="flex items-center justify-between gap-2 md:max-lg:flex-col">
          <Link href="/" className="w-fit" aria-label="Home">
            <Logo height={38} />
          </Link>
          {notifications}
        </div>
        {body(true)}
      </aside>
      <main className="flex min-w-0 flex-1 flex-col gap-5 p-4 md:p-[30px]">{children}</main>
    </div>
  );
}
