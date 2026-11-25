"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "./logo";

type Item = { href: string; label: string; exact?: boolean };

function activeLabel(items: Item[], pathname: string) {
  // Longest match wins, so /admin/tutors/123 is "Tutors", not "Dashboard".
  const match = items
    .filter((i) => (i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(`${i.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.label;
}

/**
 * Phones only: a sticky top bar with the current section and a menu button
 * that opens the workspace navigation in a drawer. The drawer is a native
 * <dialog>, so focus is trapped and Esc closes it.
 */
// Literal class names, so Tailwind sees them.
const HIDE_FROM = { md: "md:hidden", lg: "lg:hidden" } as const;

export function MobileNav({
  items,
  workspace,
  breakpoint = "md",
  actions,
  titles,
  children,
}: {
  items: Item[];
  workspace: string;
  /** Titles for pages that aren't in the menu, so the bar names them rather than the workspace. */
  titles?: Item[];
  /** Width from which the page shows its own full navigation and this bar disappears. */
  breakpoint?: keyof typeof HIDE_FROM;
  /** Shown in the bar beside the menu button, e.g. a notifications bell. */
  actions?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Navigating closes the drawer. Adjusted during render, not in an effect,
  // so there is no extra render with a stale open drawer.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  return (
    <>
      <header
        className={`sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-white/10 bg-night px-4 ${HIDE_FROM[breakpoint]}`}
      >
        <Link href="/" className="shrink-0" aria-label="Home">
          <Logo height={28} />
        </Link>
        <p className="min-w-0 flex-1 truncate text-center text-[15px] font-semibold text-white">
          {activeLabel([...items, ...(titles ?? [])], pathname) ?? workspace}
        </p>
        {actions}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="-mr-2 flex size-11 items-center justify-center rounded-full text-white hover:bg-white/[0.09]"
        >
          <Menu aria-hidden size={22} />
        </button>
      </header>

      <dialog
        ref={ref}
        aria-label={`${workspace} menu`}
        onCancel={(e) => {
          e.preventDefault();
          setOpen(false);
        }}
        onClick={(e) => {
          // Backdrop click, or any link inside (covers same-page links, where the path does not change).
          if (e.target === e.currentTarget || (e.target as HTMLElement).closest("a")) setOpen(false);
        }}
        className={`m-0 h-dvh max-h-none w-[min(84vw,300px)] max-w-none bg-night p-0 backdrop:bg-plum-950/70 open:flex ${HIDE_FROM[breakpoint]}`}
      >
        <div className="flex w-full flex-col gap-[22px] overflow-y-auto p-5">
          <div className="flex items-center justify-between">
            <Logo height={34} />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="-mr-2 flex size-11 items-center justify-center rounded-full text-white hover:bg-white/[0.09]"
            >
              <X aria-hidden size={22} />
            </button>
          </div>
          {children}
        </div>
      </dialog>
    </>
  );
}
