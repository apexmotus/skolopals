import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink, Card, CardTitle, EmptyState, PageHeading, Select, buttonClass, cx } from "@/components/ui";
import { TutorCard } from "@/components/tutor-card";
import { SortSelect } from "./sort-select";
import { GRADES, LANGUAGES, PAGE_SIZE, PRICE_RANGES, SORTS, SUBJECTS, searchTutors } from "@/lib/queries";

export const metadata: Metadata = { title: "Find a tutor" };

const RATINGS = [
  { value: "4.5", label: "4.5 and up" },
  { value: "4", label: "4.0 and up" },
  { value: "3", label: "3.0 and up" },
];

function param(v: string | string[] | undefined) {
  return typeof v === "string" ? v : "";
}

export default async function FindTutorPage({ searchParams }: PageProps<"/tutors">) {
  const sp = await searchParams;
  const filters = {
    subject: param(sp.subject),
    grade: param(sp.grade),
    price: param(sp.price),
    rating: param(sp.rating),
    language: param(sp.language),
    sort: param(sp.sort) || "rating",
    page: Number(param(sp.page)) || 1,
  };
  const view = param(sp.view) === "list" ? "list" : "grid";
  const { tutors, total, page } = await searchTutors(filters);

  const href = (overrides: Record<string, string | number>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filters, view, ...overrides })) if (v) next.set(k, String(v));
    return `/tutors?${next}`;
  };

  const first = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);
  const filtered = Boolean(filters.subject || filters.grade || filters.price || filters.rating || filters.language);

  return (
    <div className="flex flex-col gap-5 p-4 md:p-7">
      <PageHeading
        title="Find your tutor"
        description={`${total} verified ${total === 1 ? "tutor matches" : "tutors match"} your learning goals`}
      />
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <Card className="w-full shrink-0 md:w-[260px]">
          <CardTitle>Filters</CardTitle>
          <form action="/tutors" className="flex flex-col gap-[14px]">
            <input type="hidden" name="sort" value={filters.sort} />
            <input type="hidden" name="view" value={view} />
            <FilterSelect id="subject" label="Subject" value={filters.subject} options={SUBJECTS.map((s) => ({ value: s, label: s }))} />
            <FilterSelect id="grade" label="Grade level" value={filters.grade} options={GRADES.map((g) => ({ value: g, label: g }))} />
            <FilterSelect id="price" label="Price range" value={filters.price} options={PRICE_RANGES} />
            <FilterSelect id="rating" label="Minimum rating" value={filters.rating} options={RATINGS} />
            <FilterSelect id="language" label="Language" value={filters.language} options={LANGUAGES.map((l) => ({ value: l, label: l }))} />
            <div className="flex gap-2">
              <ButtonLink href="/tutors" variant="secondary">
                Clear all
              </ButtonLink>
              <button className={buttonClass("primary")}>Apply filters</button>
            </div>
          </form>
        </Card>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SortSelect value={filters.sort} options={SORTS} />
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-muted">View</span>
              <ViewToggle href={href({ view: "grid", page: 1 })} active={view === "grid"} icon="grid" label="Grid" />
              <ViewToggle href={href({ view: "list", page: 1 })} active={view === "list"} icon="list" label="List" />
            </div>
          </div>

          {tutors.length === 0 ? (
            <EmptyState
              title="No tutors match those filters"
              description="Try a different subject or grade, widen the price range, or clear the filters to see every verified tutor."
            >
              <ButtonLink href="/tutors" variant="secondary">
                Clear filters
              </ButtonLink>
              <ButtonLink href="/contact">Ask us to find one</ButtonLink>
            </EmptyState>
          ) : (
            <div className={cx("grid gap-3", view === "grid" ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2")}>
              {tutors.map((t) => (
                <TutorCard key={t.id} tutor={t} />
              ))}
            </div>
          )}

          {total > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] text-muted">
                Showing {first}-{last} of {total} {filtered ? "matching " : ""}tutors
              </p>
              <div className="flex gap-2">
                <PageLink href={href({ page: page - 1 })} disabled={page <= 1} variant="secondary">
                  Previous
                </PageLink>
                <PageLink href={href({ page: page + 1 })} disabled={last >= total} variant="primary">
                  Next
                </PageLink>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  id,
  label,
  value,
  options,
}: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-[6px]">
      <label htmlFor={`filter-${id}`} className="text-[11px] text-ink">
        {label}
      </label>
      <Select id={`filter-${id}`} name={id} defaultValue={value}>
        <option value="">Select or enter...</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

function ViewToggle({ href, active, icon, label }: { href: string; active: boolean; icon: string; label: string }) {
  return (
    <Link
      href={href}
      aria-pressed={active}
      className={cx(
        "flex h-9 items-center gap-2 rounded-[6px] border border-line px-3 text-[13px]",
        active ? "bg-brand text-white" : "bg-white text-ink",
      )}
    >
      <img src={`/icons/${icon}.svg`} alt="" width={16} height={16} className={active ? "brightness-0 invert" : "brightness-0 opacity-60"} />
      {label}
    </Link>
  );
}

function PageLink({
  href,
  disabled,
  variant,
  children,
}: {
  href: string;
  disabled: boolean;
  variant: "primary" | "secondary";
  children: string;
}) {
  if (disabled) {
    return (
      <span aria-disabled className={buttonClass(variant, "pointer-events-none opacity-50")}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={buttonClass(variant)}>
      {children}
    </Link>
  );
}
