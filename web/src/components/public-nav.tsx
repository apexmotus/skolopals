import Link from "next/link";
import { NavLink } from "@/components/nav-link";
import { Logo } from "@/components/logo";
import { CENTRE, CENTRE_ADDRESS } from "@/lib/centre";
import { getSession, homeFor } from "@/lib/auth";
import { signOut } from "@/app/(auth)/actions";

const LINKS = [
  { href: "/", label: "Home", exact: true },
  { href: "/subjects", label: "Subjects" },
  { href: "/tutors", label: "Our Tutors" },
  { href: "/timetable", label: "Timetable" },
  { href: "/programmes", label: "Holiday Programmes" },
  { href: "/pricing", label: "Fees" },
  { href: "/contact", label: "Contact" },
];

export async function PublicNav() {
  const session = await getSession();

  return (
    <header className="flex min-h-[68px] w-full flex-wrap items-center justify-between border-b border-[#EAE6DF] bg-[#FFFFFF] px-4 md:h-[68px] md:flex-nowrap md:px-[32px]">
      <div className="flex flex-wrap items-center md:h-full md:flex-nowrap">
        <Link href="/" className="shrink-0">
          <Logo height={40} priority />
        </Link>
        <nav
          aria-label="Main"
          className="ml-4 flex flex-wrap items-center gap-[24px] md:ml-[36px] md:h-full md:flex-nowrap"
        >
          {LINKS.map((l) => (
            <NavLink
              key={l.href}
              href={l.href}
              exact={l.exact}
              className="relative inline-flex items-center py-2 text-[14px] font-medium leading-none text-[#1E293B] transition-colors hover:text-[#0277BD] md:h-[68px] md:py-0"
              activeClassName="!font-bold !text-[#0277BD] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[3px] after:rounded-t-[2px] after:bg-[#0277BD] after:content-['']"
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-[12px]">
        {session ? (
          <>
            <Link
              href={homeFor(session.roles)}
              className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-[8px] border border-[#CBD5E1] bg-[#FFFFFF] px-[18px] py-[9px] text-[14px] font-semibold leading-none text-[#1E293B] transition-colors hover:border-[#1B2559] hover:text-[#1B2559]"
            >
              Dashboard
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-[8px] border-none bg-[#6A1B9A] px-[18px] py-[9px] text-[14px] font-semibold leading-none text-[#FFFFFF] transition-colors hover:bg-[#581582]"
              >
                Log out
              </button>
            </form>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-[8px] border border-[#CBD5E1] bg-[#FFFFFF] px-[18px] py-[9px] text-[14px] font-semibold leading-none text-[#1E293B] transition-colors hover:border-[#1B2559] hover:text-[#1B2559]"
            >
              Login
            </Link>
            <Link
              href="/enrol"
              className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-[8px] border-none bg-[#D81B7A] px-[18px] py-[9px] text-[14px] font-semibold leading-none text-[#FFFFFF] transition-colors hover:bg-[#be166b]"
            >
              Enrol
            </Link>
          </>
        )}
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="mt-10 flex flex-col gap-2 px-4 pb-8 text-center text-[12px] text-[#334155] md:px-14">
      <p className="font-semibold text-[#1B2559]">{CENTRE.name}</p>
      <p>
        {CENTRE_ADDRESS} ·{" "}
        <a href={CENTRE.phoneLink} className="text-[#0277BD] hover:underline">
          {CENTRE.phone}
        </a>
      </p>
      <p className="flex flex-wrap justify-center gap-x-1.5">
        <Link href="/about" className="hover:text-[#0277BD] hover:underline">About</Link> ·{" "}
        <Link href="/subjects" className="hover:text-[#0277BD] hover:underline">Subjects</Link> ·{" "}
        <Link href="/timetable" className="hover:text-[#0277BD] hover:underline">Timetable</Link> ·{" "}
        <Link href="/pricing" className="hover:text-[#0277BD] hover:underline">Fees</Link> ·{" "}
        <Link href="/safeguarding" className="hover:text-[#0277BD] hover:underline">Keeping learners safe</Link> ·{" "}
        <Link href="/contact" className="hover:text-[#0277BD] hover:underline">Contact</Link> ·{" "}
        <Link href="/terms" className="hover:text-[#0277BD] hover:underline">Terms</Link> ·{" "}
        <Link href="/privacy" className="hover:text-[#0277BD] hover:underline">Privacy</Link>
      </p>
      <p>© {new Date().getFullYear()} {CENTRE.name}. {CENTRE.tagline}</p>
    </footer>
  );
}
