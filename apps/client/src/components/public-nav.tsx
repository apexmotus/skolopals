import { Button, ButtonLink } from "@skolopals/ui/ui";
import Link from "next/link";
import { Suspense } from "react";
import { NavLink } from "@skolopals/ui/nav-link";
import { Logo } from "@skolopals/ui/logo";
import { MobileNav } from "@skolopals/ui/mobile-nav";
import { CENTRE, CENTRE_ADDRESS } from "@/lib/centre";
import { getSession, clientHomeFor } from "@skolopals/shared/auth";
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

/** Public pages that aren't in the menu, named in the phone top bar instead of "Skolopals". */
const OTHER_PAGES = [
  { href: "/enrol", label: "Enrol" },
  { href: "/about", label: "About" },
  { href: "/safeguarding", label: "Keeping learners safe" },
  { href: "/careers", label: "Work with us" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
];

export function PublicNav() {
  return (
    <>
      {/* Phones and tablets: a top bar and a drawer. Seven links and two buttons need ~1100px in a row. */}
      <MobileNav items={LINKS} titles={OTHER_PAGES} workspace="Skolopals" breakpoint="lg">
        <nav aria-label="Main" className="flex flex-col gap-[6px]">
          {LINKS.map((l) => (
            <NavLink
              key={l.href}
              href={l.href}
              exact={l.exact}
              className="flex min-h-11 items-center rounded-[6px] px-3 text-[15px] text-white hover:bg-white/[0.05]"
              activeClassName="bg-white/[0.09] font-semibold shadow-[inset_3px_0_0_var(--color-sun)]"
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex-1" />
        <Suspense fallback={null}>
          <NavAccount stacked />
        </Suspense>
      </MobileNav>

      <header className="hidden h-[68px] w-full items-center justify-between gap-6 border-b border-white/10 bg-night px-[32px] lg:flex">
        <div className="flex h-full min-w-0 items-center">
          <Link href="/" className="shrink-0" aria-label="Home">
            <Logo height={40} priority />
          </Link>
          <nav aria-label="Main" className="ml-[36px] flex h-full items-center gap-[24px]">
            {LINKS.map((l) => (
              <NavLink
                key={l.href}
                href={l.href}
                exact={l.exact}
                className="relative inline-flex h-full items-center whitespace-nowrap text-[14px] font-medium leading-none text-on-dark-muted transition-colors hover:text-white"
                activeClassName="!font-bold !text-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[3px] after:rounded-t-[2px] after:bg-sun after:content-['']"
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
        {/* The session lookup is an API round trip; stream it in so the nav and page don't wait. */}
        <Suspense fallback={<div aria-hidden className="h-[36px] w-[170px]" />}>
          <NavAccount />
        </Suspense>
      </header>
    </>
  );
}

/** Dashboard + log out, or login + enrol. `stacked` lays them out full width for the drawer. */
async function NavAccount({ stacked = false }: { stacked?: boolean }) {
  const session = await getSession();
  const layout = stacked ? "flex flex-col gap-[10px] [&>*]:w-full [&_button]:w-full" : "flex items-center gap-[12px]";

  return (
    <div className={layout}>
      {session ? (
        <>
          <ButtonLink href={clientHomeFor(session.roles)} variant="ghostOnDark">
            Dashboard
          </ButtonLink>
          <form action={signOut}>
            <Button type="submit" variant="sun">
              Log out
            </Button>
          </form>
        </>
      ) : (
        <>
          <ButtonLink href="/login" variant="ghostOnDark">
            Login
          </ButtonLink>
          <ButtonLink href="/enrol">Enrol</ButtonLink>
        </>
      )}
    </div>
  );
}

export function PublicFooter() {
  return (
    <footer className="mt-10 flex flex-col gap-2 px-4 pb-8 text-center text-[12px] text-muted md:px-14">
      <p className="font-semibold text-ink">{CENTRE.name}</p>
      <p>
        {CENTRE_ADDRESS} ·{" "}
        <a href={CENTRE.phoneLink} className="text-link hover:underline">
          {CENTRE.phone}
        </a>
      </p>
      <p className="flex flex-wrap justify-center gap-x-1.5">
        <Link href="/about" className="hover:text-link hover:underline">About</Link> ·{" "}
        <Link href="/subjects" className="hover:text-link hover:underline">Subjects</Link> ·{" "}
        <Link href="/timetable" className="hover:text-link hover:underline">Timetable</Link> ·{" "}
        <Link href="/pricing" className="hover:text-link hover:underline">Fees</Link> ·{" "}
        <Link href="/safeguarding" className="hover:text-link hover:underline">Keeping learners safe</Link> ·{" "}
        <Link href="/contact" className="hover:text-link hover:underline">Contact</Link> ·{" "}
        <Link href="/terms" className="hover:text-link hover:underline">Terms</Link> ·{" "}
        <Link href="/privacy" className="hover:text-link hover:underline">Privacy</Link>
      </p>
      <p>© {new Date().getFullYear()} {CENTRE.name}. {CENTRE.tagline}</p>
    </footer>
  );
}
