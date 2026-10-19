import Link from "next/link";
import { ButtonLink } from "@/components/ui";
import { NavLink } from "@/components/nav-link";
import { Logo } from "@/components/logo";
import { getProfile, homeFor } from "@/lib/auth";
import { signOut } from "@/app/(auth)/actions";

const LINKS = [
  { href: "/", label: "Home", exact: true },
  { href: "/tutors", label: "Find a Tutor" },
  { href: "/become-a-tutor", label: "Become a Tutor" },
  { href: "/subjects", label: "Subjects" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
];

export async function PublicNav() {
  const profile = await getProfile();

  return (
    <header className="w-full border-b border-line bg-white">
      <div className="flex min-h-[68px] flex-wrap items-center justify-between gap-x-8 gap-y-3 px-4 py-3 md:px-9">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
          <Link href="/" className="shrink-0">
            <Logo height={40} priority />
          </Link>
          <nav aria-label="Main" className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[13px] text-ink">
            {LINKS.map((l) => (
              <NavLink key={l.href} href={l.href} exact={l.exact} activeClassName="font-bold text-brand">
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {profile ? (
            <>
              <ButtonLink href={homeFor(profile.role)} variant="secondary">
                Dashboard
              </ButtonLink>
              <form action={signOut}>
                <button className="rounded-[6px] border border-line bg-brand px-[18px] py-[11px] text-[13px] leading-none text-white">
                  Log out
                </button>
              </form>
            </>
          ) : (
            <>
              <ButtonLink href="/login" variant="secondary">
                Login
              </ButtonLink>
              <ButtonLink href="/signup">Sign Up</ButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="px-4 pb-8 text-center text-[12px] text-muted md:px-14">
      <Link href="/about">About</Link> · <Link href="/safeguarding">Safeguarding</Link> ·{" "}
      <Link href="/careers">Careers</Link> · <Link href="/contact">Help</Link> · <Link href="/terms">Terms</Link> ·{" "}
      <Link href="/privacy">Privacy</Link> · © {new Date().getFullYear()} Skolopals
    </footer>
  );
}
